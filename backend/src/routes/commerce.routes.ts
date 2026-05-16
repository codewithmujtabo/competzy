import { Router, Request, Response } from "express";
import multer from "multer";
import { pool } from "../config/database";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/require-role";
import { audit } from "../middleware/audit";
import { liveFilter, compFilter, softDelete } from "../db/query-helpers";
import { hasCompAccess } from "../services/comp-access.service";
import { storeFile, getSignedUrl } from "../services/storage.service";

// Commerce API (EMC Wave 9). The `/commerce/*` namespace is operator-facing —
// admin + organizer, native competitions only (the `hasCompAccess` gate).
// Mounted at bare /api with a path-scoped guard so it never 403s fall-through
// traffic. (The student `/storefront/*` routes arrive in Phase 6.)

const router = Router();
router.use("/commerce", authMiddleware);
router.use("/commerce", requireRole("admin", "organizer"));

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

export default router;
