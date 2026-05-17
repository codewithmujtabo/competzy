import { Router, Request, Response } from "express";
import { pool } from "../config/database";
import { renderCertificatePdf } from "../services/certificate-pdf.service";

// Certificate API (EMC Wave 12). Mounted at /api, BEFORE the bare-/api routers
// that carry a router-level authMiddleware — so the PUBLIC /certificates/verify
// endpoints are reached before those routers 401 unauthenticated fall-through
// traffic (the same mount-order rule as marketing.routes.ts).
//
// Phase 2 — the public verification surface. No auth: the `verification_code`
// (in the QR code) IS the capability.
//   GET /api/certificates/verify/:code        certificate metadata as JSON
//   GET /api/certificates/verify/:code/pdf    the certificate PDF
//
// Operator (/certificates/manage/*) and student (/certificates/mine) routes are
// added in later phases.

const router = Router();

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

async function loadByCode(code: string) {
  const r = await pool.query(
    `SELECT * FROM certificates WHERE verification_code = $1 AND deleted_at IS NULL LIMIT 1`,
    [code]
  );
  return r.rows[0] ?? null;
}

// ── GET /api/certificates/verify/:code — public certificate metadata ──────
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

// ── GET /api/certificates/verify/:code/pdf — public certificate PDF ───────
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

export default router;
