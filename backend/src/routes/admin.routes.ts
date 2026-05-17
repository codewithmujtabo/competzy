import { Router } from "express";
import { pool } from "../config/database";
import { adminOnly } from "../middleware/admin.middleware";
import { authMiddleware } from "../middleware/auth";
import { audit } from "../middleware/audit";
import * as pushService from "../services/push.service";
import { refundPayment } from "../services/midtrans.service";
import { seedDefaultFlow } from "../services/competition-flow.service";

const router = Router();

// All routes require authentication and admin role
router.use(authMiddleware);
router.use(adminOnly);

/**
 * GET /api/admin/competitions
 * Get all competitions with round counts
 */
router.get("/competitions", async (req, res) => {
  try {
    const roundsTableExists = await pool.query(
      "SELECT to_regclass('public.competition_rounds') as table_name"
    );

    const hasCompetitionRounds = !!roundsTableExists.rows[0]?.table_name;

    const result = hasCompetitionRounds
      ? await pool.query(`
          SELECT
            c.*,
            COUNT(cr.id)::int as actual_round_count
          FROM competitions c
          LEFT JOIN competition_rounds cr ON c.id = cr.comp_id
          GROUP BY c.id
          ORDER BY c.created_at DESC
        `)
      : await pool.query(`
          SELECT
            c.*,
            COALESCE(c.round_count, 1)::int as actual_round_count
          FROM competitions c
          ORDER BY c.created_at DESC
        `);

    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching competitions:", error);
    res.status(500).json({ message: "Failed to fetch competitions" });
  }
});

/**
 * POST /api/admin/competitions
 * Create a new competition with rounds
 */
router.post("/competitions", audit({ action: "admin.competition.create", resourceType: "competition" }), async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const {
      name,
      category,
      registrationStatus,
      posterUrl,
      isInternational,
      detailedDescription,
      description,
      fee,
      quota,
      requiredDocs,
      imageUrl,
      participantInstructions,
      rounds,
    } = req.body;
    const organizerName   = req.body.organizerName   ?? req.body.organizer_name;
    const gradeLevel      = req.body.gradeLevel      ?? req.body.grade_level;
    const websiteUrl      = req.body.websiteUrl      ?? req.body.website_url;
    const regOpenDate     = req.body.regOpenDate     ?? req.body.reg_open_date;
    const regCloseDate    = req.body.regCloseDate    ?? req.body.reg_close_date;
    const competitionDate = req.body.competitionDate ?? req.body.competition_date;
    const postPaymentRedirectUrl = req.body.postPaymentRedirectUrl ?? req.body.post_payment_redirect_url;
    const kind: "native" | "affiliated" = req.body.kind === "affiliated" ? "affiliated" : "native";

    // Generate competition ID
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .substring(0, 40);

    const timestamp = Date.now();
    const compId = `comp-${timestamp}-${slug}`;
    // Public URL slug for the /competitions/[slug] portal — uniqueness suffix
    // appended so same-named competitions don't collide.
    const compSlug = `${slug || "competition"}-${timestamp.toString(36).slice(-5)}`;

    // Insert competition
    const compResult = await client.query(
      `INSERT INTO competitions (
        id, name, organizer_name, category, grade_level,
        website_url, registration_status, poster_url, is_international,
        detailed_description, description, fee, quota,
        reg_open_date, reg_close_date, competition_date,
        required_docs, image_url, round_count,
        participant_instructions, created_by, kind, post_payment_redirect_url, slug
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
      RETURNING *`,
      [
        compId,
        name,
        organizerName,
        category,
        gradeLevel,
        websiteUrl,
        registrationStatus || "Coming Soon",
        posterUrl,
        isInternational || false,
        detailedDescription,
        description,
        fee || 0,
        quota,
        regOpenDate,
        regCloseDate,
        competitionDate,
        requiredDocs || [],
        imageUrl,
        rounds?.length || 0,
        participantInstructions || null,
        req.userId,
        kind,
        postPaymentRedirectUrl ?? null,
        compSlug,
      ]
    );

    // Insert rounds if provided
    if (rounds && rounds.length > 0) {
      for (let i = 0; i < rounds.length; i++) {
        const round = rounds[i];
        await client.query(
          `INSERT INTO competition_rounds (
            comp_id, round_name, round_type, start_date,
            registration_deadline, exam_date, results_date,
            fee, location, round_order
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            compId,
            round.roundName,
            round.roundType,
            round.startDate,
            round.registrationDeadline,
            round.examDate,
            round.resultsDate,
            round.fee || 0,
            round.location,
            i + 1,
          ]
        );
      }
    }

    await seedDefaultFlow(client, compId, kind);

    await client.query("COMMIT");

    res.status(201).json({
      message: "Competition created successfully",
      competition: compResult.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error creating competition:", error);
    res.status(500).json({ message: "Failed to create competition" });
  } finally {
    client.release();
  }
});

/**
 * PUT /api/admin/competitions/:id
 * Update an existing competition
 */
router.put("/competitions/:id", audit({ action: "admin.competition.update", resourceType: "competition", resourceIdParam: "id" }), async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { id } = req.params;
    const {
      name,
      category,
      registrationStatus,
      posterUrl,
      isInternational,
      detailedDescription,
      description,
      fee,
      quota,
      requiredDocs,
      imageUrl,
      participantInstructions,
      rounds,
    } = req.body;
    const organizerName   = req.body.organizerName   ?? req.body.organizer_name;
    const gradeLevel      = req.body.gradeLevel      ?? req.body.grade_level;
    const websiteUrl      = req.body.websiteUrl      ?? req.body.website_url;
    const regOpenDate     = req.body.regOpenDate     ?? req.body.reg_open_date;
    const regCloseDate    = req.body.regCloseDate    ?? req.body.reg_close_date;
    const competitionDate = req.body.competitionDate ?? req.body.competition_date;
    const postPaymentRedirectUrl = req.body.postPaymentRedirectUrl ?? req.body.post_payment_redirect_url;
    const kind: "native" | "affiliated" = req.body.kind === "affiliated" ? "affiliated" : "native";

    // Update competition
    const compResult = await client.query(
      `UPDATE competitions SET
        name = $1,
        organizer_name = $2,
        category = $3,
        grade_level = $4,
        website_url = $5,
        registration_status = $6,
        poster_url = $7,
        is_international = $8,
        detailed_description = $9,
        description = $10,
        fee = $11,
        quota = $12,
        reg_open_date = $13,
        reg_close_date = $14,
        competition_date = $15,
        required_docs = $16,
        image_url = $17,
        round_count = $18,
        participant_instructions = $19,
        kind = $20,
        post_payment_redirect_url = $21
      WHERE id = $22
      RETURNING *`,
      [
        name,
        organizerName,
        category,
        gradeLevel,
        websiteUrl,
        registrationStatus,
        posterUrl,
        isInternational,
        detailedDescription,
        description,
        fee,
        quota,
        regOpenDate,
        regCloseDate,
        competitionDate,
        requiredDocs || [],
        imageUrl,
        rounds?.length || 0,
        participantInstructions || null,
        kind,
        postPaymentRedirectUrl ?? null,
        id,
      ]
    );

    if (compResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Competition not found" });
    }

    // Delete existing rounds
    await client.query("DELETE FROM competition_rounds WHERE comp_id = $1", [id]);

    // Insert new rounds
    if (rounds && rounds.length > 0) {
      for (let i = 0; i < rounds.length; i++) {
        const round = rounds[i];
        await client.query(
          `INSERT INTO competition_rounds (
            comp_id, round_name, round_type, start_date,
            registration_deadline, exam_date, results_date,
            fee, location, round_order
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            id,
            round.roundName,
            round.roundType,
            round.startDate,
            round.registrationDeadline,
            round.examDate,
            round.resultsDate,
            round.fee || 0,
            round.location,
            i + 1,
          ]
        );
      }
    }

    await client.query("COMMIT");

    res.json({
      message: "Competition updated successfully",
      competition: compResult.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error updating competition:", error);
    res.status(500).json({ message: "Failed to update competition" });
  } finally {
    client.release();
  }
});

/**
 * DELETE /api/admin/competitions/:id
 * Delete a competition
 */
router.delete("/competitions/:id", audit({ action: "admin.competition.delete", resourceType: "competition", resourceIdParam: "id" }), async (req, res) => {
  try {
    const { id } = req.params;

    // Check if competition has registrations
    const regCheck = await pool.query(
      "SELECT COUNT(*) FROM registrations WHERE comp_id = $1",
      [id]
    );

    if (parseInt(regCheck.rows[0].count) > 0) {
      return res.status(400).json({
        message: "Cannot delete competition with existing registrations",
      });
    }

    // Delete competition (rounds will be deleted via CASCADE)
    const result = await pool.query(
      "DELETE FROM competitions WHERE id = $1 RETURNING *",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Competition not found" });
    }

    res.json({ message: "Competition deleted successfully" });
  } catch (error) {
    console.error("Error deleting competition:", error);
    res.status(500).json({ message: "Failed to delete competition" });
  }
});

/**
 * GET /api/admin/competitions/:id/registrations
 * Get all registrations for a competition with student details
 */
router.get("/competitions/:id/registrations", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT
        r.*,
        u.full_name,
        u.email,
        u.phone,
        s.nisn,
        COALESCE(sc.name, s.school_name) AS school_name,
        s.grade,
        s.date_of_birth,
        s.school_address,
        s.parent_phone,
        s.parent_school_id
      FROM registrations r
      JOIN users u ON r.user_id = u.id
      LEFT JOIN students s ON u.id = s.id
      LEFT JOIN schools sc ON s.school_id = sc.id
      WHERE r.comp_id = $1
      ORDER BY r.created_at DESC`,
      [id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching registrations:", error);
    res.status(500).json({ message: "Failed to fetch registrations" });
  }
});

/**
 * GET /api/admin/competitions/:id/registrations/export
 * Export registrations as CSV
 */
router.get("/competitions/:id/registrations/export", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT
        r.id as registration_id,
        r.status,
        r.created_at as registration_date,
        u.full_name,
        u.email,
        u.phone,
        s.nisn,
        COALESCE(sc.name, s.school_name) AS school_name,
        s.grade,
        s.date_of_birth,
        s.school_address,
        s.parent_phone
      FROM registrations r
      JOIN users u ON r.user_id = u.id
      LEFT JOIN students s ON u.id = s.id
      LEFT JOIN schools sc ON s.school_id = sc.id
      WHERE r.comp_id = $1
      ORDER BY r.created_at DESC`,
      [id]
    );

    // Generate CSV
    const headers = [
      "Registration ID",
      "Status",
      "Registration Date",
      "Full Name",
      "Email",
      "Phone",
      "NISN",
      "School",
      "Grade",
      "Date of Birth",
      "Address",
      "Parent Phone",
    ];

    const csvRows = [headers.join(",")];

    for (const row of result.rows) {
      const values = [
        row.registration_id,
        row.status,
        new Date(row.registration_date).toLocaleDateString("id-ID"),
        `"${row.full_name || ""}"`,
        row.email || "",
        row.phone || "",
        row.nisn || "",
        `"${row.school_name || ""}"`,
        row.grade || "",
        row.date_of_birth ? new Date(row.date_of_birth).toLocaleDateString("id-ID") : "",
        `"${row.school_address || ""}"`,
        row.parent_phone || "",
      ];
      csvRows.push(values.join(","));
    }

    const csv = csvRows.join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=registrations-${id}-${Date.now()}.csv`
    );
    res.send(csv);
  } catch (error) {
    console.error("Error exporting registrations:", error);
    res.status(500).json({ message: "Failed to export registrations" });
  }
});

/**
 * GET /api/admin/students
 * Get all student accounts with profile details and registration counts
 */
router.get("/students", async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT
        u.id,
        u.full_name,
        u.email,
        u.phone,
        u.city,
        u.created_at,
        s.nisn,
        s.school_name,
        s.grade,
        s.date_of_birth,
        s.school_address,
        COUNT(r.id)::int as registration_count
      FROM users u
      LEFT JOIN students s ON u.id = s.id
      LEFT JOIN registrations r ON u.id = r.user_id
      WHERE u.role = 'student'
      GROUP BY
        u.id,
        u.full_name,
        u.email,
        u.phone,
        u.city,
        u.created_at,
        s.nisn,
        s.school_name,
        s.grade,
        s.date_of_birth,
        s.school_address
      ORDER BY u.created_at DESC`
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching students:", error);
    res.status(500).json({ message: "Failed to fetch students" });
  }
});

/**
 * GET /api/admin/stats
 * Get platform statistics
 */
router.get("/stats", async (req, res) => {
  try {
    const [competitions, users, registrations, revenue] = await Promise.all([
      pool.query("SELECT COUNT(*) FROM competitions"),
      pool.query("SELECT COUNT(*) FROM users WHERE role = 'student'"),
      pool.query("SELECT COUNT(*) FROM registrations"),
      pool.query("SELECT SUM(c.fee) FROM registrations r JOIN competitions c ON r.comp_id = c.id WHERE r.status = 'paid'"),
    ]);

    res.json({
      totalCompetitions: parseInt(competitions.rows[0].count),
      totalStudents: parseInt(users.rows[0].count),
      totalRegistrations: parseInt(registrations.rows[0].count),
      totalRevenue: parseInt(revenue.rows[0].sum) || 0,
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({ message: "Failed to fetch statistics" });
  }
});

/**
 * GET /api/admin/kpi
 * Cross-competition KPI dashboard. Returns:
 *   - totals: registrations, paid, free, revenue Rp
 *   - paidRate: paid / billable %
 *   - avgTimeToPaymentHours: avg(paid_at - created_at) for settled paid regs
 *   - topCompetitions: top 3 by registration count (last 90d)
 *   - dailySeries: last 90 days of [date, registrations, revenue]
 *
 * Spec F-AD-05.
 */
router.get("/kpi", async (_req, res) => {
  try {
    const [totals, topComps, daily] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*)                                               AS total_registrations,
          COUNT(*) FILTER (WHERE r.status = 'paid')              AS paid_registrations,
          COUNT(*) FILTER (WHERE c.fee = 0 OR c.fee IS NULL)     AS free_registrations,
          COALESCE(SUM(c.fee) FILTER (WHERE r.status = 'paid'), 0)::bigint AS revenue_rp,
          AVG(
            EXTRACT(EPOCH FROM (p.created_at - r.created_at)) / 3600
          ) FILTER (WHERE r.status = 'paid' AND p.created_at IS NOT NULL) AS avg_hours_to_pay
        FROM registrations r
        JOIN competitions  c ON c.id = r.comp_id
   LEFT JOIN payments      p ON p.registration_id = r.id AND p.payment_status = 'settlement'
       WHERE r.deleted_at IS NULL
      `),
      pool.query(`
        SELECT c.id, c.name, c.fee, COUNT(r.id)::int AS registration_count
          FROM competitions c
     LEFT JOIN registrations r
            ON r.comp_id = c.id
           AND r.created_at > now() - INTERVAL '90 days'
           AND r.deleted_at IS NULL
         GROUP BY c.id, c.name, c.fee
         ORDER BY registration_count DESC
         LIMIT 3
      `),
      pool.query(`
        SELECT date_trunc('day', r.created_at)::date AS day,
               COUNT(*)::int                          AS registrations,
               COALESCE(SUM(c.fee) FILTER (WHERE r.status = 'paid'), 0)::bigint AS revenue_rp
          FROM registrations r
          JOIN competitions  c ON c.id = r.comp_id
         WHERE r.created_at > now() - INTERVAL '90 days'
           AND r.deleted_at IS NULL
         GROUP BY day
         ORDER BY day ASC
      `),
    ]);

    const t = totals.rows[0];
    const billable = Number(t.total_registrations) - Number(t.free_registrations);
    const paidRate = billable > 0 ? Number(t.paid_registrations) / billable : 0;

    res.json({
      totals: {
        totalRegistrations: Number(t.total_registrations),
        paidRegistrations:  Number(t.paid_registrations),
        freeRegistrations:  Number(t.free_registrations),
        revenueRp:          Number(t.revenue_rp ?? 0),
      },
      paidRate,
      avgTimeToPaymentHours: t.avg_hours_to_pay ? Number(t.avg_hours_to_pay) : null,
      topCompetitions: topComps.rows.map((c) => ({
        id: c.id,
        name: c.name,
        fee: Number(c.fee ?? 0),
        registrationCount: c.registration_count,
      })),
      dailySeries: daily.rows.map((d) => ({
        date: d.day,
        registrations: d.registrations,
        revenueRp: Number(d.revenue_rp ?? 0),
      })),
    });
  } catch (err) {
    console.error("KPI error:", err);
    res.status(500).json({ message: "Failed to compute KPIs" });
  }
});

/**
 * GET /api/admin/segments
 * Pre-built audience segments for cross-sell campaigns.
 * Spec F-AD-02 (viewer only — full builder is Phase 2).
 *
 * Each segment returns: { key, label, description, count, sampleUserIds[] }
 * Use sampleUserIds for spot-checks; full export should be a separate endpoint.
 */
router.get("/segments", async (_req, res) => {
  try {
    // Lapsed: historical participation but no recent activity in registrations.
    // Multi-comp veterans: 3+ distinct historical competitions.
    // EMC-only never tried KMC: claimed an EMC record but no KMC registration on platform.
    const [lapsed, veterans, emcOnly] = await Promise.all([
      pool.query(`
        SELECT u.id
          FROM users u
         WHERE u.deleted_at IS NULL
           AND u.role = 'student'
           AND EXISTS (
             SELECT 1 FROM historical_participants hp
              WHERE hp.claimed_by = u.id
           )
           AND NOT EXISTS (
             SELECT 1 FROM registrations r
              WHERE r.user_id = u.id
                AND r.created_at > now() - INTERVAL '1 year'
                AND r.deleted_at IS NULL
           )
         LIMIT 5000
      `),
      pool.query(`
        SELECT u.id
          FROM users u
          JOIN historical_participants hp ON hp.claimed_by = u.id
         WHERE u.deleted_at IS NULL AND u.role = 'student'
         GROUP BY u.id
        HAVING COUNT(DISTINCT hp.comp_name) >= 3
         LIMIT 5000
      `),
      pool.query(`
        SELECT DISTINCT u.id
          FROM users u
          JOIN historical_participants hp ON hp.claimed_by = u.id
         WHERE u.deleted_at IS NULL
           AND u.role = 'student'
           AND hp.comp_name ILIKE 'EMC%'
           AND NOT EXISTS (
             SELECT 1 FROM registrations r
               JOIN competitions c ON c.id = r.comp_id
              WHERE r.user_id = u.id
                AND c.name ILIKE '%KMC%'
                AND r.deleted_at IS NULL
           )
         LIMIT 5000
      `),
    ]);

    const segs = [
      {
        key:   "lapsed_1y",
        label: "Lapsed >1 year",
        description: "Past-platform participants who haven't registered for any competition in the last 12 months.",
        userIds: lapsed.rows.map((r) => r.id),
      },
      {
        key:   "multi_comp_veterans",
        label: "Multi-comp veterans",
        description: "Students with 3+ distinct historical competitions claimed.",
        userIds: veterans.rows.map((r) => r.id),
      },
      {
        key:   "emc_only_no_kmc",
        label: "EMC-only never tried KMC",
        description: "Claimed an EMC record but never registered for any KMC competition on Competzy.",
        userIds: emcOnly.rows.map((r) => r.id),
      },
    ];

    res.json(
      segs.map((s) => ({
        ...s,
        count: s.userIds.length,
        sampleUserIds: s.userIds.slice(0, 20),
      }))
    );
  } catch (err) {
    console.error("Segments error:", err);
    res.status(500).json({ message: "Failed to compute segments" });
  }
});

/**
 * GET /api/admin/registrations/pending
 * Get registrations filtered by status (default: pending_review, use ?status=all for all)
 */
router.get("/registrations/pending", async (req, res) => {
  try {
    const statusFilter = (req.query.status as string) || "pending_review";
    const compIdFilter = req.query.compId as string | undefined;

    const where: string[] = [];
    const values: unknown[] = [];
    if (statusFilter !== "all") {
      values.push(statusFilter);
      where.push(`r.status = $${values.length}`);
    }
    if (compIdFilter) {
      values.push(compIdFilter);
      where.push(`r.comp_id = $${values.length}`);
    }
    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const result = await pool.query(
      `SELECT
        r.id as registration_id,
        r.status,
        r.created_at as registered_at,
        r.updated_at,
        u.id as student_id,
        u.full_name as student_name,
        u.email as student_email,
        u.phone as student_phone,
        COALESCE(sc.name, s.school_name) AS school_name,
        s.grade,
        s.nisn,
        c.id as competition_id,
        c.name as competition_name,
        c.fee
      FROM registrations r
      JOIN users u ON r.user_id = u.id
      LEFT JOIN students s ON u.id = s.id
      LEFT JOIN schools sc ON s.school_id = sc.id
      JOIN competitions c ON r.comp_id = c.id
      ${whereClause}
      ORDER BY r.created_at DESC`,
      values
    );

    res.json({
      pendingRegistrations: result.rows.map((row) => ({
        registrationId: row.registration_id,
        status: row.status,
        registeredAt: row.registered_at,
        updatedAt: row.updated_at,
        student: {
          id: row.student_id,
          name: row.student_name,
          email: row.student_email,
          phone: row.student_phone,
          school: row.school_name,
          grade: row.grade,
          nisn: row.nisn,
        },
        competition: {
          id: row.competition_id,
          name: row.competition_name,
          fee: row.fee,
        },
      })),
    });
  } catch (err) {
    console.error("Get pending registrations error:", err);
    res.status(500).json({ message: "Failed to fetch pending registrations" });
  }
});

/**
 * GET /api/admin/registrations/:id
 * Get full registration details
 */
router.get("/registrations/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT
        r.*,
        u.full_name, u.email, u.phone, u.city,
        COALESCE(sc.name, s.school_name) AS school_name, s.grade, s.nisn,
        c.name as competition_name, c.fee, c.category,
        p.payment_proof_url, p.proof_submitted_at, p.payment_method, p.amount,
        admin_user.full_name as reviewed_by_name
      FROM registrations r
      JOIN users u ON r.user_id = u.id
      LEFT JOIN students s ON u.id = s.id
      LEFT JOIN schools sc ON s.school_id = sc.id
      JOIN competitions c ON r.comp_id = c.id
      LEFT JOIN payments p ON r.id = p.registration_id
      LEFT JOIN users admin_user ON r.reviewed_by = admin_user.id
      WHERE r.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ message: "Registration not found" });
      return;
    }

    res.json({ registration: result.rows[0] });
  } catch (err) {
    console.error("Get registration error:", err);
    res.status(500).json({ message: "Failed to fetch registration" });
  }
});

/**
 * POST /api/admin/registrations/:id/approve
 * Approve a registration
 */
router.post("/registrations/:id/approve", audit({ action: "admin.registration.approve", resourceType: "registration", resourceIdParam: "id" }), async (req, res) => {
  try {
    const adminId = req.userId!;
    const { id } = req.params;

    // Get registration details for notification
    const regResult = await pool.query(
      `SELECT r.user_id, c.name as competition_name, c.fee, u.full_name as student_name
       FROM registrations r
       JOIN competitions c ON r.comp_id = c.id
       JOIN users u ON r.user_id = u.id
       WHERE r.id = $1`,
      [id]
    );

    if (regResult.rows.length === 0) {
      res.status(404).json({ message: "Registration not found" });
      return;
    }

    const { user_id, competition_name } = regResult.rows[0];
    const newStatus = "approved";

    // Update registration status
    await pool.query(
      `UPDATE registrations
       SET status = $1,
           reviewed_by = $2,
           reviewed_at = now(),
           updated_at = now()
       WHERE id = $3`,
      [newStatus, adminId, id]
    );

    const notifBody = `Congratulations! Your registration for ${competition_name} has been approved.`;

    // Send approval notification to student
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, body, data)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        user_id,
        "registration_approved",
        "Registration Approved!",
        notifBody,
        JSON.stringify({ registrationId: id }),
      ]
    );

    await pushService.sendPushNotification(user_id, "Registration Approved!", notifBody, {
      type: "registration_approved",
      registrationId: id,
    });

    const parentIds = await pushService.getActiveParentIdsForStudent(user_id);
    if (parentIds.length > 0) {
      const studentResult = await pool.query(
        "SELECT full_name FROM users WHERE id = $1",
        [user_id]
      );
      const studentName = studentResult.rows[0]?.full_name || "Your child";

      await pushService.sendBatchNotifications(
        parentIds,
        "Child Registration Approved",
        `${studentName}'s registration for ${competition_name} has been approved.`,
        {
          type: "child_registration_approved",
          registrationId: id,
          studentId: user_id,
        }
      );
    }

    res.json({
      message: "Registration approved successfully",
      status: newStatus,
    });
  } catch (err) {
    console.error("Approve registration error:", err);
    res.status(500).json({ message: "Failed to approve registration" });
  }
});

/**
 * POST /api/admin/registrations/:id/reject
 * Reject a registration
 */
router.post("/registrations/:id/reject", audit({ action: "admin.registration.reject", resourceType: "registration", resourceIdParam: "id" }), async (req, res) => {
  try {
    const adminId = req.userId!;
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason || !reason.trim()) {
      res.status(400).json({ message: "Rejection reason is required" });
      return;
    }

    // Get registration details for notification
    const regResult = await pool.query(
      `SELECT r.user_id, c.name as competition_name
       FROM registrations r
       JOIN competitions c ON r.comp_id = c.id
       WHERE r.id = $1`,
      [id]
    );

    if (regResult.rows.length === 0) {
      res.status(404).json({ message: "Registration not found" });
      return;
    }

    const { user_id, competition_name } = regResult.rows[0];

    // Update registration status
    await pool.query(
      `UPDATE registrations
       SET status = 'rejected',
           reviewed_by = $1,
           reviewed_at = now(),
           rejection_reason = $2,
           updated_at = now()
       WHERE id = $3`,
      [adminId, reason.trim(), id]
    );

    // Send rejection notification to student
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, body, data)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        user_id,
        "registration_rejected",
        "Registration Not Approved",
        `Your registration for ${competition_name} was not approved. Reason: ${reason}. Please contact support if you have questions.`,
        JSON.stringify({ registrationId: id, reason }),
      ]
    );

    const parentIds = await pushService.getActiveParentIdsForStudent(user_id);
    if (parentIds.length > 0) {
      const studentResult = await pool.query(
        "SELECT full_name FROM users WHERE id = $1",
        [user_id]
      );
      const studentName = studentResult.rows[0]?.full_name || "Your child";

      await pushService.sendBatchNotifications(
        parentIds,
        "Child Registration Rejected",
        `${studentName}'s registration for ${competition_name} was not approved. Reason: ${reason}.`,
        {
          type: "child_registration_rejected",
          registrationId: id,
          studentId: user_id,
          reason,
        }
      );
    }

    res.json({
      message: "Registration rejected",
      status: "rejected",
    });
  } catch (err) {
    console.error("Reject registration error:", err);
    res.status(500).json({ message: "Failed to reject registration" });
  }
});

// ── GET /api/admin/schools ────────────────────────────────────────────────
router.get("/schools", async (req, res) => {
  try {
    const page     = parseInt(req.query.page   as string) || 1;
    const limit    = parseInt(req.query.limit  as string) || 20;
    const search   = req.query.search   as string | undefined;
    const province = req.query.province as string | undefined;
    const offset   = (page - 1) * limit;

    const conditions: string[] = [];
    const params: unknown[]    = [];
    let   i = 1;

    if (search) {
      conditions.push(`(name ILIKE $${i} OR npsn ILIKE $${i} OR city ILIKE $${i})`);
      params.push(`%${search}%`);
      i++;
    }
    if (province) {
      conditions.push(`province = $${i++}`);
      params.push(province);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const [data, count] = await Promise.all([
      pool.query(
        `SELECT id, npsn, name, city, province, created_at
         FROM schools ${where}
         ORDER BY name
         LIMIT $${i} OFFSET $${i + 1}`,
        [...params, limit, offset]
      ),
      pool.query(`SELECT COUNT(*) FROM schools ${where}`, params),
    ]);

    const total = parseInt(count.rows[0].count);
    res.json({
      schools: data.rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error("Admin schools list error:", err);
    res.status(500).json({ message: "Failed to fetch schools" });
  }
});

// ── GET /api/admin/schools/provinces ─────────────────────────────────────
router.get("/schools/provinces", async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT province FROM schools WHERE province IS NOT NULL ORDER BY province`
    );
    res.json(result.rows.map((r) => r.province));
  } catch (err) {
    console.error("Admin provinces error:", err);
    res.status(500).json({ message: "Failed to fetch provinces" });
  }
});

// ── POST /api/admin/schools ───────────────────────────────────────────────
router.post("/schools", audit({ action: "admin.school.create", resourceType: "school" }), async (req, res) => {
  try {
    const { npsn, name, city, province, address } = req.body;
    if (!npsn || !name) {
      res.status(400).json({ message: "npsn and name are required" });
      return;
    }
    const existing = await pool.query("SELECT id FROM schools WHERE npsn = $1", [npsn]);
    if (existing.rows.length > 0) {
      res.status(409).json({ message: "School with this NPSN already exists" });
      return;
    }
    const result = await pool.query(
      `INSERT INTO schools (npsn, name, city, province, address)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, npsn, name, city, province, created_at`,
      [npsn, name, city || null, province || null, address || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Admin create school error:", err);
    res.status(500).json({ message: "Failed to create school" });
  }
});

// ── GET /api/admin/schools/pending ────────────────────────────────────────
// List schools awaiting verification + the admin user who applied for each.
router.get("/schools/pending", async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.id, s.npsn, s.name, s.city, s.province, s.address,
              s.verification_status, s.verification_letter_url,
              s.applied_at, s.rejection_reason,
              u.id   AS applicant_user_id,
              u.full_name AS applicant_name,
              u.email     AS applicant_email,
              u.phone     AS applicant_phone
         FROM schools s
    LEFT JOIN users   u ON u.id = s.applied_by_user_id
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
      applicant: r.applicant_user_id ? {
        id: r.applicant_user_id, name: r.applicant_name, email: r.applicant_email, phone: r.applicant_phone,
      } : null,
    })));
  } catch (err) {
    console.error("Pending schools list error:", err);
    res.status(500).json({ message: "Failed to load pending schools" });
  }
});

// ── POST /api/admin/schools/:id/verify ────────────────────────────────────
router.post("/schools/:id/verify",
  audit({ action: "admin.school.verify", resourceType: "school", resourceIdParam: "id" }),
  async (req, res) => {
    try {
      const result = await pool.query(
        `UPDATE schools
            SET verification_status = 'verified',
                verified_at = now(),
                verified_by_user_id = $1,
                rejection_reason = NULL
          WHERE id = $2 AND verification_status <> 'verified'
          RETURNING id, name, applied_by_user_id`,
        [req.userId, req.params.id]
      );
      if (result.rows.length === 0) {
        res.status(404).json({ message: "Pending school not found (or already verified)" });
        return;
      }
      const { applied_by_user_id } = result.rows[0];
      if (applied_by_user_id) {
        await pushService.sendPushNotification(
          applied_by_user_id,
          "School Verified",
          `Your school "${result.rows[0].name}" has been verified. You can now access the school portal.`,
          { type: "school_verified", schoolId: result.rows[0].id }
        );
      }
      res.json({ message: "School verified" });
    } catch (err) {
      console.error("Verify school error:", err);
      res.status(500).json({ message: "Failed to verify school" });
    }
  }
);

// ── POST /api/admin/schools/:id/reject ────────────────────────────────────
router.post("/schools/:id/reject",
  audit({ action: "admin.school.reject", resourceType: "school", resourceIdParam: "id" }),
  async (req, res) => {
    try {
      const reason = (req.body?.reason as string | undefined)?.trim();
      if (!reason) {
        res.status(400).json({ message: "reason is required" });
        return;
      }
      const result = await pool.query(
        `UPDATE schools
            SET verification_status = 'rejected',
                rejection_reason = $1,
                verified_at = NULL,
                verified_by_user_id = NULL
          WHERE id = $2 AND verification_status = 'pending_verification'
          RETURNING id, name, applied_by_user_id`,
        [reason, req.params.id]
      );
      if (result.rows.length === 0) {
        res.status(404).json({ message: "Pending school not found" });
        return;
      }
      const { applied_by_user_id } = result.rows[0];
      if (applied_by_user_id) {
        await pushService.sendPushNotification(
          applied_by_user_id,
          "School Application Rejected",
          `Your application for "${result.rows[0].name}" was rejected. Reason: ${reason}`,
          { type: "school_rejected", schoolId: result.rows[0].id, reason }
        );
      }
      res.json({ message: "School application rejected" });
    } catch (err) {
      console.error("Reject school error:", err);
      res.status(500).json({ message: "Failed to reject school" });
    }
  }
);

// ── GET /api/admin/users ──────────────────────────────────────────────────
router.get("/users", async (req, res) => {
  try {
    const page   = parseInt(req.query.page   as string) || 1;
    const limit  = parseInt(req.query.limit  as string) || 25;
    const role   = req.query.role   as string | undefined;
    const search = req.query.search as string | undefined;
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: unknown[]    = [];
    let   i = 1;

    if (role)   { conditions.push(`role = $${i++}`);                                       params.push(role); }
    if (search) { conditions.push(`(full_name ILIKE $${i} OR email ILIKE $${i})`); params.push(`%${search}%`); i++; }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const [data, count] = await Promise.all([
      pool.query(
        `SELECT id, email, full_name, phone, city, role, created_at
         FROM users ${where}
         ORDER BY created_at DESC
         LIMIT $${i} OFFSET $${i + 1}`,
        [...params, limit, offset]
      ),
      pool.query(`SELECT COUNT(*) FROM users ${where}`, params),
    ]);

    const total = parseInt(count.rows[0].count);
    res.json({
      users: data.rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error("Admin users list error:", err);
    res.status(500).json({ message: "Failed to fetch users" });
  }
});

// ── POST /api/admin/notifications/broadcast ───────────────────────────────
router.post("/notifications/broadcast", audit({ action: "admin.notification.broadcast", resourceType: "broadcast" }), async (req, res) => {
  try {
    const { title, body, type, school_ids, competition_id, scheduled_for } = req.body;

    if (!title || !body || !type) {
      res.status(400).json({ message: "title, body, and type are required" });
      return;
    }
    if (!Array.isArray(school_ids) || school_ids.length === 0) {
      res.status(400).json({ message: "school_ids must be a non-empty array" });
      return;
    }

    // Get all user IDs linked to those schools
    const usersResult = await pool.query(
      `SELECT id FROM users WHERE school_id = ANY($1::uuid[])`,
      [school_ids]
    );

    if (usersResult.rows.length === 0) {
      res.json({ sent: 0, schools: school_ids.length, message: "No users found in selected schools" });
      return;
    }

    const userIds: string[] = usersResult.rows.map((r) => r.id);
    const data: Record<string, unknown> = { type };
    if (competition_id) data.competition_id = competition_id;

    const placeholders = userIds
      .map((_, idx) => {
        const b = idx * 6;
        return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6})`;
      })
      .join(", ");

    const values: unknown[] = [];
    for (const uid of userIds) {
      values.push(uid, type, title, body, JSON.stringify(data), scheduled_for || null);
    }

    await pool.query(
      `INSERT INTO notifications (user_id, type, title, body, data, scheduled_for)
       VALUES ${placeholders}`,
      values
    );

    res.json({
      sent: userIds.length,
      schools: school_ids.length,
      message: `Sent to ${userIds.length} users across ${school_ids.length} school(s)`,
    });
  } catch (err) {
    console.error("Broadcast notification error:", err);
    res.status(500).json({ message: "Failed to send notifications" });
  }
});

// ── POST /api/admin/payments/:id/refund ──────────────────────────────────────
// Issues a Midtrans refund for a settled payment and marks the registration refunded.
// Body: { reason?: string }
router.post("/payments/:id/refund", audit({ action: "admin.payment.refund", resourceType: "payment", resourceIdParam: "id" }), async (req, res) => {
  try {
    const { id } = req.params;
    const reason: string = req.body?.reason || "Admin-initiated refund";

    // Load payment + linked registration
    const paymentResult = await pool.query(
      `SELECT p.id, p.payment_id, p.amount, p.payment_status, p.registration_id,
              r.status AS reg_status
       FROM payments p
       JOIN registrations r ON r.id = p.registration_id
       WHERE p.id = $1`,
      [id]
    );

    if (paymentResult.rows.length === 0) {
      res.status(404).json({ message: "Payment not found" });
      return;
    }

    const payment = paymentResult.rows[0];

    if (payment.payment_status === "refunded") {
      res.status(409).json({ message: "Payment has already been refunded" });
      return;
    }

    if (payment.payment_status !== "paid") {
      res.status(400).json({
        message: `Cannot refund a payment with status '${payment.payment_status}'. Only paid payments can be refunded.`,
      });
      return;
    }

    if (!payment.payment_id) {
      res.status(400).json({ message: "No Midtrans order ID on record for this payment" });
      return;
    }

    // Call Midtrans refund API
    const refundResult = await refundPayment(payment.payment_id, payment.amount, reason);

    // Update payment and registration status
    await pool.query(
      "UPDATE payments SET payment_status = 'refunded', updated_at = now() WHERE id = $1",
      [id]
    );
    await pool.query(
      "UPDATE registrations SET payment_status = 'refunded', status = 'refunded', updated_at = now() WHERE id = $1",
      [payment.registration_id]
    );

    res.json({
      message: "Refund issued successfully",
      refundKey: refundResult.refundKey,
      refundStatus: refundResult.status,
      refundAmount: refundResult.refundAmount,
    });
  } catch (err: unknown) {
    console.error("POST /admin/payments/:id/refund error:", err);
    const msg = err instanceof Error ? err.message : "Failed to process refund";
    res.status(500).json({ message: msg });
  }
});

export default router;
