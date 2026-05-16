import { Router, Request, Response } from "express";
import { pool } from "../config/database";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/require-role";
import { audit } from "../middleware/audit";
import { liveFilter, compFilter, softDelete } from "../db/query-helpers";
import { hasCompAccess } from "../services/comp-access.service";

// Marketing API (EMC Wave 10). `/marketing/*` is operator-facing — admin +
// organizer, native competitions only (the `hasCompAccess` gate); mounted at
// bare /api with a path-scoped guard so it never 403s fall-through traffic.
// The referral attribution endpoints (`/referrals/click`, `/referrals/signup`)
// are public / student-facing and sit OUTSIDE the /marketing namespace.

const router = Router();
router.use("/marketing", authMiddleware);
router.use("/marketing", requireRole("admin", "organizer"));

function pageParams(req: Request): { limit: number; offset: number; page: number } {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  return { limit, offset: (page - 1) * limit, page };
}

const trim = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null;

// A referral code is shared in a URL — keep it readable + URL-safe.
function normCode(s: string): string {
  return s.toUpperCase().trim().replace(/[^A-Z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32);
}

function mapReferral(r: any) {
  return {
    id: r.id,
    compId: r.comp_id,
    name: r.name,
    email: r.email ?? null,
    phone: r.phone ?? null,
    code: r.code,
    year: r.year ?? null,
    commissionPerPaid: r.commission_per_paid != null ? Number(r.commission_per_paid) : 0,
    click: r.click ?? 0,
    account: r.account ?? 0,
    registration: r.registration ?? 0,
    paid: r.paid ?? 0,
    commission: r.commission != null ? Number(r.commission) : 0,
    bonus: r.bonus != null ? Number(r.bonus) : 0,
    total: r.total != null ? Number(r.total) : 0,
    createdAt: r.created_at,
  };
}

async function referralCompIfAccessible(req: Request, id: string): Promise<string | null> {
  const r = await pool.query(
    "SELECT comp_id FROM referrals WHERE id = $1 AND deleted_at IS NULL",
    [id]
  );
  if (r.rows.length === 0) return null;
  const compId = r.rows[0].comp_id as string;
  return (await hasCompAccess(req.userId!, req.userRole!, compId)) ? compId : null;
}

// ── GET /api/marketing/referrals?compId=&search=&page= ────────────────────
router.get("/marketing/referrals", async (req: Request, res: Response) => {
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
      where += ` AND (name ILIKE $${params.length} OR code ILIKE $${params.length} OR email ILIKE $${params.length})`;
    }
    const total = await pool.query(`SELECT COUNT(*)::int n FROM referrals WHERE ${where}`, params);
    params.push(limit, offset);
    const r = await pool.query(
      `SELECT * FROM referrals WHERE ${where}
        ORDER BY created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json({
      referrals: r.rows.map(mapReferral),
      pagination: { total: total.rows[0].n, page, limit },
    });
  } catch (err) {
    console.error("List referrals error:", err);
    res.status(500).json({ message: "Failed to load referrals" });
  }
});

// ── GET /api/marketing/referrals/:id ──────────────────────────────────────
router.get("/marketing/referrals/:id", async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    if (!(await referralCompIfAccessible(req, id))) {
      res.status(404).json({ message: "Referral not found" });
      return;
    }
    const r = await pool.query("SELECT * FROM referrals WHERE id = $1", [id]);
    res.json(mapReferral(r.rows[0]));
  } catch (err) {
    console.error("Get referral error:", err);
    res.status(500).json({ message: "Failed to load the referral" });
  }
});

// ── POST /api/marketing/referrals ─────────────────────────────────────────
router.post(
  "/marketing/referrals",
  audit({ action: "referral.create", resourceType: "referral" }),
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
      const custom = trim(req.body?.code);
      let code = custom ? normCode(custom) : "";
      if (!code) {
        const count = await pool.query("SELECT COUNT(*)::int n FROM referrals WHERE comp_id = $1", [compId]);
        code = `REF-${String(count.rows[0].n + 1).padStart(3, "0")}`;
      }
      const rate = Number(req.body?.commissionPerPaid);
      const year = Number(req.body?.year);
      const inserted = await pool.query(
        `INSERT INTO referrals (comp_id, name, email, phone, code, year, commission_per_paid)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [
          compId, name, trim(req.body?.email), trim(req.body?.phone), code,
          Number.isFinite(year) && year > 0 ? year : null,
          Number.isFinite(rate) && rate >= 0 ? rate : 0,
        ]
      );
      res.status(201).json(mapReferral(inserted.rows[0]));
    } catch (err: any) {
      if (err?.code === "23505") {
        res.status(409).json({ message: "A referral with this code already exists" });
        return;
      }
      console.error("Create referral error:", err);
      res.status(500).json({ message: "Failed to create referral" });
    }
  }
);

// ── PUT /api/marketing/referrals/:id ──────────────────────────────────────
router.put(
  "/marketing/referrals/:id",
  audit({ action: "referral.update", resourceType: "referral", resourceIdParam: "id" }),
  async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      if (!(await referralCompIfAccessible(req, id))) {
        res.status(404).json({ message: "Referral not found" });
        return;
      }
      const name = trim(req.body?.name);
      if (!name) {
        res.status(400).json({ message: "name is required" });
        return;
      }
      const rate = Number(req.body?.commissionPerPaid);
      const bonus = Number(req.body?.bonus);
      const year = Number(req.body?.year);
      // `total` = accrued commission + bonus; keep it consistent on edit.
      const updated = await pool.query(
        `UPDATE referrals
            SET name=$1, email=$2, phone=$3,
                commission_per_paid=$4, bonus=$5, year=$6,
                total = commission + $5, updated_at=now()
          WHERE id=$7 AND deleted_at IS NULL
        RETURNING *`,
        [
          name, trim(req.body?.email), trim(req.body?.phone),
          Number.isFinite(rate) && rate >= 0 ? rate : 0,
          Number.isFinite(bonus) && bonus >= 0 ? bonus : 0,
          Number.isFinite(year) && year > 0 ? year : null,
          id,
        ]
      );
      res.json(mapReferral(updated.rows[0]));
    } catch (err) {
      console.error("Update referral error:", err);
      res.status(500).json({ message: "Failed to update referral" });
    }
  }
);

// ── DELETE /api/marketing/referrals/:id ───────────────────────────────────
router.delete(
  "/marketing/referrals/:id",
  audit({ action: "referral.delete", resourceType: "referral", resourceIdParam: "id" }),
  async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      if (!(await referralCompIfAccessible(req, id))) {
        res.status(404).json({ message: "Referral not found" });
        return;
      }
      await softDelete("referrals", id);
      res.json({ message: "Referral removed" });
    } catch (err) {
      console.error("Delete referral error:", err);
      res.status(500).json({ message: "Failed to delete referral" });
    }
  }
);

// ──────────────────────────────────────────────────────────────────────────
// Referral attribution — public / student-facing, OUTSIDE the /marketing
// operator namespace. Each is best-effort: a bad code is silently ignored so
// a tampered ?ref= link never breaks the register page.
// ──────────────────────────────────────────────────────────────────────────

// ── POST /api/referrals/click ─────────────────────────────────────────────
// Public — logged when a visitor lands on a ?ref= link.
router.post("/referrals/click", async (req: Request, res: Response) => {
  try {
    const compId = trim(req.body?.compId);
    const code = trim(req.body?.code);
    if (!compId || !code) {
      res.status(400).json({ message: "compId and code are required" });
      return;
    }
    const ref = await pool.query(
      "SELECT id FROM referrals WHERE comp_id = $1 AND code = $2 AND deleted_at IS NULL",
      [compId, normCode(code)]
    );
    if (ref.rows.length > 0) {
      const refId = ref.rows[0].id;
      await pool.query(
        `INSERT INTO clicks (comp_id, referral_id, ip, user_agent, http_referer)
         VALUES ($1,$2,$3,$4,$5)`,
        [
          compId, refId,
          req.ip ?? null,
          (req.headers["user-agent"] ?? null) as string | null,
          (req.headers["referer"] ?? null) as string | null,
        ]
      );
      await pool.query("UPDATE referrals SET click = click + 1, updated_at = now() WHERE id = $1", [refId]);
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("Referral click error:", err);
    res.json({ ok: true }); // never break the visitor's page over analytics
  }
});

// ── POST /api/referrals/signup ────────────────────────────────────────────
// Called once by the register page after a new account signs up via ?ref=.
router.post("/referrals/signup", authMiddleware, async (req: Request, res: Response) => {
  try {
    const compId = trim(req.body?.compId);
    const code = trim(req.body?.code);
    if (compId && code) {
      await pool.query(
        `UPDATE referrals SET account = account + 1, updated_at = now()
          WHERE comp_id = $1 AND code = $2 AND deleted_at IS NULL`,
        [compId, normCode(code)]
      );
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("Referral signup error:", err);
    res.json({ ok: true });
  }
});

export default router;
