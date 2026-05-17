import { Router, Request, Response } from "express";
import multer from "multer";
import { pool } from "../config/database";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/require-role";
import { audit } from "../middleware/audit";
import { liveFilter, compFilter, softDelete } from "../db/query-helpers";
import { hasCompAccess } from "../services/comp-access.service";
import { storeFile, getSignedUrl } from "../services/storage.service";
import { sendBatchNotifications } from "../services/push.service";

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

// ──────────────────────────────────────────────────────────────────────────
// Announcements (Wave 10 Phase 3). T2 — comp-scoped OR platform-wide
// (comp_id NULL). The scope `compId` query/body value "platform" means
// platform-wide, which only an admin may manage.
// ──────────────────────────────────────────────────────────────────────────

const assetUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

const PLATFORM = "platform";

// Resolve the requested scope to either platform-wide or a competition the
// caller may manage. Returns { platform } | { compId } | null (forbidden).
async function resolveScope(
  req: Request,
  raw: unknown
): Promise<{ platform: boolean; compId: string | null } | null> {
  const v = typeof raw === "string" ? raw.trim() : "";
  if (!v || v === PLATFORM) {
    return req.userRole === "admin" ? { platform: true, compId: null } : null;
  }
  return (await hasCompAccess(req.userId!, req.userRole!, v))
    ? { platform: false, compId: v }
    : null;
}

async function mapAnnouncement(r: any) {
  return {
    id: r.id,
    compId: r.comp_id ?? null,
    title: r.title,
    body: r.body ?? null,
    type: r.type ?? null,
    image: r.image ? await getSignedUrl(r.image) : null,
    file: r.file ? await getSignedUrl(r.file) : null,
    isActive: r.is_active,
    isFeatured: r.is_featured,
    publishedAt: r.published_at ?? null,
    createdAt: r.created_at,
  };
}

// The recipients of an announcement's "also notify": a competition's
// registrants, or — for a platform-wide post — every student/parent/teacher.
async function announcementRecipients(compId: string | null): Promise<string[]> {
  const r = compId
    ? await pool.query(
        `SELECT DISTINCT user_id AS id FROM registrations
          WHERE comp_id = $1 AND deleted_at IS NULL`,
        [compId]
      )
    : await pool.query(
        `SELECT id FROM users
          WHERE role IN ('student','parent','teacher') AND deleted_at IS NULL`
      );
  return r.rows.map((x) => x.id as string);
}

async function announcementScopeIfAccessible(
  req: Request,
  id: string
): Promise<{ platform: boolean; compId: string | null } | null> {
  const r = await pool.query(
    "SELECT comp_id FROM announcements WHERE id = $1 AND deleted_at IS NULL",
    [id]
  );
  if (r.rows.length === 0) return null;
  return resolveScope(req, r.rows[0].comp_id ?? PLATFORM);
}

// ── GET /api/marketing/announcements?compId= ──────────────────────────────
router.get("/marketing/announcements", async (req: Request, res: Response) => {
  try {
    const scope = await resolveScope(req, req.query.compId);
    if (!scope) {
      res.status(403).json({ message: "No access to this scope" });
      return;
    }
    const r = await pool.query(
      `SELECT * FROM announcements
        WHERE ${scope.platform ? "comp_id IS NULL" : "comp_id = $1"}
          AND deleted_at IS NULL
        ORDER BY is_featured DESC, COALESCE(published_at, created_at) DESC`,
      scope.platform ? [] : [scope.compId]
    );
    res.json(await Promise.all(r.rows.map(mapAnnouncement)));
  } catch (err) {
    console.error("List announcements error:", err);
    res.status(500).json({ message: "Failed to load announcements" });
  }
});

// ── GET /api/marketing/announcements/:id ──────────────────────────────────
router.get("/marketing/announcements/:id", async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    if (!(await announcementScopeIfAccessible(req, id))) {
      res.status(404).json({ message: "Announcement not found" });
      return;
    }
    const r = await pool.query("SELECT * FROM announcements WHERE id = $1", [id]);
    res.json(await mapAnnouncement(r.rows[0]));
  } catch (err) {
    console.error("Get announcement error:", err);
    res.status(500).json({ message: "Failed to load the announcement" });
  }
});

// Fire the optional "also notify" for a just-saved, published announcement.
async function maybeNotify(
  notify: boolean,
  published: boolean,
  compId: string | null,
  title: string
): Promise<void> {
  if (!notify || !published) return;
  const recipients = await announcementRecipients(compId);
  if (recipients.length > 0) {
    await sendBatchNotifications(recipients, "New announcement", title, {
      type: "announcement",
    });
  }
}

// ── POST /api/marketing/announcements ─────────────────────────────────────
router.post(
  "/marketing/announcements",
  audit({ action: "announcement.create", resourceType: "announcement" }),
  async (req: Request, res: Response) => {
    try {
      const scope = await resolveScope(req, req.body?.compId);
      if (!scope) {
        res.status(403).json({ message: "No access to this scope" });
        return;
      }
      const title = trim(req.body?.title);
      if (!title) {
        res.status(400).json({ message: "title is required" });
        return;
      }
      const published = req.body?.published === true;
      const inserted = await pool.query(
        `INSERT INTO announcements
           (comp_id, title, body, type, is_active, is_featured, published_at)
         VALUES ($1,$2,$3,$4,$5,$6, ${published ? "now()" : "NULL"})
         RETURNING *`,
        [
          scope.compId,
          title,
          trim(req.body?.body),
          trim(req.body?.type),
          req.body?.isActive !== false,
          req.body?.isFeatured === true,
        ]
      );
      await maybeNotify(req.body?.notify === true, published, scope.compId, title);
      res.status(201).json(await mapAnnouncement(inserted.rows[0]));
    } catch (err) {
      console.error("Create announcement error:", err);
      res.status(500).json({ message: "Failed to create announcement" });
    }
  }
);

// ── PUT /api/marketing/announcements/:id ──────────────────────────────────
router.put(
  "/marketing/announcements/:id",
  audit({ action: "announcement.update", resourceType: "announcement", resourceIdParam: "id" }),
  async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      const scope = await announcementScopeIfAccessible(req, id);
      if (!scope) {
        res.status(404).json({ message: "Announcement not found" });
        return;
      }
      const title = trim(req.body?.title);
      if (!title) {
        res.status(400).json({ message: "title is required" });
        return;
      }
      const published = req.body?.published === true;
      // published_at: keep the original timestamp once set; clear it if unpublished.
      const updated = await pool.query(
        `UPDATE announcements
            SET title=$1, body=$2, type=$3, is_active=$4, is_featured=$5,
                published_at = ${published ? "COALESCE(published_at, now())" : "NULL"},
                updated_at = now()
          WHERE id=$6 AND deleted_at IS NULL
        RETURNING *`,
        [
          title, trim(req.body?.body), trim(req.body?.type),
          req.body?.isActive !== false, req.body?.isFeatured === true, id,
        ]
      );
      await maybeNotify(req.body?.notify === true, published, scope.compId, title);
      res.json(await mapAnnouncement(updated.rows[0]));
    } catch (err) {
      console.error("Update announcement error:", err);
      res.status(500).json({ message: "Failed to update announcement" });
    }
  }
);

// ── DELETE /api/marketing/announcements/:id ───────────────────────────────
router.delete(
  "/marketing/announcements/:id",
  audit({ action: "announcement.delete", resourceType: "announcement", resourceIdParam: "id" }),
  async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      if (!(await announcementScopeIfAccessible(req, id))) {
        res.status(404).json({ message: "Announcement not found" });
        return;
      }
      await softDelete("announcements", id);
      res.json({ message: "Announcement removed" });
    } catch (err) {
      console.error("Delete announcement error:", err);
      res.status(500).json({ message: "Failed to delete announcement" });
    }
  }
);

// ── POST /api/marketing/announcements/:id/upload?kind=image|file ──────────
router.post(
  "/marketing/announcements/:id/upload",
  assetUpload.single("file"),
  audit({ action: "announcement.upload", resourceType: "announcement", resourceIdParam: "id" }),
  async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      if (!(await announcementScopeIfAccessible(req, id))) {
        res.status(404).json({ message: "Announcement not found" });
        return;
      }
      if (!req.file) {
        res.status(400).json({ message: "No file uploaded" });
        return;
      }
      const kind = req.query.kind === "image" ? "image" : "file";
      if (kind === "image" && !req.file.mimetype.startsWith("image/")) {
        res.status(400).json({ message: "Image must be an image file" });
        return;
      }
      const safeName = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-60);
      const path = await storeFile(
        req.userId!,
        req.file.buffer,
        `announcement-${id}-${Date.now()}-${safeName}`,
        req.file.mimetype
      );
      await pool.query(
        `UPDATE announcements SET ${kind} = $1, updated_at = now() WHERE id = $2`,
        [path, id]
      );
      res.json({ [kind]: await getSignedUrl(path) });
    } catch (err) {
      console.error("Announcement upload error:", err);
      res.status(500).json({ message: "Failed to upload the file" });
    }
  }
);

// ──────────────────────────────────────────────────────────────────────────
// Materials (Wave 10 Phase 5). T2 like announcements — comp-scoped or
// platform-wide (comp_id NULL, admin-only). A study-material library:
// files/images grouped by category, tagged with target grades.
// ──────────────────────────────────────────────────────────────────────────

async function mapMaterial(r: any) {
  return {
    id: r.id,
    compId: r.comp_id ?? null,
    title: r.title,
    body: r.body ?? null,
    type: r.type ?? null,
    category: r.category ?? null,
    grades: Array.isArray(r.grades) ? r.grades : [],
    image: r.image ? await getSignedUrl(r.image) : null,
    file: r.file ? await getSignedUrl(r.file) : null,
    isActive: r.is_active,
    publishedAt: r.published_at ?? null,
    createdAt: r.created_at,
  };
}

const gradesJson = (v: unknown): string =>
  JSON.stringify(Array.isArray(v) ? v.filter((g) => typeof g === "string") : []);

async function materialScopeIfAccessible(
  req: Request,
  id: string
): Promise<{ platform: boolean; compId: string | null } | null> {
  const r = await pool.query(
    "SELECT comp_id FROM materials WHERE id = $1 AND deleted_at IS NULL",
    [id]
  );
  if (r.rows.length === 0) return null;
  return resolveScope(req, r.rows[0].comp_id ?? PLATFORM);
}

// ── GET /api/marketing/materials?compId= ──────────────────────────────────
router.get("/marketing/materials", async (req: Request, res: Response) => {
  try {
    const scope = await resolveScope(req, req.query.compId);
    if (!scope) {
      res.status(403).json({ message: "No access to this scope" });
      return;
    }
    const r = await pool.query(
      `SELECT * FROM materials
        WHERE ${scope.platform ? "comp_id IS NULL" : "comp_id = $1"}
          AND deleted_at IS NULL
        ORDER BY category NULLS LAST, COALESCE(published_at, created_at) DESC`,
      scope.platform ? [] : [scope.compId]
    );
    res.json(await Promise.all(r.rows.map(mapMaterial)));
  } catch (err) {
    console.error("List materials error:", err);
    res.status(500).json({ message: "Failed to load materials" });
  }
});

// ── GET /api/marketing/materials/:id ──────────────────────────────────────
router.get("/marketing/materials/:id", async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    if (!(await materialScopeIfAccessible(req, id))) {
      res.status(404).json({ message: "Material not found" });
      return;
    }
    const r = await pool.query("SELECT * FROM materials WHERE id = $1", [id]);
    res.json(await mapMaterial(r.rows[0]));
  } catch (err) {
    console.error("Get material error:", err);
    res.status(500).json({ message: "Failed to load the material" });
  }
});

// ── POST /api/marketing/materials ─────────────────────────────────────────
router.post(
  "/marketing/materials",
  audit({ action: "material.create", resourceType: "material" }),
  async (req: Request, res: Response) => {
    try {
      const scope = await resolveScope(req, req.body?.compId);
      if (!scope) {
        res.status(403).json({ message: "No access to this scope" });
        return;
      }
      const title = trim(req.body?.title);
      if (!title) {
        res.status(400).json({ message: "title is required" });
        return;
      }
      const published = req.body?.published === true;
      const inserted = await pool.query(
        `INSERT INTO materials
           (comp_id, title, body, type, category, grades, is_active, published_at)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7, ${published ? "now()" : "NULL"})
         RETURNING *`,
        [
          scope.compId, title, trim(req.body?.body), trim(req.body?.type),
          trim(req.body?.category), gradesJson(req.body?.grades),
          req.body?.isActive !== false,
        ]
      );
      res.status(201).json(await mapMaterial(inserted.rows[0]));
    } catch (err) {
      console.error("Create material error:", err);
      res.status(500).json({ message: "Failed to create material" });
    }
  }
);

// ── PUT /api/marketing/materials/:id ──────────────────────────────────────
router.put(
  "/marketing/materials/:id",
  audit({ action: "material.update", resourceType: "material", resourceIdParam: "id" }),
  async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      if (!(await materialScopeIfAccessible(req, id))) {
        res.status(404).json({ message: "Material not found" });
        return;
      }
      const title = trim(req.body?.title);
      if (!title) {
        res.status(400).json({ message: "title is required" });
        return;
      }
      const published = req.body?.published === true;
      const updated = await pool.query(
        `UPDATE materials
            SET title=$1, body=$2, type=$3, category=$4, grades=$5::jsonb, is_active=$6,
                published_at = ${published ? "COALESCE(published_at, now())" : "NULL"},
                updated_at = now()
          WHERE id=$7 AND deleted_at IS NULL
        RETURNING *`,
        [
          title, trim(req.body?.body), trim(req.body?.type), trim(req.body?.category),
          gradesJson(req.body?.grades), req.body?.isActive !== false, id,
        ]
      );
      res.json(await mapMaterial(updated.rows[0]));
    } catch (err) {
      console.error("Update material error:", err);
      res.status(500).json({ message: "Failed to update material" });
    }
  }
);

// ── DELETE /api/marketing/materials/:id ───────────────────────────────────
router.delete(
  "/marketing/materials/:id",
  audit({ action: "material.delete", resourceType: "material", resourceIdParam: "id" }),
  async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      if (!(await materialScopeIfAccessible(req, id))) {
        res.status(404).json({ message: "Material not found" });
        return;
      }
      await softDelete("materials", id);
      res.json({ message: "Material removed" });
    } catch (err) {
      console.error("Delete material error:", err);
      res.status(500).json({ message: "Failed to delete material" });
    }
  }
);

// ── POST /api/marketing/materials/:id/upload?kind=image|file ──────────────
router.post(
  "/marketing/materials/:id/upload",
  assetUpload.single("file"),
  audit({ action: "material.upload", resourceType: "material", resourceIdParam: "id" }),
  async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      if (!(await materialScopeIfAccessible(req, id))) {
        res.status(404).json({ message: "Material not found" });
        return;
      }
      if (!req.file) {
        res.status(400).json({ message: "No file uploaded" });
        return;
      }
      const kind = req.query.kind === "image" ? "image" : "file";
      if (kind === "image" && !req.file.mimetype.startsWith("image/")) {
        res.status(400).json({ message: "Image must be an image file" });
        return;
      }
      const safeName = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-60);
      const path = await storeFile(
        req.userId!,
        req.file.buffer,
        `material-${id}-${Date.now()}-${safeName}`,
        req.file.mimetype
      );
      await pool.query(
        `UPDATE materials SET ${kind} = $1, updated_at = now() WHERE id = $2`,
        [path, id]
      );
      res.json({ [kind]: await getSignedUrl(path) });
    } catch (err) {
      console.error("Material upload error:", err);
      res.status(500).json({ message: "Failed to upload the file" });
    }
  }
);

// ── GET /api/materials?compId= ────────────────────────────────────────────
// Student-facing library — published + active materials for the competition
// plus every platform-wide material.
router.get("/materials", authMiddleware, async (req: Request, res: Response) => {
  try {
    const compId = trim(req.query.compId);
    if (!compId) {
      res.status(400).json({ message: "compId is required" });
      return;
    }
    const r = await pool.query(
      `SELECT * FROM materials
        WHERE (comp_id = $1 OR comp_id IS NULL)
          AND is_active = true AND published_at IS NOT NULL AND deleted_at IS NULL
        ORDER BY category NULLS LAST, published_at DESC`,
      [compId]
    );
    res.json(await Promise.all(r.rows.map(mapMaterial)));
  } catch (err) {
    console.error("Student materials library error:", err);
    res.status(500).json({ message: "Failed to load materials" });
  }
});

// ── GET /api/announcements?compId= ────────────────────────────────────────
// Student-facing feed — published + active announcements for the competition
// plus every platform-wide post. Auth'd (the competition portal is gated).
router.get("/announcements", authMiddleware, async (req: Request, res: Response) => {
  try {
    const compId = trim(req.query.compId);
    if (!compId) {
      res.status(400).json({ message: "compId is required" });
      return;
    }
    const r = await pool.query(
      `SELECT * FROM announcements
        WHERE (comp_id = $1 OR comp_id IS NULL)
          AND is_active = true AND published_at IS NOT NULL AND deleted_at IS NULL
        ORDER BY is_featured DESC, published_at DESC`,
      [compId]
    );
    res.json(await Promise.all(r.rows.map(mapAnnouncement)));
  } catch (err) {
    console.error("Student announcements feed error:", err);
    res.status(500).json({ message: "Failed to load announcements" });
  }
});

export default router;
