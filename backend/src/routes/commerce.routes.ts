import { Router, Request, Response } from "express";
import multer from "multer";
import { pool } from "../config/database";
import { env } from "../config/env";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/require-role";
import { audit } from "../middleware/audit";
import { liveFilter, compFilter, softDelete } from "../db/query-helpers";
import { hasCompAccess } from "../services/comp-access.service";
import { storeFile, getSignedUrl } from "../services/storage.service";
import { createSnapToken, getTransactionStatus } from "../services/midtrans.service";

// Commerce API (EMC Wave 9). The `/commerce/*` namespace is operator-facing —
// admin + organizer, native competitions only (the `hasCompAccess` gate).
// Mounted at bare /api with a path-scoped guard so it never 403s fall-through
// traffic. (The student `/storefront/*` routes arrive in Phase 6.)

const router = Router();
router.use("/commerce", authMiddleware);
// Operator-only sub-trees (admin + organizer). Order routes under
// /commerce/orders/* are guarded per-route — an order owner pays/verifies
// their own order, while operators manage any (Phase 5).
router.use("/commerce/competitions", requireRole("admin", "organizer"));
router.use("/commerce/products", requireRole("admin", "organizer"));
router.use("/commerce/voucher-groups", requireRole("admin", "organizer"));

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    cb(null, ["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(file.mimetype));
  },
});

function pageParams(req: Request): { limit: number; offset: number; page: number } {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  return { limit, offset: (page - 1) * limit, page };
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "product"
  );
}

const trim = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null;

async function mapProduct(r: any) {
  return {
    id: r.id,
    compId: r.comp_id,
    code: r.code,
    name: r.name,
    slug: r.slug,
    price: r.price != null ? Number(r.price) : 0,
    description: r.description ?? null,
    image: r.image ? await getSignedUrl(r.image) : null,
    active: r.active,
    createdAt: r.created_at,
  };
}

// Resolve a product's comp_id, then access-check.
async function productCompIfAccessible(req: Request, id: string): Promise<string | null> {
  const r = await pool.query(
    "SELECT comp_id FROM products WHERE id = $1 AND deleted_at IS NULL",
    [id]
  );
  if (r.rows.length === 0) return null;
  const compId = r.rows[0].comp_id as string;
  return (await hasCompAccess(req.userId!, req.userRole!, compId)) ? compId : null;
}

// ── GET /api/commerce/competitions ────────────────────────────────────────
// The native competitions whose store the caller may manage.
router.get("/commerce/competitions", async (req: Request, res: Response) => {
  try {
    const isAdmin = req.userRole === "admin";
    const r = await pool.query(
      `SELECT id, name, slug FROM competitions
        WHERE kind = 'native'${isAdmin ? "" : " AND created_by = $1"}
        ORDER BY name ASC`,
      isAdmin ? [] : [req.userId]
    );
    res.json(r.rows.map((c) => ({ id: c.id, name: c.name, slug: c.slug ?? null })));
  } catch (err) {
    console.error("List commerce competitions error:", err);
    res.status(500).json({ message: "Failed to load competitions" });
  }
});

// ── GET /api/commerce/products?compId=&search=&active=&page= ───────────────
router.get("/commerce/products", async (req: Request, res: Response) => {
  try {
    const compId = String(req.query.compId ?? "");
    if (!compId || !(await hasCompAccess(req.userId!, req.userRole!, compId))) {
      res.status(403).json({ message: "No access to this competition" });
      return;
    }
    const { limit, offset, page } = pageParams(req);
    const params: unknown[] = [compId];
    let where = `${compFilter()} AND ${liveFilter()}`;
    if (req.query.search) {
      params.push(`%${String(req.query.search).trim()}%`);
      where += ` AND (name ILIKE $${params.length} OR code ILIKE $${params.length})`;
    }
    if (req.query.active === "true" || req.query.active === "false") {
      params.push(req.query.active === "true");
      where += ` AND active = $${params.length}`;
    }
    const total = await pool.query(`SELECT COUNT(*)::int n FROM products WHERE ${where}`, params);
    params.push(limit, offset);
    const r = await pool.query(
      `SELECT id, comp_id, code, name, slug, price, description, image, active, created_at
         FROM products WHERE ${where}
        ORDER BY created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json({
      products: await Promise.all(r.rows.map(mapProduct)),
      pagination: { total: total.rows[0].n, page, limit },
    });
  } catch (err) {
    console.error("List products error:", err);
    res.status(500).json({ message: "Failed to load products" });
  }
});

// ── GET /api/commerce/products/:id ────────────────────────────────────────
router.get("/commerce/products/:id", async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    if (!(await productCompIfAccessible(req, id))) {
      res.status(404).json({ message: "Product not found" });
      return;
    }
    const r = await pool.query(
      `SELECT id, comp_id, code, name, slug, price, description, image, active, created_at
         FROM products WHERE id = $1`,
      [id]
    );
    res.json(await mapProduct(r.rows[0]));
  } catch (err) {
    console.error("Get product error:", err);
    res.status(500).json({ message: "Failed to load the product" });
  }
});

// ── POST /api/commerce/products ───────────────────────────────────────────
router.post(
  "/commerce/products",
  audit({ action: "product.create", resourceType: "product" }),
  async (req: Request, res: Response) => {
    try {
      const compId = String(req.body?.compId ?? "");
      if (!compId || !(await hasCompAccess(req.userId!, req.userRole!, compId))) {
        res.status(403).json({ message: "No access to this competition" });
        return;
      }
      const name = trim(req.body?.name);
      if (!name) {
        res.status(400).json({ message: "name is required" });
        return;
      }
      // Auto code (PRD-NNN, comp-monotonic) + a unique slug.
      const count = await pool.query("SELECT COUNT(*)::int n FROM products WHERE comp_id = $1", [compId]);
      const code = trim(req.body?.code) || `PRD-${String(count.rows[0].n + 1).padStart(3, "0")}`;
      const base = slugify(name);
      let slug = base;
      for (let i = 2; ; i++) {
        const dup = await pool.query(
          "SELECT 1 FROM products WHERE comp_id = $1 AND slug = $2 AND deleted_at IS NULL",
          [compId, slug]
        );
        if (dup.rows.length === 0) break;
        slug = `${base}-${i}`;
      }
      const price = Number(req.body?.price);
      const inserted = await pool.query(
        `INSERT INTO products (comp_id, code, name, slug, price, description, active)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         RETURNING id, comp_id, code, name, slug, price, description, image, active, created_at`,
        [
          compId, code, name, slug,
          Number.isFinite(price) && price >= 0 ? price : 0,
          trim(req.body?.description),
          req.body?.active !== false,
        ]
      );
      res.status(201).json(await mapProduct(inserted.rows[0]));
    } catch (err: any) {
      if (err?.code === "23505") {
        res.status(409).json({ message: "A product with this code already exists" });
        return;
      }
      console.error("Create product error:", err);
      res.status(500).json({ message: "Failed to create product" });
    }
  }
);

// ── PUT /api/commerce/products/:id ────────────────────────────────────────
router.put(
  "/commerce/products/:id",
  audit({ action: "product.update", resourceType: "product", resourceIdParam: "id" }),
  async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      if (!(await productCompIfAccessible(req, id))) {
        res.status(404).json({ message: "Product not found" });
        return;
      }
      const name = trim(req.body?.name);
      if (!name) {
        res.status(400).json({ message: "name is required" });
        return;
      }
      const price = Number(req.body?.price);
      const updated = await pool.query(
        `UPDATE products
            SET name=$1, price=$2, description=$3, active=$4, updated_at=now()
          WHERE id=$5 AND deleted_at IS NULL
        RETURNING id, comp_id, code, name, slug, price, description, image, active, created_at`,
        [
          name,
          Number.isFinite(price) && price >= 0 ? price : 0,
          trim(req.body?.description),
          req.body?.active !== false,
          id,
        ]
      );
      res.json(await mapProduct(updated.rows[0]));
    } catch (err) {
      console.error("Update product error:", err);
      res.status(500).json({ message: "Failed to update product" });
    }
  }
);

// ── DELETE /api/commerce/products/:id ─────────────────────────────────────
router.delete(
  "/commerce/products/:id",
  audit({ action: "product.delete", resourceType: "product", resourceIdParam: "id" }),
  async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      if (!(await productCompIfAccessible(req, id))) {
        res.status(404).json({ message: "Product not found" });
        return;
      }
      await softDelete("products", id);
      res.json({ message: "Product removed" });
    } catch (err) {
      console.error("Delete product error:", err);
      res.status(500).json({ message: "Failed to delete product" });
    }
  }
);

// ── POST /api/commerce/products/:id/image ─────────────────────────────────
router.post(
  "/commerce/products/:id/image",
  imageUpload.single("image"),
  audit({ action: "product.image", resourceType: "product", resourceIdParam: "id" }),
  async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      if (!(await productCompIfAccessible(req, id))) {
        res.status(404).json({ message: "Product not found" });
        return;
      }
      if (!req.file) {
        res.status(400).json({ message: "No image uploaded" });
        return;
      }
      const ext = req.file.mimetype === "image/png" ? "png" : req.file.mimetype === "image/webp" ? "webp" : "jpg";
      const path = await storeFile(req.userId!, req.file.buffer, `product-${id}-${Date.now()}.${ext}`, req.file.mimetype);
      await pool.query("UPDATE products SET image = $1, updated_at = now() WHERE id = $2", [path, id]);
      res.json({ image: await getSignedUrl(path) });
    } catch (err) {
      console.error("Product image upload error:", err);
      res.status(500).json({ message: "Failed to upload the image" });
    }
  }
);

// ──────────────────────────────────────────────────────────────────────────
// Voucher groups — a batch is a `voucher_groups` row; creating one mints
// `usable_count` individual `vouchers`. A voucher_groups.discounted value is
// the *absolute* registration fee a voucher-holder pays (not a percentage);
// it's applied in the Phase-3 registration-payment flow.
// ──────────────────────────────────────────────────────────────────────────

// No ambiguous chars (0/O, 1/I/L) — voucher codes get read off paper/screens.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function randomCode(len = 6): string {
  let s = "";
  for (let i = 0; i < len; i++) s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return s;
}

function mapVoucherGroup(r: any) {
  return {
    id: r.id,
    compId: r.comp_id,
    name: r.name,
    code: r.code,
    usableCount: r.usable_count,
    price: r.price != null ? Number(r.price) : 0,
    discounted: r.discounted != null ? Number(r.discounted) : 0,
    isActive: r.is_active,
    voucherCount: r.voucher_count != null ? Number(r.voucher_count) : 0,
    usedCount: r.used_count != null ? Number(r.used_count) : 0,
    createdAt: r.created_at,
  };
}

async function voucherGroupCompIfAccessible(req: Request, id: string): Promise<string | null> {
  const r = await pool.query(
    "SELECT comp_id FROM voucher_groups WHERE id = $1 AND deleted_at IS NULL",
    [id]
  );
  if (r.rows.length === 0) return null;
  const compId = r.rows[0].comp_id as string;
  return (await hasCompAccess(req.userId!, req.userRole!, compId)) ? compId : null;
}

// ── GET /api/commerce/voucher-groups?compId= ──────────────────────────────
router.get("/commerce/voucher-groups", async (req: Request, res: Response) => {
  try {
    const compId = String(req.query.compId ?? "");
    if (!compId || !(await hasCompAccess(req.userId!, req.userRole!, compId))) {
      res.status(403).json({ message: "No access to this competition" });
      return;
    }
    const r = await pool.query(
      `SELECT vg.id, vg.comp_id, vg.name, vg.code, vg.usable_count, vg.price,
              vg.discounted, vg.is_active, vg.created_at,
              COUNT(v.id)::int AS voucher_count,
              COUNT(v.id) FILTER (WHERE v.used > 0)::int AS used_count
         FROM voucher_groups vg
         LEFT JOIN vouchers v ON v.group_id = vg.id AND v.deleted_at IS NULL
        WHERE vg.comp_id = $1 AND vg.deleted_at IS NULL
        GROUP BY vg.id
        ORDER BY vg.created_at DESC`,
      [compId]
    );
    res.json(r.rows.map(mapVoucherGroup));
  } catch (err) {
    console.error("List voucher groups error:", err);
    res.status(500).json({ message: "Failed to load voucher groups" });
  }
});

// ── GET /api/commerce/voucher-groups/:id/vouchers ─────────────────────────
router.get("/commerce/voucher-groups/:id/vouchers", async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    if (!(await voucherGroupCompIfAccessible(req, id))) {
      res.status(404).json({ message: "Voucher group not found" });
      return;
    }
    const r = await pool.query(
      `SELECT v.id, v.code, v.npsn, v.used, v.max, v.created_at, u.email AS claimer_email
         FROM vouchers v
         LEFT JOIN users u ON u.id = v.user_id
        WHERE v.group_id = $1 AND v.deleted_at IS NULL
        ORDER BY v.created_at ASC`,
      [id]
    );
    res.json(
      r.rows.map((v) => ({
        id: v.id,
        code: v.code,
        npsn: v.npsn ?? null,
        used: v.used,
        max: v.max,
        claimerEmail: v.claimer_email ?? null,
        createdAt: v.created_at,
      }))
    );
  } catch (err) {
    console.error("List vouchers error:", err);
    res.status(500).json({ message: "Failed to load vouchers" });
  }
});

// ── POST /api/commerce/voucher-groups ─────────────────────────────────────
// Creates the group + mints `usableCount` vouchers in one transaction.
router.post(
  "/commerce/voucher-groups",
  audit({ action: "voucher_group.create", resourceType: "voucher_group" }),
  async (req: Request, res: Response) => {
    const client = await pool.connect();
    try {
      const compId = String(req.body?.compId ?? "");
      if (!compId || !(await hasCompAccess(req.userId!, req.userRole!, compId))) {
        res.status(403).json({ message: "No access to this competition" });
        return;
      }
      const name = trim(req.body?.name);
      if (!name) {
        res.status(400).json({ message: "name is required" });
        return;
      }
      const usableCount = Math.floor(Number(req.body?.usableCount));
      if (!Number.isFinite(usableCount) || usableCount < 1 || usableCount > 1000) {
        res.status(400).json({ message: "usableCount must be between 1 and 1000" });
        return;
      }
      const discounted = Number(req.body?.discounted);
      const price = Number(req.body?.price);
      const npsn = trim(req.body?.npsn);

      await client.query("BEGIN");
      const count = await client.query(
        "SELECT COUNT(*)::int n FROM voucher_groups WHERE comp_id = $1",
        [compId]
      );
      const code = trim(req.body?.code) || `VG-${String(count.rows[0].n + 1).padStart(3, "0")}`;
      const groupRow = await client.query(
        `INSERT INTO voucher_groups (comp_id, name, code, usable_count, price, discounted, is_active)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         RETURNING id, comp_id, name, code, usable_count, price, discounted, is_active, created_at`,
        [
          compId, name, code, usableCount,
          Number.isFinite(price) && price >= 0 ? price : 0,
          Number.isFinite(discounted) && discounted >= 0 ? discounted : 0,
          req.body?.isActive !== false,
        ]
      );
      const group = groupRow.rows[0];

      // Mint the codes — `{GROUP}-{rand}`, unique within the batch.
      const seen = new Set<string>();
      const codes: string[] = [];
      while (codes.length < usableCount) {
        const c = `${code}-${randomCode(6)}`;
        if (seen.has(c)) continue;
        seen.add(c);
        codes.push(c);
      }
      const values = codes.map((_, i) => `($1, $2, $${i + 4}, $3, 0, 1)`).join(",");
      await client.query(
        `INSERT INTO vouchers (comp_id, group_id, code, npsn, used, max) VALUES ${values}`,
        [compId, group.id, npsn, ...codes]
      );
      await client.query("COMMIT");
      res.status(201).json(
        mapVoucherGroup({ ...group, voucher_count: codes.length, used_count: 0 })
      );
    } catch (err: any) {
      await client.query("ROLLBACK").catch(() => {});
      if (err?.code === "23505") {
        res.status(409).json({ message: "A voucher group with this code already exists" });
        return;
      }
      console.error("Create voucher group error:", err);
      res.status(500).json({ message: "Failed to create voucher group" });
    } finally {
      client.release();
    }
  }
);

// ── PUT /api/commerce/voucher-groups/:id ──────────────────────────────────
// Edits the campaign — name / discounted fee / active flag. The minted codes
// and `usable_count` are immutable (re-minting would orphan printed codes).
router.put(
  "/commerce/voucher-groups/:id",
  audit({ action: "voucher_group.update", resourceType: "voucher_group", resourceIdParam: "id" }),
  async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      if (!(await voucherGroupCompIfAccessible(req, id))) {
        res.status(404).json({ message: "Voucher group not found" });
        return;
      }
      const name = trim(req.body?.name);
      if (!name) {
        res.status(400).json({ message: "name is required" });
        return;
      }
      const discounted = Number(req.body?.discounted);
      const price = Number(req.body?.price);
      const updated = await pool.query(
        `UPDATE voucher_groups
            SET name=$1, discounted=$2, price=$3, is_active=$4, updated_at=now()
          WHERE id=$5 AND deleted_at IS NULL
        RETURNING id, comp_id, name, code, usable_count, price, discounted, is_active, created_at`,
        [
          name,
          Number.isFinite(discounted) && discounted >= 0 ? discounted : 0,
          Number.isFinite(price) && price >= 0 ? price : 0,
          req.body?.isActive !== false,
          id,
        ]
      );
      const counts = await pool.query(
        `SELECT COUNT(*)::int AS voucher_count,
                COUNT(*) FILTER (WHERE used > 0)::int AS used_count
           FROM vouchers WHERE group_id = $1 AND deleted_at IS NULL`,
        [id]
      );
      res.json(mapVoucherGroup({ ...updated.rows[0], ...counts.rows[0] }));
    } catch (err) {
      console.error("Update voucher group error:", err);
      res.status(500).json({ message: "Failed to update voucher group" });
    }
  }
);

// ── DELETE /api/commerce/voucher-groups/:id ───────────────────────────────
// Soft-deletes the group and all its vouchers.
router.delete(
  "/commerce/voucher-groups/:id",
  audit({ action: "voucher_group.delete", resourceType: "voucher_group", resourceIdParam: "id" }),
  async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      if (!(await voucherGroupCompIfAccessible(req, id))) {
        res.status(404).json({ message: "Voucher group not found" });
        return;
      }
      await softDelete("voucher_groups", id);
      await pool.query(
        "UPDATE vouchers SET deleted_at = now() WHERE group_id = $1 AND deleted_at IS NULL",
        [id]
      );
      res.json({ message: "Voucher group removed" });
    } catch (err) {
      console.error("Delete voucher group error:", err);
      res.status(500).json({ message: "Failed to delete voucher group" });
    }
  }
);

// ──────────────────────────────────────────────────────────────────────────
// Order payments (Wave 9 Phase 4). An order payment is a `payments` row with
// kind='order' and no registration_id; the settlement webhook branches on
// `kind` to flip orders.status='paid'. These routes are owner-scoped (the
// student who placed the order) — operators manage orders separately (Phase 5).
// ──────────────────────────────────────────────────────────────────────────

// ── POST /api/commerce/orders/:id/pay ─────────────────────────────────────
router.post(
  "/commerce/orders/:id/pay",
  audit({ action: "order.pay", resourceType: "order", resourceIdParam: "id" }),
  async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      const o = await pool.query(
        `SELECT o.id, o.code, o.user_id, o.total, o.status, o.payment_id,
                u.full_name, u.email
           FROM orders o
           JOIN users u ON u.id = o.user_id
          WHERE o.id = $1 AND o.deleted_at IS NULL`,
        [id]
      );
      if (o.rows.length === 0 || o.rows[0].user_id !== req.userId) {
        res.status(404).json({ message: "Order not found" });
        return;
      }
      const order = o.rows[0];
      if (order.status !== "ordered") {
        res.status(400).json({ message: "This order is not awaiting payment." });
        return;
      }
      const total = Number(order.total) || 0;

      // A zero-total order — settle without Midtrans.
      if (total <= 0) {
        await pool.query(
          `UPDATE orders SET status = 'paid', paid_at = now(), updated_at = now() WHERE id = $1`,
          [id]
        );
        res.status(201).json({ covered: true, status: "paid" });
        return;
      }

      // Re-use a still-pending Snap token whose amount matches.
      if (order.payment_id) {
        const ex = await pool.query(
          `SELECT snap_token, order_id, amount FROM payments
            WHERE id = $1 AND kind = 'order' AND payment_status = 'pending'
              AND snap_token IS NOT NULL`,
          [order.payment_id]
        );
        if (ex.rows.length > 0 && Number(ex.rows[0].amount) === total) {
          const subdomain = env.MIDTRANS_IS_PRODUCTION ? "app" : "app.sandbox";
          res.json({
            snapToken: ex.rows[0].snap_token,
            redirectUrl: `https://${subdomain}.midtrans.com/snap/v2/vtweb/${ex.rows[0].snap_token}`,
            paymentId: order.payment_id,
            orderId: ex.rows[0].order_id,
          });
          return;
        }
      }

      const midOrderId = `ORDER-${id}-${Date.now()}`.slice(0, 50);
      const { snapToken, redirectUrl } = await createSnapToken({
        orderId: midOrderId,
        amount: total,
        customerName: order.full_name,
        customerEmail: order.email,
        competitionName: `Order ${order.code}`,
      });
      const pay = await pool.query(
        `INSERT INTO payments
           (user_id, amount, payment_status, snap_token, order_id, kind, payer_user_id, payer_kind)
         VALUES ($1, $2, 'pending', $3, $4, 'order', $1, 'self')
         RETURNING id`,
        [req.userId, total, snapToken, midOrderId]
      );
      await pool.query(
        `UPDATE orders SET payment_id = $1, updated_at = now() WHERE id = $2`,
        [pay.rows[0].id, id]
      );
      res.status(201).json({
        snapToken,
        redirectUrl,
        paymentId: pay.rows[0].id,
        orderId: midOrderId,
      });
    } catch (err: any) {
      console.error("Order pay error:", err);
      res.status(500).json({ message: err.message || "Failed to start order payment" });
    }
  }
);

// ── GET /api/commerce/orders/:id/verify ───────────────────────────────────
// Polls the Midtrans Status API and syncs orders.status — the storefront
// checkout calls this after the payment tab closes (the webhook can't reach
// localhost in sandbox).
router.get("/commerce/orders/:id/verify", async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const o = await pool.query(
      `SELECT o.id, o.user_id, o.status, p.order_id AS mid_order_id
         FROM orders o
         LEFT JOIN payments p ON p.id = o.payment_id
        WHERE o.id = $1 AND o.deleted_at IS NULL`,
      [id]
    );
    if (o.rows.length === 0 || o.rows[0].user_id !== req.userId) {
      res.status(404).json({ message: "Order not found" });
      return;
    }
    const order = o.rows[0];
    if (["paid", "shipped", "delivered"].includes(order.status)) {
      res.json({ status: order.status });
      return;
    }
    if (!order.mid_order_id) {
      res.json({ status: order.status });
      return;
    }
    let txStatus: string;
    try {
      txStatus = await getTransactionStatus(order.mid_order_id);
    } catch {
      res.json({ status: order.status });
      return;
    }
    if (txStatus === "settlement" || txStatus === "capture") {
      await pool.query(
        `UPDATE orders SET status = 'paid', paid_at = now(), updated_at = now()
          WHERE id = $1 AND status = 'ordered'`,
        [id]
      );
      await pool.query(
        `UPDATE payments SET payment_status = 'settlement', updated_at = now()
          WHERE order_id = $1`,
        [order.mid_order_id]
      );
      res.json({ status: "paid" });
      return;
    }
    res.json({ status: order.status });
  } catch (err) {
    console.error("Order verify error:", err);
    res.status(500).json({ message: "Failed to verify order payment" });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// Orders (Wave 9 Phase 5). A student places an order from the storefront;
// operators list + fulfill orders for the competitions they manage.
// ──────────────────────────────────────────────────────────────────────────

function mapOrder(r: any) {
  return {
    id: r.id,
    compId: r.comp_id,
    code: r.code,
    userId: r.user_id,
    status: r.status,
    customerName: r.name ?? null,
    customerPhone: r.phone ?? null,
    customerAddress: r.address ?? null,
    subtotal: Number(r.subtotal) || 0,
    discount: Number(r.discount) || 0,
    shipping: Number(r.shipping) || 0,
    total: Number(r.total) || 0,
    trackingNumber: r.tracking_number ?? null,
    note: r.note ?? null,
    ...(r.item_count != null ? { itemCount: Number(r.item_count) } : {}),
    ...(r.buyer_name !== undefined ? { buyerName: r.buyer_name, buyerEmail: r.buyer_email } : {}),
    ...(r.comp_name !== undefined ? { compName: r.comp_name } : {}),
    orderedAt: r.ordered_at,
    paidAt: r.paid_at,
    shippedAt: r.shipped_at,
    deliveredAt: r.delivered_at,
    canceledAt: r.canceled_at,
    createdAt: r.created_at,
  };
}

async function loadOrderItems(orderId: string) {
  const r = await pool.query(
    `SELECT id, product_id, description, size, quantity, price, subtotal
       FROM order_items
      WHERE order_id = $1 AND deleted_at IS NULL
      ORDER BY created_at ASC`,
    [orderId]
  );
  return r.rows.map((i) => ({
    id: i.id,
    productId: i.product_id,
    description: i.description ?? null,
    size: i.size ?? null,
    quantity: i.quantity,
    price: Number(i.price) || 0,
    subtotal: Number(i.subtotal) || 0,
  }));
}

// Valid order-status transitions for the operator fulfillment flow.
const ORDER_TRANSITIONS: Record<string, string[]> = {
  ordered: ["canceled"],
  paid: ["shipped", "canceled"],
  shipped: ["delivered"],
  delivered: [],
  canceled: [],
};

// ── POST /api/commerce/orders ─────────────────────────────────────────────
// A student places a merchandise order. Products must be live + active and
// belong to the competition; the server prices the order (never trusts the
// client's prices).
router.post(
  "/commerce/orders",
  audit({ action: "order.create", resourceType: "order" }),
  async (req: Request, res: Response) => {
    const client = await pool.connect();
    try {
      const compId = String(req.body?.compId ?? "");
      const items = Array.isArray(req.body?.items) ? req.body.items : [];
      if (!compId || items.length === 0) {
        res.status(400).json({ message: "compId and at least one item are required" });
        return;
      }
      const productIds = items.map((it: any) => String(it.productId));
      const prods = await client.query(
        `SELECT id, name, price FROM products
          WHERE id = ANY($1::uuid[]) AND comp_id = $2 AND active = true AND deleted_at IS NULL`,
        [productIds, compId]
      );
      const byId = new Map(prods.rows.map((p) => [p.id, p]));

      let subtotal = 0;
      const lines = items.map((it: any) => {
        const p = byId.get(String(it.productId));
        if (!p) throw { _client: true, message: "A product in your cart is no longer available." };
        const quantity = Math.max(1, Math.floor(Number(it.quantity) || 1));
        const lineSub = (Number(p.price) || 0) * quantity;
        subtotal += lineSub;
        return {
          productId: p.id,
          description: p.name,
          size: trim(it.size),
          quantity,
          price: Number(p.price) || 0,
          subtotal: lineSub,
        };
      });
      const total = subtotal;

      await client.query("BEGIN");
      const count = await client.query("SELECT COUNT(*)::int n FROM orders WHERE comp_id = $1", [compId]);
      const code = `ORD-${String(count.rows[0].n + 1).padStart(3, "0")}`;
      const orderRow = await client.query(
        `INSERT INTO orders
           (comp_id, code, user_id, name, phone, address,
            subtotal, discount, shipping, total, status, ordered_at, expires_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,0,0,$8,'ordered',now(),now() + interval '24 hours')
         RETURNING *`,
        [
          compId, code, req.userId,
          trim(req.body?.name), trim(req.body?.phone), trim(req.body?.address),
          subtotal, total,
        ]
      );
      const order = orderRow.rows[0];

      const params: unknown[] = [compId, order.id];
      const rowsSql = lines.map((ln: any) => {
        const b = params.length + 1;
        params.push(ln.productId, ln.description, ln.size, ln.quantity, ln.price, ln.subtotal);
        return `($1, $2, $${b}, $${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, 0, $${b + 5})`;
      });
      await client.query(
        `INSERT INTO order_items
           (comp_id, order_id, product_id, description, size, quantity, price, discount, subtotal)
         VALUES ${rowsSql.join(",")}`,
        params
      );
      await client.query("COMMIT");
      res.status(201).json({ ...mapOrder(order), items: await loadOrderItems(order.id) });
    } catch (err: any) {
      await client.query("ROLLBACK").catch(() => {});
      if (err?._client) {
        res.status(400).json({ message: err.message });
        return;
      }
      console.error("Create order error:", err);
      res.status(500).json({ message: "Failed to place order" });
    } finally {
      client.release();
    }
  }
);

// ── GET /api/commerce/orders?compId=&status=&page= ────────────────────────
// Operator view — the orders of a competition the caller manages.
router.get("/commerce/orders", async (req: Request, res: Response) => {
  try {
    const compId = String(req.query.compId ?? "");
    if (!compId || !(await hasCompAccess(req.userId!, req.userRole!, compId))) {
      res.status(403).json({ message: "No access to this competition" });
      return;
    }
    const { limit, offset, page } = pageParams(req);
    const params: unknown[] = [compId];
    let where = `${compFilter("o")} AND ${liveFilter("o")}`;
    if (typeof req.query.status === "string" && req.query.status) {
      params.push(req.query.status);
      where += ` AND o.status = $${params.length}`;
    }
    const total = await pool.query(`SELECT COUNT(*)::int n FROM orders o WHERE ${where}`, params);
    params.push(limit, offset);
    const r = await pool.query(
      `SELECT o.*, u.full_name AS buyer_name, u.email AS buyer_email,
              (SELECT COUNT(*) FROM order_items oi
                WHERE oi.order_id = o.id AND oi.deleted_at IS NULL)::int AS item_count
         FROM orders o
         JOIN users u ON u.id = o.user_id
        WHERE ${where}
        ORDER BY o.created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json({
      orders: r.rows.map(mapOrder),
      pagination: { total: total.rows[0].n, page, limit },
    });
  } catch (err) {
    console.error("List orders error:", err);
    res.status(500).json({ message: "Failed to load orders" });
  }
});

// ── GET /api/commerce/storefront/products?compId= ─────────────────────────
// The student-facing catalog — every active product of a competition. No
// operator gate (any authenticated student may browse a competition's store).
router.get("/commerce/storefront/products", async (req: Request, res: Response) => {
  try {
    const compId = String(req.query.compId ?? "");
    if (!compId) {
      res.status(400).json({ message: "compId is required" });
      return;
    }
    const r = await pool.query(
      `SELECT id, comp_id, code, name, slug, price, description, image, active, created_at
         FROM products
        WHERE comp_id = $1 AND active = true AND deleted_at IS NULL
        ORDER BY created_at DESC`,
      [compId]
    );
    res.json(await Promise.all(r.rows.map(mapProduct)));
  } catch (err) {
    console.error("List storefront products error:", err);
    res.status(500).json({ message: "Failed to load the store" });
  }
});

// ── GET /api/commerce/storefront/orders ───────────────────────────────────
// The caller's own orders, across competitions.
router.get("/commerce/storefront/orders", async (req: Request, res: Response) => {
  try {
    const r = await pool.query(
      `SELECT o.*, c.name AS comp_name,
              (SELECT COUNT(*) FROM order_items oi
                WHERE oi.order_id = o.id AND oi.deleted_at IS NULL)::int AS item_count
         FROM orders o
         JOIN competitions c ON c.id = o.comp_id
        WHERE o.user_id = $1 AND o.deleted_at IS NULL
        ORDER BY o.created_at DESC`,
      [req.userId]
    );
    res.json(r.rows.map(mapOrder));
  } catch (err) {
    console.error("List storefront orders error:", err);
    res.status(500).json({ message: "Failed to load your orders" });
  }
});

// ── GET /api/commerce/orders/:id ──────────────────────────────────────────
// Visible to the order owner or an operator who manages the competition.
router.get("/commerce/orders/:id", async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const r = await pool.query(
      `SELECT o.*, u.full_name AS buyer_name, u.email AS buyer_email, c.name AS comp_name
         FROM orders o
         JOIN users u ON u.id = o.user_id
         JOIN competitions c ON c.id = o.comp_id
        WHERE o.id = $1 AND o.deleted_at IS NULL`,
      [id]
    );
    if (r.rows.length === 0) {
      res.status(404).json({ message: "Order not found" });
      return;
    }
    const order = r.rows[0];
    const isOwner = order.user_id === req.userId;
    if (!isOwner && !(await hasCompAccess(req.userId!, req.userRole!, order.comp_id))) {
      res.status(404).json({ message: "Order not found" });
      return;
    }
    res.json({ ...mapOrder(order), items: await loadOrderItems(id) });
  } catch (err) {
    console.error("Get order error:", err);
    res.status(500).json({ message: "Failed to load the order" });
  }
});

// ── PUT /api/commerce/orders/:id/status ───────────────────────────────────
// Operator fulfillment — ship (needs a tracking number) / deliver / cancel.
router.put(
  "/commerce/orders/:id/status",
  audit({ action: "order.status", resourceType: "order", resourceIdParam: "id" }),
  async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      const r = await pool.query(
        "SELECT comp_id, status FROM orders WHERE id = $1 AND deleted_at IS NULL",
        [id]
      );
      if (r.rows.length === 0) {
        res.status(404).json({ message: "Order not found" });
        return;
      }
      const { comp_id, status: current } = r.rows[0];
      if (!(await hasCompAccess(req.userId!, req.userRole!, comp_id))) {
        res.status(404).json({ message: "Order not found" });
        return;
      }
      const next = String(req.body?.status ?? "");
      if (!ORDER_TRANSITIONS[current]?.includes(next)) {
        res.status(400).json({ message: `Cannot move an order from "${current}" to "${next}".` });
        return;
      }
      const trackingNumber = trim(req.body?.trackingNumber);
      if (next === "shipped" && !trackingNumber) {
        res.status(400).json({ message: "A tracking number is required to ship an order." });
        return;
      }
      const tsCol =
        next === "shipped" ? "shipped_at" : next === "delivered" ? "delivered_at" : "canceled_at";
      const updated = await pool.query(
        `UPDATE orders
            SET status = $1, ${tsCol} = now(),
                tracking_number = COALESCE($2, tracking_number),
                note = COALESCE($3, note),
                updated_at = now()
          WHERE id = $4
        RETURNING *`,
        [next, next === "shipped" ? trackingNumber : null, trim(req.body?.note), id]
      );
      res.json({ ...mapOrder(updated.rows[0]), items: await loadOrderItems(id) });
    } catch (err) {
      console.error("Update order status error:", err);
      res.status(500).json({ message: "Failed to update the order" });
    }
  }
);

export default router;
