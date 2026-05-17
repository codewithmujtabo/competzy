import { Router, Request, Response } from "express";
import multer from "multer";
import { pool } from "../config/database";
import { authMiddleware } from "../middleware/auth";
import { organizerOnly } from "../middleware/organizer.middleware";
import { audit } from "../middleware/audit";
import * as pushService from "../services/push.service";
import { storeFile } from "../services/storage.service";
import { seedDefaultFlow } from "../services/competition-flow.service";

const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
  fileFilter: (_req, file, cb) => {
    const ok = file.mimetype === "text/csv" ||
               file.mimetype === "application/vnd.ms-excel" ||
               file.originalname.endsWith(".csv");
    cb(null, ok);
  },
});

const router = Router();
router.use(authMiddleware);
router.use(organizerOnly);

// Admins bypass ownership checks; organizers only see their own competitions
async function ownsCompetition(compId: string, userId: string, userRole: string): Promise<boolean> {
  if (userRole === "admin") return true;
  const r = await pool.query(
    "SELECT id FROM competitions WHERE id = $1 AND created_by = $2",
    [compId, userId]
  );
  return r.rows.length > 0;
}

// ── GET /api/organizers/me ────────────────────────────────────────────────
router.get("/me", async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT o.id, o.org_name, o.bio, o.website, o.logo_url, o.verified,
              u.full_name, u.email, u.phone, u.city, u.province, u.photo_url
       FROM organizers o
       JOIN users u ON u.id = o.id
       WHERE o.id = $1`,
      [req.userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ message: "Organizer profile not found. Please complete your profile." });
      return;
    }

    const r = result.rows[0];
    res.json({
      id: r.id,
      orgName: r.org_name,
      bio: r.bio,
      website: r.website,
      logoUrl: r.logo_url,
      verified: r.verified,
      fullName: r.full_name,
      email: r.email,
      phone: r.phone,
      city: r.city,
      province: r.province,
      photoUrl: r.photo_url,
    });
  } catch (err) {
    console.error("GET /organizers/me error:", err);
    res.status(500).json({ message: "Failed to fetch organizer profile" });
  }
});

// ── PUT /api/organizers/me ────────────────────────────────────────────────
router.put("/me", audit({ action: "organizer.profile.update", resourceType: "organizer" }), async (req: Request, res: Response) => {
  try {
    const { orgName, bio, website, logoUrl } = req.body;

    // Upsert organizer row
    await pool.query(
      `INSERT INTO organizers (id, org_name, bio, website, logo_url)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET
         org_name  = EXCLUDED.org_name,
         bio       = EXCLUDED.bio,
         website   = EXCLUDED.website,
         logo_url  = EXCLUDED.logo_url,
         updated_at = now()`,
      [req.userId, orgName ?? "", bio ?? "", website ?? "", logoUrl ?? null]
    );

    res.json({ message: "Organizer profile updated" });
  } catch (err) {
    console.error("PUT /organizers/me error:", err);
    res.status(500).json({ message: "Failed to update organizer profile" });
  }
});

// ── GET /api/organizers/competitions ─────────────────────────────────────
router.get("/competitions", async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const userRole = (req as any).userRole;

    const whereClause = userRole === "admin" ? "" : "WHERE c.created_by = $1";
    const params = userRole === "admin" ? [] : [userId];

    const result = await pool.query(
      `SELECT
         c.id, c.name, c.organizer_name, c.category, c.grade_level,
         c.fee, c.quota, c.registration_status, c.is_international,
         c.reg_open_date, c.reg_close_date, c.competition_date,
         c.image_url, c.kind, c.created_at,
         COUNT(r.id)::int AS registration_count
       FROM competitions c
       LEFT JOIN registrations r ON r.comp_id = c.id
       ${whereClause}
       GROUP BY c.id
       ORDER BY c.created_at DESC`,
      params
    );

    res.json(result.rows.map((c) => ({
      id: c.id,
      name: c.name,
      organizerName: c.organizer_name,
      category: c.category,
      gradeLevel: c.grade_level,
      fee: c.fee,
      quota: c.quota,
      registrationStatus: c.registration_status,
      isInternational: c.is_international,
      regOpenDate: c.reg_open_date,
      regCloseDate: c.reg_close_date,
      competitionDate: c.competition_date,
      imageUrl: c.image_url,
      kind: c.kind ?? "native",
      createdAt: c.created_at,
      registrationCount: c.registration_count,
    })));
  } catch (err) {
    console.error("GET /organizers/competitions error:", err);
    res.status(500).json({ message: "Failed to fetch competitions" });
  }
});

// ── POST /api/organizers/competitions ────────────────────────────────────
router.post("/competitions", audit({ action: "organizer.competition.create", resourceType: "competition" }), async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const {
      name, organizerName, category, gradeLevel, websiteUrl,
      registrationStatus, posterUrl, isInternational, detailedDescription,
      description, fee, quota, regOpenDate, regCloseDate, competitionDate,
      requiredDocs, imageUrl, participantInstructions, rounds,
      postPaymentRedirectUrl,
    } = req.body;
    const kind: "native" | "affiliated" = req.body.kind === "affiliated" ? "affiliated" : "native";

    if (!name || !category) {
      res.status(400).json({ message: "name and category are required" });
      return;
    }

    // Default organizer_name to org profile if not provided
    let resolvedOrgName = organizerName;
    if (!resolvedOrgName) {
      const orgResult = await client.query(
        "SELECT org_name FROM organizers WHERE id = $1",
        [req.userId]
      );
      resolvedOrgName = orgResult.rows[0]?.org_name ?? "Unknown Organizer";
    }

    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .substring(0, 40);
    const compId = `comp-${Date.now()}-${slug}`;

    const compResult = await client.query(
      `INSERT INTO competitions (
         id, name, organizer_name, category, grade_level, website_url,
         registration_status, poster_url, is_international, detailed_description,
         description, fee, quota, reg_open_date, reg_close_date, competition_date,
         required_docs, image_url, round_count, participant_instructions, created_by,
         post_payment_redirect_url, kind
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
       RETURNING *`,
      [
        compId, name, resolvedOrgName, category, gradeLevel ?? null,
        websiteUrl ?? null, registrationStatus ?? "Coming Soon",
        posterUrl ?? null, isInternational ?? false,
        detailedDescription ?? null, description ?? null,
        fee ?? 0, quota ?? null, regOpenDate ?? null, regCloseDate ?? null,
        competitionDate ?? null, requiredDocs ?? [], imageUrl ?? null,
        rounds?.length ?? 0, participantInstructions ?? null, req.userId,
        postPaymentRedirectUrl ?? null, kind,
      ]
    );

    if (rounds?.length > 0) {
      for (let i = 0; i < rounds.length; i++) {
        const round = rounds[i];
        await client.query(
          `INSERT INTO competition_rounds (
             comp_id, round_name, round_type, start_date,
             registration_deadline, exam_date, results_date,
             fee, location, round_order
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [
            compId, round.roundName, round.roundType ?? null,
            round.startDate ?? null, round.registrationDeadline ?? null,
            round.examDate ?? null, round.resultsDate ?? null,
            round.fee ?? 0, round.location ?? null, i + 1,
          ]
        );
      }
    }

    await seedDefaultFlow(client, compId, kind);

    await client.query("COMMIT");
    res.status(201).json({ message: "Competition created", competition: compResult.rows[0] });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("POST /organizers/competitions error:", err);
    res.status(500).json({ message: "Failed to create competition" });
  } finally {
    client.release();
  }
});

// ── PUT /api/organizers/competitions/:id ──────────────────────────────────
router.put("/competitions/:id", audit({ action: "organizer.competition.update", resourceType: "competition", resourceIdParam: "id" }), async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    if (!await ownsCompetition(req.params.id as string, req.userId!, (req as any).userRole)) {
      res.status(403).json({ message: "You do not own this competition" });
      return;
    }

    await client.query("BEGIN");

    const { id } = req.params;
    const {
      name, organizerName, category, gradeLevel, websiteUrl,
      registrationStatus, posterUrl, isInternational, detailedDescription,
      description, fee, quota, regOpenDate, regCloseDate, competitionDate,
      requiredDocs, imageUrl, participantInstructions, rounds,
      postPaymentRedirectUrl,
    } = req.body;
    const kind: "native" | "affiliated" = req.body.kind === "affiliated" ? "affiliated" : "native";

    const compResult = await client.query(
      `UPDATE competitions SET
         name = $1, organizer_name = $2, category = $3, grade_level = $4,
         website_url = $5, registration_status = $6, poster_url = $7,
         is_international = $8, detailed_description = $9, description = $10,
         fee = $11, quota = $12, reg_open_date = $13, reg_close_date = $14,
         competition_date = $15, required_docs = $16, image_url = $17,
         round_count = $18, participant_instructions = $19,
         post_payment_redirect_url = $20, kind = $21
       WHERE id = $22
       RETURNING *`,
      [
        name, organizerName, category, gradeLevel, websiteUrl,
        registrationStatus, posterUrl, isInternational, detailedDescription,
        description, fee, quota, regOpenDate, regCloseDate, competitionDate,
        requiredDocs ?? [], imageUrl, rounds?.length ?? 0,
        participantInstructions ?? null, postPaymentRedirectUrl ?? null, kind, id,
      ]
    );

    if (compResult.rows.length === 0) {
      await client.query("ROLLBACK");
      res.status(404).json({ message: "Competition not found" });
      return;
    }

    await client.query("DELETE FROM competition_rounds WHERE comp_id = $1", [id]);

    if (rounds?.length > 0) {
      for (let i = 0; i < rounds.length; i++) {
        const round = rounds[i];
        await client.query(
          `INSERT INTO competition_rounds (
             comp_id, round_name, round_type, start_date,
             registration_deadline, exam_date, results_date,
             fee, location, round_order
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [
            id, round.roundName, round.roundType ?? null,
            round.startDate ?? null, round.registrationDeadline ?? null,
            round.examDate ?? null, round.resultsDate ?? null,
            round.fee ?? 0, round.location ?? null, i + 1,
          ]
        );
      }
    }

    await client.query("COMMIT");
    res.json({ message: "Competition updated", competition: compResult.rows[0] });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("PUT /organizers/competitions/:id error:", err);
    res.status(500).json({ message: "Failed to update competition" });
  } finally {
    client.release();
  }
});

// ── GET /api/organizers/competitions/:id ─────────────────────────────────
router.get("/competitions/:id", async (req: Request, res: Response) => {
  try {

    const { id } = req.params;
    const competitionId = Array.isArray(id) ? id[0] : id;
    
    // Проверяем, принадлежит ли конкурс этому организатору
    if (!await ownsCompetition(competitionId, req.userId!, (req as any).userRole)) {
      res.status(403).json({ message: "You do not own this competition" });
      return;
    }

    const result = await pool.query(
      `SELECT 
         c.*, 
         COUNT(r.id)::int AS registration_count
       FROM competitions c
       LEFT JOIN registrations r ON r.comp_id = c.id
       WHERE c.id = $1
       GROUP BY c.id`,
      [competitionId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ message: "Competition not found" });
      return;
    }

    const c = result.rows[0];
    res.json({
      id: c.id,
      name: c.name,
      organizerName: c.organizer_name,
      category: c.category,
      gradeLevel: c.grade_level,
      fee: c.fee,
      quota: c.quota,
      description: c.description,
      detailedDescription: c.detailed_description,
      regOpenDate: c.reg_open_date,
      regCloseDate: c.reg_close_date,
      competitionDate: c.competition_date,
      registrationStatus: c.registration_status,
      isInternational: c.is_international,
      websiteUrl: c.website_url,
      imageUrl: c.image_url,
      posterUrl: c.poster_url,
      participantInstructions: c.participant_instructions,
      requiredDocs: c.required_docs,
      registrationCount: c.registration_count,
      csvTemplateUrl: c.csv_template_url ?? null,
      postPaymentRedirectUrl: c.post_payment_redirect_url ?? null,
      kind: c.kind ?? "native",
      createdAt: c.created_at,
    });
  } catch (err) {
    console.error("GET /organizers/competitions/:id error:", err);
    res.status(500).json({ message: "Failed to fetch competition" });
  }
});

// ── POST /api/organizers/competitions/:id/publish ─────────────────────────
router.post("/competitions/:id/publish", audit({ action: "organizer.competition.publish", resourceType: "competition", resourceIdParam: "id" }), async (req: Request, res: Response) => {
  try {
    if (!await ownsCompetition(req.params.id as string, req.userId!, (req as any).userRole)) {
      res.status(403).json({ message: "You do not own this competition" });
      return;
    }

    const result = await pool.query(
      `UPDATE competitions
       SET registration_status = 'Open'
       WHERE id = $1
       RETURNING id, name`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ message: "Competition not found" });
      return;
    }

    res.json({ message: "Competition published — registration is now open", id: result.rows[0].id });
  } catch (err) {
    console.error("POST /organizers/competitions/:id/publish error:", err);
    res.status(500).json({ message: "Failed to publish competition" });
  }
});

// ── POST /api/organizers/competitions/:id/close ───────────────────────────
router.post("/competitions/:id/close", audit({ action: "organizer.competition.close", resourceType: "competition", resourceIdParam: "id" }), async (req: Request, res: Response) => {
  try {
    if (!await ownsCompetition(req.params.id as string, req.userId!, (req as any).userRole)) {
      res.status(403).json({ message: "You do not own this competition" });
      return;
    }

    const result = await pool.query(
      `UPDATE competitions
       SET registration_status = 'Closed'
       WHERE id = $1
       RETURNING id, name`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ message: "Competition not found" });
      return;
    }

    res.json({ message: "Competition registration closed", id: result.rows[0].id });
  } catch (err) {
    console.error("POST /organizers/competitions/:id/close error:", err);
    res.status(500).json({ message: "Failed to close competition" });
  }
});

// ── GET /api/organizers/competitions/:id/registrations ────────────────────
router.get("/competitions/:id/registrations", async (req: Request, res: Response) => {
  try {
    if (!await ownsCompetition(req.params.id as string, req.userId!, (req as any).userRole)) {
      res.status(403).json({ message: "You do not own this competition" });
      return;
    }

    const result = await pool.query(
      `SELECT
         r.id, r.status, r.registration_number, r.created_at,
         r.reviewed_at, r.rejection_reason,
         u.id AS user_id, u.full_name, u.email, u.phone,
         s.nisn, COALESCE(sc.name, s.school_name) AS school_name, s.grade,
         p.id AS payment_id, p.payment_status, p.amount,
         p.payment_proof_url, p.proof_submitted_at
       FROM registrations r
       JOIN users u ON r.user_id = u.id
       LEFT JOIN students s ON u.id = s.id
       LEFT JOIN schools sc ON s.school_id = sc.id
       LEFT JOIN payments p ON r.id = p.registration_id
       WHERE r.comp_id = $1
       ORDER BY r.created_at DESC`,
      [req.params.id]
    );

    res.json(result.rows.map((r) => ({
      id: r.id,
      status: r.status,
      registrationNumber: r.registration_number,
      createdAt: r.created_at,
      reviewedAt: r.reviewed_at,
      rejectionReason: r.rejection_reason,
      student: {
        id: r.user_id,
        fullName: r.full_name,
        email: r.email,
        phone: r.phone,
        nisn: r.nisn,
        school: r.school_name,
        grade: r.grade,
      },
      payment: r.payment_id ? {
        id: r.payment_id,
        status: r.payment_status,
        amount: r.amount,
        proofUrl: r.payment_proof_url,
        proofSubmittedAt: r.proof_submitted_at,
      } : null,
    })));
  } catch (err) {
    console.error("GET /organizers/competitions/:id/registrations error:", err);
    res.status(500).json({ message: "Failed to fetch registrations" });
  }
});

// ── POST /api/organizers/registrations/:id/approve ────────────────────────
router.post("/registrations/:id/approve", audit({ action: "organizer.registration.approve", resourceType: "registration", resourceIdParam: "id" }), async (req: Request, res: Response) => {
  try {
    // Verify organizer owns the competition this registration belongs to
    const regResult = await pool.query(
      `SELECT r.user_id, r.comp_id, c.name AS competition_name, u.full_name AS student_name
       FROM registrations r
       JOIN competitions c ON r.comp_id = c.id
       JOIN users u ON r.user_id = u.id
       WHERE r.id = $1`,
      [req.params.id]
    );

    if (regResult.rows.length === 0) {
      res.status(404).json({ message: "Registration not found" });
      return;
    }

    const { user_id, comp_id, competition_name } = regResult.rows[0];

    if (!await ownsCompetition(comp_id, req.userId!, (req as any).userRole)) {
      res.status(403).json({ message: "You do not own this competition" });
      return;
    }

    await pool.query(
      `UPDATE registrations
       SET status = 'approved', reviewed_by = $1, reviewed_at = now(), updated_at = now()
       WHERE id = $2`,
      [req.userId, req.params.id]
    );

    await pool.query(
      `INSERT INTO notifications (user_id, type, title, body, data)
       VALUES ($1, 'registration_approved', '🎉 Registration Approved!',
         $2, $3)`,
      [
        user_id,
        `Your registration for ${competition_name} has been approved. You're all set!`,
        JSON.stringify({ registrationId: req.params.id }),
      ]
    );

    const parentIds = await pushService.getActiveParentIdsForStudent(user_id);
    if (parentIds.length > 0) {
      await pushService.sendBatchNotifications(
        parentIds,
        "Child Registration Approved",
        `${regResult.rows[0].student_name}'s registration for ${competition_name} has been approved.`,
        { type: "child_registration_approved", registrationId: req.params.id, studentId: user_id }
      );
    }

    res.json({ message: "Registration approved", status: "approved" });
  } catch (err) {
    console.error("POST /organizers/registrations/:id/approve error:", err);
    res.status(500).json({ message: "Failed to approve registration" });
  }
});

// ── POST /api/organizers/registrations/:id/reject ─────────────────────────
router.post("/registrations/:id/reject", audit({ action: "organizer.registration.reject", resourceType: "registration", resourceIdParam: "id" }), async (req: Request, res: Response) => {
  try {
    const { reason } = req.body;
    if (!reason?.trim()) {
      res.status(400).json({ message: "Rejection reason is required" });
      return;
    }

    const regResult = await pool.query(
      `SELECT r.user_id, r.comp_id, c.name AS competition_name, u.full_name AS student_name
       FROM registrations r
       JOIN competitions c ON r.comp_id = c.id
       JOIN users u ON r.user_id = u.id
       WHERE r.id = $1`,
      [req.params.id]
    );

    if (regResult.rows.length === 0) {
      res.status(404).json({ message: "Registration not found" });
      return;
    }

    const { user_id, comp_id, competition_name } = regResult.rows[0];

    if (!await ownsCompetition(comp_id, req.userId!, (req as any).userRole)) {
      res.status(403).json({ message: "You do not own this competition" });
      return;
    }

    await pool.query(
      `UPDATE registrations
       SET status = 'rejected', reviewed_by = $1, reviewed_at = now(),
           rejection_reason = $2, updated_at = now()
       WHERE id = $3`,
      [req.userId, reason.trim(), req.params.id]
    );

    await pool.query(
      `INSERT INTO notifications (user_id, type, title, body, data)
       VALUES ($1, 'registration_rejected', 'Registration Not Approved',
         $2, $3)`,
      [
        user_id,
        `Your registration for ${competition_name} was not approved. Reason: ${reason.trim()}`,
        JSON.stringify({ registrationId: req.params.id, reason: reason.trim() }),
      ]
    );

    const parentIds = await pushService.getActiveParentIdsForStudent(user_id);
    if (parentIds.length > 0) {
      await pushService.sendBatchNotifications(
        parentIds,
        "Child Registration Rejected",
        `${regResult.rows[0].student_name}'s registration for ${competition_name} was not approved. Reason: ${reason.trim()}`,
        { type: "child_registration_rejected", registrationId: req.params.id, studentId: user_id, reason: reason.trim() }
      );
    }

    res.json({ message: "Registration rejected", status: "rejected" });
  } catch (err) {
    console.error("POST /organizers/registrations/:id/reject error:", err);
    res.status(500).json({ message: "Failed to reject registration" });
  }
});

// ── GET /api/organizers/competitions/:id/export ───────────────────────────
router.get("/competitions/:id/export", async (req: Request, res: Response) => {
  try {
    if (!await ownsCompetition(req.params.id as string, req.userId!, (req as any).userRole)) {
      res.status(403).json({ message: "You do not own this competition" });
      return;
    }

    const result = await pool.query(
      `SELECT
         r.id AS registration_id, r.registration_number, r.status,
         r.created_at AS registration_date,
         u.full_name, u.email, u.phone,
         s.nisn, COALESCE(sc.name, s.school_name) AS school_name, s.grade,
         p.payment_status, p.amount AS paid_amount, p.payment_method
       FROM registrations r
       JOIN users u ON r.user_id = u.id
       LEFT JOIN students s ON u.id = s.id
       LEFT JOIN schools sc ON s.school_id = sc.id
       LEFT JOIN payments p ON r.id = p.registration_id
       WHERE r.comp_id = $1
       ORDER BY r.created_at DESC`,
      [req.params.id]
    );

    const headers = [
      "Registration ID", "Reg Number", "Status", "Registration Date",
      "Full Name", "Email", "Phone", "NISN", "School", "Grade",
      "Payment Status", "Amount Paid", "Payment Method",
    ];

    const csvRows = [headers.join(",")];
    for (const row of result.rows) {
      csvRows.push([
        row.registration_id,
        row.registration_number ?? "",
        row.status,
        row.registration_date ? new Date(row.registration_date).toLocaleDateString("id-ID") : "",
        `"${(row.full_name ?? "").replace(/"/g, '""')}"`,
        row.email ?? "",
        row.phone ?? "",
        row.nisn ?? "",
        `"${(row.school_name ?? "").replace(/"/g, '""')}"`,
        row.grade ?? "",
        row.payment_status ?? "",
        row.paid_amount ?? "",
        row.payment_method ?? "",
      ].join(","));
    }

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=registrations-${req.params.id}-${Date.now()}.csv`
    );
    res.send(csvRows.join("\n"));
  } catch (err) {
    console.error("GET /organizers/competitions/:id/export error:", err);
    res.status(500).json({ message: "Failed to export registrations" });
  }
});

// ── GET /api/organizers/revenue ───────────────────────────────────────────
router.get("/revenue", async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const userRole = (req as any).userRole;
    const whereClause = userRole === "admin" ? "" : "WHERE c.created_by = $1";
    const params = userRole === "admin" ? [] : [userId];

    // Overall totals
    const totalsResult = await pool.query(
      `SELECT
         COUNT(DISTINCT r.id)::int   AS total_registrations,
         COUNT(DISTINCT CASE WHEN p.payment_status = 'settlement' OR p.payment_status = 'capture' THEN r.id END)::int AS paid_registrations,
         COALESCE(SUM(CASE WHEN p.payment_status IN ('settlement','capture') THEN p.amount ELSE 0 END), 0)::bigint AS total_revenue
       FROM competitions c
       LEFT JOIN registrations r ON r.comp_id = c.id
       LEFT JOIN payments p ON p.registration_id = r.id
       ${whereClause}`,
      params
    );

    // Per-competition breakdown
    const breakdownResult = await pool.query(
      `SELECT
         c.id, c.name,
         COUNT(DISTINCT r.id)::int AS registrations,
         COALESCE(SUM(CASE WHEN p.payment_status IN ('settlement','capture') THEN p.amount ELSE 0 END), 0)::bigint AS revenue
       FROM competitions c
       LEFT JOIN registrations r ON r.comp_id = c.id
       LEFT JOIN payments p ON p.registration_id = r.id
       ${whereClause}
       GROUP BY c.id, c.name
       ORDER BY revenue DESC`,
      params
    );

    const totals = totalsResult.rows[0];
    res.json({
      totalRegistrations: totals.total_registrations,
      paidRegistrations: totals.paid_registrations,
      totalRevenue: Number(totals.total_revenue),
      competitions: breakdownResult.rows.map((c) => ({
        id: c.id,
        name: c.name,
        registrations: c.registrations,
        revenue: Number(c.revenue),
      })),
    });
  } catch (err) {
    console.error("GET /organizers/revenue error:", err);
    res.status(500).json({ message: "Failed to fetch revenue" });
  }
});

// ── POST /api/organizers/competitions/:id/csv-template ────────────────────
router.post(
  "/competitions/:id/csv-template",
  csvUpload.single("file"),
  async (req: Request, res: Response) => {
    try {
      if (!await ownsCompetition(req.params.id as string, req.userId!, (req as any).userRole)) {
        res.status(403).json({ message: "You do not own this competition" });
        return;
      }

      if (!req.file) {
        res.status(400).json({ message: "CSV file is required" });
        return;
      }

      const url = await storeFile(
        req.userId!,
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype || "text/csv"
      );

      await pool.query(
        "UPDATE competitions SET csv_template_url = $1 WHERE id = $2",
        [url, req.params.id]
      );

      res.json({ csvTemplateUrl: url });
    } catch (err) {
      console.error("POST /organizers/competitions/:id/csv-template error:", err);
      res.status(500).json({ message: "Failed to upload CSV template" });
    }
  }
);

export default router;
