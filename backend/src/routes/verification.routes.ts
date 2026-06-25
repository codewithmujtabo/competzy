import { Router, Request, Response } from "express";
import { pool } from "../config/database";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/require-role";
import { audit } from "../middleware/audit";
import * as pushService from "../services/push.service";

// ── Account verification queue ────────────────────────────────────────────
// Admins AND organizers review the two self-signup account types that require
// approval before their portal unlocks: schools (Sprint 16) and teachers
// (signup role selector). The admin portal already had school-only endpoints
// under /api/admin/schools/* ; this unified namespace adds teachers and opens
// both to organizers so the queue lives in both portals ("update everywhere").
const router: Router = Router();
router.use(authMiddleware, requireRole("admin", "organizer"));

// ── Schools ───────────────────────────────────────────────────────────────

// GET /api/verification/schools/pending
router.get("/verification/schools/pending", async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT s.id, s.npsn, s.name, s.city, s.province, s.address,
              s.verification_status, s.verification_letter_url,
              s.applied_at, s.rejection_reason,
              u.id        AS applicant_user_id,
              u.full_name AS applicant_name,
              u.email     AS applicant_email,
              u.phone     AS applicant_phone
         FROM schools s
    LEFT JOIN users  u ON u.id = s.applied_by_user_id
        WHERE s.verification_status IN ('pending_verification', 'rejected')
        ORDER BY s.applied_at DESC NULLS LAST`
    );
    res.json(result.rows.map((r) => ({
      id: r.id,
      npsn: r.npsn,
      name: r.name,
      city: r.city,
      province: r.province,
      address: r.address,
      verificationStatus: r.verification_status,
      verificationLetterUrl: r.verification_letter_url,
      appliedAt: r.applied_at,
      rejectionReason: r.rejection_reason,
      applicant: r.applicant_user_id
        ? { id: r.applicant_user_id, name: r.applicant_name, email: r.applicant_email, phone: r.applicant_phone }
        : null,
    })));
  } catch (err) {
    console.error("Pending schools list error:", err);
    res.status(500).json({ message: "Failed to load pending schools" });
  }
});

// POST /api/verification/schools/:id/verify
router.post("/verification/schools/:id/verify",
  audit({ action: "verification.school.verify", resourceType: "school", resourceIdParam: "id" }),
  async (req: Request, res: Response) => {
    try {
      const result = await pool.query(
        `UPDATE schools
            SET verification_status = 'verified', verified_at = now(),
                verified_by_user_id = $1, rejection_reason = NULL
          WHERE id = $2 AND verification_status <> 'verified'
          RETURNING id, name, applied_by_user_id`,
        [req.userId, req.params.id]
      );
      if (result.rows.length === 0) {
        res.status(404).json({ message: "Pending school not found (or already verified)" });
        return;
      }
      const { applied_by_user_id, name, id } = result.rows[0];
      if (applied_by_user_id) {
        await pushService.sendPushNotification(
          applied_by_user_id,
          "School Verified",
          `Your school "${name}" has been verified. You can now access the school portal.`,
          { type: "school_verified", schoolId: id }
        );
      }
      res.json({ message: "School verified" });
    } catch (err) {
      console.error("Verify school error:", err);
      res.status(500).json({ message: "Failed to verify school" });
    }
  }
);

// POST /api/verification/schools/:id/reject
router.post("/verification/schools/:id/reject",
  audit({ action: "verification.school.reject", resourceType: "school", resourceIdParam: "id" }),
  async (req: Request, res: Response) => {
    try {
      const reason = (req.body?.reason as string | undefined)?.trim();
      if (!reason) {
        res.status(400).json({ message: "reason is required" });
        return;
      }
      const result = await pool.query(
        `UPDATE schools
            SET verification_status = 'rejected', rejection_reason = $1,
                verified_at = NULL, verified_by_user_id = NULL
          WHERE id = $2 AND verification_status = 'pending_verification'
          RETURNING id, name, applied_by_user_id`,
        [reason, req.params.id]
      );
      if (result.rows.length === 0) {
        res.status(404).json({ message: "Pending school not found" });
        return;
      }
      const { applied_by_user_id, name, id } = result.rows[0];
      if (applied_by_user_id) {
        await pushService.sendPushNotification(
          applied_by_user_id,
          "School Application Rejected",
          `Your application for "${name}" was rejected. Reason: ${reason}`,
          { type: "school_rejected", schoolId: id, reason }
        );
      }
      res.json({ message: "School application rejected" });
    } catch (err) {
      console.error("Reject school error:", err);
      res.status(500).json({ message: "Failed to reject school" });
    }
  }
);

// ── Teachers ──────────────────────────────────────────────────────────────
// A teacher's row in `teachers` shares its id with the user (teachers.id =
// users.id), so the applicant IS the teacher.

// GET /api/verification/teachers/pending
router.get("/verification/teachers/pending", async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT t.id, t.school, t.subject, t.npsn,
              t.verification_status, t.applied_at, t.rejection_reason,
              u.full_name AS applicant_name,
              u.email     AS applicant_email,
              u.phone     AS applicant_phone
         FROM teachers t
         JOIN users   u ON u.id = t.id
        WHERE t.verification_status IN ('pending_verification', 'rejected')
          AND u.deleted_at IS NULL
        ORDER BY t.applied_at DESC NULLS LAST`
    );
    res.json(result.rows.map((r) => ({
      id: r.id,
      school: r.school,
      subject: r.subject,
      npsn: r.npsn,
      verificationStatus: r.verification_status,
      appliedAt: r.applied_at,
      rejectionReason: r.rejection_reason,
      applicant: { id: r.id, name: r.applicant_name, email: r.applicant_email, phone: r.applicant_phone },
    })));
  } catch (err) {
    console.error("Pending teachers list error:", err);
    res.status(500).json({ message: "Failed to load pending teachers" });
  }
});

// POST /api/verification/teachers/:id/verify
router.post("/verification/teachers/:id/verify",
  audit({ action: "verification.teacher.verify", resourceType: "teacher", resourceIdParam: "id" }),
  async (req: Request, res: Response) => {
    try {
      const result = await pool.query(
        `UPDATE teachers
            SET verification_status = 'verified', verified_at = now(),
                verified_by_user_id = $1, rejection_reason = NULL
          WHERE id = $2 AND verification_status <> 'verified'
          RETURNING id, school`,
        [req.userId, req.params.id]
      );
      if (result.rows.length === 0) {
        res.status(404).json({ message: "Pending teacher not found (or already verified)" });
        return;
      }
      const { id, school } = result.rows[0];
      await pushService.sendPushNotification(
        id,
        "Teacher Account Verified",
        `Your teacher account${school ? ` at "${school}"` : ""} has been verified. You can now access the teacher portal.`,
        { type: "teacher_verified" }
      );
      res.json({ message: "Teacher verified" });
    } catch (err) {
      console.error("Verify teacher error:", err);
      res.status(500).json({ message: "Failed to verify teacher" });
    }
  }
);

// POST /api/verification/teachers/:id/reject
router.post("/verification/teachers/:id/reject",
  audit({ action: "verification.teacher.reject", resourceType: "teacher", resourceIdParam: "id" }),
  async (req: Request, res: Response) => {
    try {
      const reason = (req.body?.reason as string | undefined)?.trim();
      if (!reason) {
        res.status(400).json({ message: "reason is required" });
        return;
      }
      const result = await pool.query(
        `UPDATE teachers
            SET verification_status = 'rejected', rejection_reason = $1,
                verified_at = NULL, verified_by_user_id = NULL
          WHERE id = $2 AND verification_status = 'pending_verification'
          RETURNING id`,
        [reason, req.params.id]
      );
      if (result.rows.length === 0) {
        res.status(404).json({ message: "Pending teacher not found" });
        return;
      }
      await pushService.sendPushNotification(
        result.rows[0].id,
        "Teacher Application Rejected",
        `Your teacher account application was rejected. Reason: ${reason}`,
        { type: "teacher_rejected", reason }
      );
      res.json({ message: "Teacher application rejected" });
    } catch (err) {
      console.error("Reject teacher error:", err);
      res.status(500).json({ message: "Failed to reject teacher" });
    }
  }
);

export default router;
