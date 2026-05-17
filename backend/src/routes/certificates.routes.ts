import { Router, Request, Response } from "express";
import { pool } from "../config/database";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/require-role";
import { audit } from "../middleware/audit";
import { liveFilter, compFilter, softDelete } from "../db/query-helpers";
import { hasCompAccess } from "../services/comp-access.service";
import { backfillCertificates } from "../services/certificate.service";
import { renderCertificatePdf } from "../services/certificate-pdf.service";

// Certificate API (EMC Wave 12). Mounted at /api, BEFORE the bare-/api routers
// that carry a router-level authMiddleware — so the PUBLIC /certificates/verify
// endpoints are reached before those routers 401 unauthenticated fall-through
// traffic (the same mount-order rule as marketing.routes.ts).
//
//   PUBLIC (no auth — the verification_code IS the capability):
//     GET  /api/certificates/verify/:code        certificate metadata as JSON
//     GET  /api/certificates/verify/:code/pdf    the certificate PDF
//   OPERATOR (/certificates/manage/* — path-scoped admin + organizer guard):
//     GET    /certificates/manage/competitions   native comps the caller manages
//     GET    /certificates/manage?compId=&...    paginated list
//     PUT    /certificates/manage/:id            edit award label / score
//     POST   /certificates/manage/:id/revoke|restore
//     DELETE /certificates/manage/:id            soft-delete
//     POST   /certificates/manage/backfill?compId=

const router = Router();

const trim = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null;

function pageParams(req: Request): { limit: number; offset: number; page: number } {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  return { limit, offset: (page - 1) * limit, page };
}

// The fields exposed to the public verify page — never the internal ids.
function publicView(row: any) {
  return {
    valid: true,
    revoked: row.revoked_at != null,
    type: row.type,
    awardLabel: row.award_label ?? null,
    studentName: row.student_name,
    competitionName: row.competition_name,
    grade: row.grade ?? null,
    score: row.score != null ? Number(row.score) : null,
    scoreMax: row.score_max != null ? Number(row.score_max) : null,
    certificateNumber: row.certificate_number,
    issuedAt: row.issued_at,
  };
}

// The fuller operator/owner view.
function mapCertificate(r: any) {
  return {
    id: r.id,
    compId: r.comp_id,
    certificateNumber: r.certificate_number,
    verificationCode: r.verification_code,
    type: r.type,
    awardLabel: r.award_label ?? null,
    studentName: r.student_name,
    competitionName: r.competition_name,
    grade: r.grade ?? null,
    score: r.score != null ? Number(r.score) : null,
    scoreMax: r.score_max != null ? Number(r.score_max) : null,
    scoreLocked: !!r.score_locked,
    issuedAt: r.issued_at,
    revokedAt: r.revoked_at ?? null,
  };
}

async function loadByCode(code: string) {
  const r = await pool.query(
    `SELECT * FROM certificates WHERE verification_code = $1 AND deleted_at IS NULL LIMIT 1`,
    [code]
  );
  return r.rows[0] ?? null;
}

// ──────────────────────────────────────────────────────────────────────────
// PUBLIC — certificate verification
// ──────────────────────────────────────────────────────────────────────────

// GET /api/certificates/verify/:code — public certificate metadata.
router.get("/certificates/verify/:code", async (req: Request, res: Response) => {
  try {
    const row = await loadByCode(String(req.params.code));
    if (!row) {
      res.status(404).json({ valid: false, message: "Certificate not found" });
      return;
    }
    res.json(publicView(row));
  } catch (err) {
    console.error("Verify certificate error:", err);
    res.status(500).json({ message: "Failed to verify the certificate" });
  }
});

// GET /api/certificates/verify/:code/pdf — public certificate PDF.
router.get("/certificates/verify/:code/pdf", async (req: Request, res: Response) => {
  try {
    const row = await loadByCode(String(req.params.code));
    if (!row) {
      res.status(404).json({ message: "Certificate not found" });
      return;
    }
    const pdf = await renderCertificatePdf({
      certificateNumber: row.certificate_number,
      verificationCode: row.verification_code,
      type: row.type,
      awardLabel: row.award_label ?? null,
      studentName: row.student_name,
      competitionName: row.competition_name,
      grade: row.grade ?? null,
      score: row.score != null ? Number(row.score) : null,
      scoreMax: row.score_max != null ? Number(row.score_max) : null,
      issuedAt: row.issued_at,
      revoked: row.revoked_at != null,
    });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="certificate-${row.certificate_number}.pdf"`
    );
    res.send(pdf);
  } catch (err) {
    console.error("Certificate PDF error:", err);
    if (!res.headersSent) res.status(500).json({ message: "Failed to render the certificate" });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// OPERATOR — /certificates/manage/* (admin + organizer, native comps only)
// ──────────────────────────────────────────────────────────────────────────

router.use("/certificates/manage", authMiddleware);
router.use("/certificates/manage", requireRole("admin", "organizer"));

// The certificate's comp_id if the caller may manage it, else null.
async function certCompIfAccessible(req: Request, id: string): Promise<string | null> {
  const r = await pool.query(
    "SELECT comp_id FROM certificates WHERE id = $1 AND deleted_at IS NULL",
    [id]
  );
  if (r.rows.length === 0) return null;
  const compId = r.rows[0].comp_id as string;
  return (await hasCompAccess(req.userId!, req.userRole!, compId)) ? compId : null;
}

// GET /api/certificates/manage/competitions — native comps the caller manages.
router.get("/certificates/manage/competitions", async (req: Request, res: Response) => {
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
    console.error("List certificate competitions error:", err);
    res.status(500).json({ message: "Failed to load competitions" });
  }
});

// GET /api/certificates/manage?compId=&search=&page= — paginated list.
router.get("/certificates/manage", async (req: Request, res: Response) => {
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
      where += ` AND (student_name ILIKE $${params.length} OR certificate_number ILIKE $${params.length})`;
    }
    const total = await pool.query(`SELECT COUNT(*)::int n FROM certificates WHERE ${where}`, params);
    params.push(limit, offset);
    const r = await pool.query(
      `SELECT * FROM certificates WHERE ${where}
        ORDER BY issued_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json({
      certificates: r.rows.map(mapCertificate),
      pagination: { total: total.rows[0].n, page, limit },
    });
  } catch (err) {
    console.error("List certificates error:", err);
    res.status(500).json({ message: "Failed to load certificates" });
  }
});

// PUT /api/certificates/manage/:id — edit the award label + score.
// Setting an award label promotes the certificate to 'achievement'; clearing it
// reverts to 'participation'. Editing the score locks it from backfill sync.
router.put(
  "/certificates/manage/:id",
  audit({ action: "certificate.update", resourceType: "certificate", resourceIdParam: "id" }),
  async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      if (!(await certCompIfAccessible(req, id))) {
        res.status(404).json({ message: "Certificate not found" });
        return;
      }
      const body = req.body ?? {};
      const sets: string[] = [];
      const params: unknown[] = [];
      const has = (k: string) => Object.prototype.hasOwnProperty.call(body, k);
      const toNum = (v: unknown): number | null => {
        if (v === null || v === "" || v === undefined) return null;
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
      };

      if (has("awardLabel")) {
        const label = trim(body.awardLabel);
        params.push(label);
        sets.push(`award_label = $${params.length}`);
        params.push(label ? "achievement" : "participation");
        sets.push(`type = $${params.length}`);
      }
      if (has("score")) {
        params.push(toNum(body.score));
        sets.push(`score = $${params.length}`);
        sets.push(`score_locked = true`);
      }
      if (has("scoreMax")) {
        params.push(toNum(body.scoreMax));
        sets.push(`score_max = $${params.length}`);
      }

      if (sets.length === 0) {
        const cur = await pool.query("SELECT * FROM certificates WHERE id = $1", [id]);
        res.json(mapCertificate(cur.rows[0]));
        return;
      }
      params.push(id);
      const r = await pool.query(
        `UPDATE certificates SET ${sets.join(", ")}, updated_at = now()
          WHERE id = $${params.length} RETURNING *`,
        params
      );
      res.json(mapCertificate(r.rows[0]));
    } catch (err) {
      console.error("Update certificate error:", err);
      res.status(500).json({ message: "Failed to update the certificate" });
    }
  }
);

// POST /api/certificates/manage/:id/revoke — mark the certificate invalid.
router.post(
  "/certificates/manage/:id/revoke",
  audit({ action: "certificate.revoke", resourceType: "certificate", resourceIdParam: "id" }),
  async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      if (!(await certCompIfAccessible(req, id))) {
        res.status(404).json({ message: "Certificate not found" });
        return;
      }
      const r = await pool.query(
        `UPDATE certificates SET revoked_at = COALESCE(revoked_at, now()), updated_at = now()
          WHERE id = $1 RETURNING *`,
        [id]
      );
      res.json(mapCertificate(r.rows[0]));
    } catch (err) {
      console.error("Revoke certificate error:", err);
      res.status(500).json({ message: "Failed to revoke the certificate" });
    }
  }
);

// POST /api/certificates/manage/:id/restore — clear the revoked flag.
router.post(
  "/certificates/manage/:id/restore",
  audit({ action: "certificate.restore", resourceType: "certificate", resourceIdParam: "id" }),
  async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      if (!(await certCompIfAccessible(req, id))) {
        res.status(404).json({ message: "Certificate not found" });
        return;
      }
      const r = await pool.query(
        `UPDATE certificates SET revoked_at = NULL, updated_at = now()
          WHERE id = $1 RETURNING *`,
        [id]
      );
      res.json(mapCertificate(r.rows[0]));
    } catch (err) {
      console.error("Restore certificate error:", err);
      res.status(500).json({ message: "Failed to restore the certificate" });
    }
  }
);

// POST /api/certificates/manage/backfill?compId= — issue missing certs + sync scores.
router.post(
  "/certificates/manage/backfill",
  audit({ action: "certificate.backfill", resourceType: "certificate" }),
  async (req: Request, res: Response) => {
    try {
      const compId = String(req.query.compId ?? req.body?.compId ?? "");
      if (!compId || !(await hasCompAccess(req.userId!, req.userRole!, compId))) {
        res.status(403).json({ message: "No access to this competition" });
        return;
      }
      const result = await backfillCertificates(compId);
      res.json(result);
    } catch (err) {
      console.error("Backfill certificates error:", err);
      res.status(500).json({ message: "Failed to run the backfill" });
    }
  }
);

// DELETE /api/certificates/manage/:id — soft-delete.
router.delete(
  "/certificates/manage/:id",
  audit({ action: "certificate.delete", resourceType: "certificate", resourceIdParam: "id" }),
  async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      if (!(await certCompIfAccessible(req, id))) {
        res.status(404).json({ message: "Certificate not found" });
        return;
      }
      await softDelete("certificates", id);
      res.json({ message: "Certificate removed" });
    } catch (err) {
      console.error("Delete certificate error:", err);
      res.status(500).json({ message: "Failed to delete the certificate" });
    }
  }
);

export default router;
