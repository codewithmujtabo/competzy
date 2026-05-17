import { Router, Request, Response } from "express";
import { pool } from "../config/database";
import { authMiddleware } from "../middleware/auth";
import * as pushService from "../services/push.service";
import { computeCompleteness } from "../services/readiness.service";

const router = Router();
router.use(authMiddleware);

// ── GET /api/registrations ────────────────────────────────────────────────
router.get("/", async (req: Request, res: Response) => {
  try {
    const { compId } = req.query;
    const values: unknown[] = [req.userId];
    let query = "SELECT * FROM registrations WHERE user_id = $1";
    if (compId) {
      values.push(compId);
      query += ` AND comp_id = $${values.length}`;
    }
    query += " ORDER BY created_at DESC";
    const result = await pool.query(query, values);

    const registrations = result.rows.map((r) => ({
      id: r.id,
      compId: r.comp_id,
      status: r.status,
      meta: r.meta,
      registrationNumber: r.registration_number,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));

    res.json(registrations);
  } catch (err) {
    console.error("List registrations error:", err);
    res.status(500).json({ message: "Failed to fetch registrations" });
  }
});

// ── GET /api/registrations/:id ──────────────────────────────────────────────
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const registrationResult = await pool.query(
      `SELECT
         r.id,
         r.comp_id,
         r.status,
         r.meta,
         r.registration_number,
         r.profile_snapshot,
         r.created_at,
         r.updated_at,
         r.reviewed_at,
         r.rejection_reason,
         c.name as competition_name,
         c.organizer_name,
         c.category,
         c.grade_level,
         c.fee,
         c.description,
         c.detailed_description,
         c.website_url,
         c.competition_date,
         c.reg_close_date,
         c.required_docs,
         c.participant_instructions,
         c.post_payment_redirect_url,
         p.id as payment_id,
         p.payment_status,
         p.payment_method,
         p.amount as payment_amount,
         p.payment_proof_url,
         p.proof_submitted_at
       FROM registrations r
       JOIN competitions c ON c.id = r.comp_id
       LEFT JOIN payments p ON p.registration_id = r.id
       WHERE r.id = $1 AND r.user_id = $2
       ORDER BY p.created_at DESC NULLS LAST
       LIMIT 1`,
      [req.params.id, req.userId]
    );

    if (registrationResult.rows.length === 0) {
      res.status(404).json({ message: "Registration not found" });
      return;
    }

    const row = registrationResult.rows[0];
    const roundsTableExists = await pool.query(
      "SELECT to_regclass('public.competition_rounds') as table_name"
    );
    const hasCompetitionRounds = !!roundsTableExists.rows[0]?.table_name;
    const rounds = hasCompetitionRounds
      ? (
          await pool.query(
            `SELECT
              id,
              round_name,
              round_type,
              start_date,
              registration_deadline,
              exam_date,
              results_date,
              fee,
              location,
              round_order
            FROM competition_rounds
            WHERE comp_id = $1
            ORDER BY round_order ASC, created_at ASC`,
            [row.comp_id]
          )
        ).rows
      : [];

    res.json({
      registration: {
        id: row.id,
        compId: row.comp_id,
        status: row.status,
        meta: row.meta,
        registrationNumber: row.registration_number,
        profileSnapshot: row.profile_snapshot,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        reviewedAt: row.reviewed_at,
        rejectionReason: row.rejection_reason,
        competitionName: row.competition_name,
        competition: {
          id: row.comp_id,
          name: row.competition_name,
          organizerName: row.organizer_name,
          category: row.category,
          gradeLevel: row.grade_level,
          fee: row.fee,
          description: row.description,
          detailedDescription: row.detailed_description,
          websiteUrl: row.website_url,
          competitionDate: row.competition_date,
          regCloseDate: row.reg_close_date,
          requiredDocs: row.required_docs ?? [],
          participantInstructions: row.participant_instructions,
          post_payment_redirect_url: row.post_payment_redirect_url ?? null,
          rounds: rounds.map((round) => ({
            id: round.id,
            roundName: round.round_name,
            roundType: round.round_type,
            startDate: round.start_date,
            registrationDeadline: round.registration_deadline,
            examDate: round.exam_date,
            resultsDate: round.results_date,
            fee: round.fee,
            location: round.location,
            roundOrder: round.round_order,
          })),
        },
        payment: row.payment_id
          ? {
              id: row.payment_id,
              status: row.payment_status,
              method: row.payment_method,
              amount: row.payment_amount,
              proofUrl: row.payment_proof_url,
              proofSubmittedAt: row.proof_submitted_at,
            }
          : null,
      },
    });
  } catch (err) {
    console.error("Get registration detail error:", err);
    res.status(500).json({ message: "Failed to fetch registration detail" });
  }
});

// ── GET /api/registrations/:id/completeness ───────────────────────────────
// Spec F-ID-07: per-requirement readiness check.
// Used by mobile app for pre-payment gating; also powers the web step-flow.
// Returns shape: { registrationId, isReady, checks: { name: { ok, missing? } } }
// The computation lives in services/readiness.service.ts (shared with the
// step-flow GET /registrations/:id/flow-progress endpoint).
router.get("/:id/completeness", async (req: Request, res: Response) => {
  try {
    const result = await computeCompleteness(String(req.params.id));
    if (!result) {
      res.status(404).json({ message: "Registration not found" });
      return;
    }

    // Ownership check: the requester must own this registration, unless they're
    // admin or organizer (organizer ownership is checked elsewhere).
    if (result.userId !== req.userId && req.userRole !== "admin" && req.userRole !== "organizer") {
      res.status(403).json({ message: "Not authorized for this registration" });
      return;
    }

    res.json({
      registrationId: result.registrationId,
      isReady: result.isReady,
      checks: result.checks,
    });
  } catch (err: any) {
    console.error("Completeness check error:", err);
    res.status(500).json({ message: "Failed to compute completeness" });
  }
});

// ── GET /api/registrations/:id/calendar.ics ───────────────────────────────
// Returns a single-event iCalendar file the user can import into Google/Apple/Outlook.
// Spec F-CF-02. Uses the competition_date as the event start; default duration 3 hours
// (most exams) but organisers can extend by adjusting the calendar app afterwards.
router.get("/:id/calendar.ics", async (req: Request, res: Response) => {
  try {
    const reg = await pool.query(
      `SELECT r.id, r.user_id, r.registration_number,
              c.name, c.competition_date, c.organizer_name, c.description, c.website_url
         FROM registrations r
         JOIN competitions  c ON c.id = r.comp_id
        WHERE r.id = $1 AND r.deleted_at IS NULL`,
      [req.params.id]
    );

    if (reg.rows.length === 0) {
      res.status(404).json({ message: "Registration not found" });
      return;
    }
    const row = reg.rows[0];

    if (row.user_id !== req.userId && req.userRole !== "admin" && req.userRole !== "organizer") {
      res.status(403).json({ message: "Not authorized" });
      return;
    }

    if (!row.competition_date) {
      res.status(400).json({ message: "Competition has no scheduled date yet" });
      return;
    }

    // Format helpers (UTC since iCal expects Z-suffixed timestamps for absolute times).
    const start = new Date(row.competition_date);
    const end   = new Date(start.getTime() + 3 * 60 * 60 * 1000); // +3h default
    const fmt = (d: Date) =>
      d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, ""); // 20260710T090000Z

    // Escape iCal-special chars in user-supplied text.
    const esc = (s: string | null | undefined) =>
      (s ?? "")
        .replace(/\\/g, "\\\\")
        .replace(/;/g, "\\;")
        .replace(/,/g, "\\,")
        .replace(/\n/g, "\\n");

    const uid = `${row.id}@competzy.com`;
    const summary = esc(`${row.name} — Competzy`);
    const description = esc(
      `Registration ${row.registration_number ?? row.id}\\n\\n${row.description ?? ""}\\n\\nMore info: ${row.website_url ?? "https://competzy.com"}`
    );

    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Competzy//Registrations//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${fmt(new Date())}`,
      `DTSTART:${fmt(start)}`,
      `DTEND:${fmt(end)}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${description}`,
      `ORGANIZER;CN=${esc(row.organizer_name ?? "Competzy")}:mailto:noreply@competzy.com`,
      "STATUS:CONFIRMED",
      "END:VEVENT",
      "END:VCALENDAR",
      "",
    ].join("\r\n");

    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="competzy-${row.id}.ics"`);
    res.send(ics);
  } catch (err) {
    console.error("ICS export error:", err);
    res.status(500).json({ message: "Failed to generate calendar" });
  }
});

// ── POST /api/registrations ───────────────────────────────────────────────
router.post("/", async (req: Request, res: Response) => {
  try {
    const { id, compId, meta, referralCode } = req.body;

    if (!id || !compId) {
      res.status(400).json({ message: "id and compId are required" });
      return;
    }

    // Look up the competition fee to decide initial status
    const compResult = await pool.query(
      "SELECT fee FROM competitions WHERE id = $1",
      [compId]
    );

    if (compResult.rows.length === 0) {
      res.status(404).json({ message: "Competition not found" });
      return;
    }

    const isFree = compResult.rows[0].fee === 0;
    // Free: skip payment, go straight to admin review
    // Paid: student pays first, then admin reviews
    const initialStatus = isFree ? "pending_review" : "pending_payment";

    // T6: Capture profile snapshot at registration time
    const profileResult = await pool.query(
      `SELECT u.full_name, u.email, u.phone, u.city, u.province, u.role,
              s.school_name AS school, s.grade, s.nisn,
              p.child_name, p.child_school, p.child_grade
       FROM users u
       LEFT JOIN students s ON s.id = u.id
       LEFT JOIN parents p ON p.id = u.id
       WHERE u.id = $1`,
      [req.userId]
    );
    const prof = profileResult.rows[0] ?? {};
    const profileSnapshot = {
      fullName: prof.full_name ?? null,
      email: prof.email ?? null,
      phone: prof.phone ?? null,
      city: prof.city ?? null,
      province: prof.province ?? null,
      role: prof.role ?? null,
      ...(prof.school && { school: prof.school }),
      ...(prof.grade && { grade: prof.grade }),
      ...(prof.nisn && { nisn: prof.nisn }),
      ...(prof.child_name && { childName: prof.child_name }),
      ...(prof.child_school && { childSchool: prof.child_school }),
      ...(prof.child_grade && { childGrade: prof.child_grade }),
    };

    // T5: registration_number is auto-generated by DB sequence via DEFAULT
    // T24: referral_code captured from request body (optional)
    const insertResult = await pool.query(
      `INSERT INTO registrations (id, user_id, comp_id, status, meta, profile_snapshot, referral_code)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING registration_number`,
      [id, req.userId, compId, initialStatus, meta ? JSON.stringify(meta) : null, JSON.stringify(profileSnapshot), referralCode ?? null]
    );
    const registrationNumber = insertResult.rows[0]?.registration_number ?? null;

    // Wave 10: attribute the registration to its referral, if the code matches
    // a live affiliate referral for this competition.
    if (referralCode) {
      await pool.query(
        `UPDATE referrals SET registration = registration + 1, updated_at = now()
          WHERE comp_id = $1 AND code = $2 AND deleted_at IS NULL`,
        [compId, String(referralCode).toUpperCase().trim()]
      );
    }

    // Get competition + student details for notifications
    const detailsResult = await pool.query(
      `SELECT c.name as competition_name, u.full_name as student_name
       FROM competitions c
       JOIN users u ON u.id = $2
       WHERE c.id = $1`,
      [compId, req.userId]
    );
    const competitionName = detailsResult.rows[0]?.competition_name || "Competition";
    const studentName = detailsResult.rows[0]?.student_name || "Your child";

    // Create notification for registration
    const notifBody = isFree
      ? `Your registration for ${competitionName} is under admin review. You'll be notified once it's approved.`
      : `You're registered for ${competitionName}! Complete your payment to submit your application.`;

    await pushService.sendPushNotification(
      req.userId!,
      "Registration Submitted!",
      notifBody,
      {
        type: "registration_created",
        compId,
        registrationId: id,
      }
    );

    const parentIds = await pushService.getActiveParentIdsForStudent(req.userId!);
    if (parentIds.length > 0) {
      await pushService.sendBatchNotifications(
        parentIds,
        "Child Registration Submitted",
        isFree
          ? `${studentName} registered for ${competitionName}. Waiting for admin approval.`
          : `${studentName} registered for ${competitionName}. Payment required to complete registration.`,
        {
          type: "child_registration_created",
          compId,
          registrationId: id,
          studentId: req.userId,
        }
      );
    }

    res.status(201).json({ message: "Registration created", id, status: initialStatus, registrationNumber });
  } catch (err: any) {
    if (err.code === "23505") {
      res.status(409).json({ message: "Registration already exists" });
      return;
    }
    console.error("Create registration error:", err);
    res.status(500).json({ message: "Failed to create registration" });
  }
});

// ── PUT /api/registrations/:id ────────────────────────────────────────────
router.put("/:id", async (req: Request, res: Response) => {
  try {
    const { status } = req.body;

    const result = await pool.query(
      `UPDATE registrations SET status = $1, updated_at = now()
       WHERE id = $2 AND user_id = $3
       RETURNING id`,
      [status, req.params.id, req.userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ message: "Registration not found" });
      return;
    }

    res.json({ message: "Registration updated" });
  } catch (err) {
    console.error("Update registration error:", err);
    res.status(500).json({ message: "Failed to update registration" });
  }
});

// ── DELETE /api/registrations/:id ─────────────────────────────────────────
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      "DELETE FROM registrations WHERE id = $1 AND user_id = $2 RETURNING id",
      [req.params.id, req.userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ message: "Registration not found" });
      return;
    }

    res.json({ message: "Registration deleted" });
  } catch (err) {
    console.error("Delete registration error:", err);
    res.status(500).json({ message: "Failed to delete registration" });
  }
});

export default router;
