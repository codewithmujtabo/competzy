import { Router, Request, Response } from "express";
import { pool } from "../config/database";
import { authMiddleware } from "../middleware/auth";
import PDFDocument from "pdfkit";

const router = Router();
router.use(authMiddleware);

// Statuses surfaced by the registrations status tabs (mirrors
// /api/schools/registrations).
const STATUS_TABS = [
  "pending_review",
  "pending_payment",
  "approved",
  "registered",
  "paid",
  "rejected",
];

// ── POST /api/teachers/link-student ──────────────────────────────────────────
// Teacher adds a student to their roster by email.
router.post("/link-student", async (req: Request, res: Response) => {
  try {
    const teacherId = req.userId!;
    const { email } = req.body;

    if (!email?.trim()) {
      res.status(400).json({ message: "Student email is required" });
      return;
    }

    const studentResult = await pool.query(
      "SELECT id, full_name FROM users WHERE email = $1 AND role = 'student'",
      [email.trim().toLowerCase()]
    );

    if (studentResult.rows.length === 0) {
      res.status(404).json({ message: "No student account found with that email" });
      return;
    }

    const { id: studentId, full_name } = studentResult.rows[0];

    await pool.query(
      `INSERT INTO teacher_student_links (teacher_id, student_id)
       VALUES ($1, $2)
       ON CONFLICT (teacher_id, student_id) DO NOTHING`,
      [teacherId, studentId]
    );

    res.status(201).json({ message: `${full_name} added to your roster`, studentId, fullName: full_name });
  } catch (err) {
    console.error("Link student error:", err);
    res.status(500).json({ message: "Failed to link student" });
  }
});

// ── DELETE /api/teachers/link-student/:studentId ─────────────────────────────
// Teacher removes a student from their roster.
router.delete("/link-student/:studentId", async (req: Request, res: Response) => {
  try {
    const teacherId = req.userId!;
    const { studentId } = req.params;

    await pool.query(
      "DELETE FROM teacher_student_links WHERE teacher_id = $1 AND student_id = $2",
      [teacherId, studentId]
    );

    res.json({ message: "Student removed from your roster" });
  } catch (err) {
    console.error("Unlink student error:", err);
    res.status(500).json({ message: "Failed to remove student" });
  }
});

// ── GET /api/teachers/my-students ─────────────────────────────────────────────
// Returns only students linked to this teacher.
router.get("/my-students", async (req: Request, res: Response) => {
  try {
    const teacherId = req.userId!;

    const result = await pool.query(
      `SELECT
         u.id,
         u.full_name,
         u.email,
         u.photo_url,
         s.nisn,
         s.grade,
         s.school_name,
         COUNT(r.id) AS registration_count
       FROM teacher_student_links tsl
       JOIN users u ON u.id = tsl.student_id
       JOIN students s ON s.id = u.id
       LEFT JOIN registrations r ON r.user_id = u.id
       WHERE tsl.teacher_id = $1
       GROUP BY u.id, u.full_name, u.email, u.photo_url, s.nisn, s.grade, s.school_name
       ORDER BY u.full_name ASC`,
      [teacherId]
    );

    const students = result.rows.map((row) => ({
      id: row.id,
      fullName: row.full_name,
      email: row.email,
      photoUrl: row.photo_url,
      nisn: row.nisn,
      grade: row.grade,
      school: row.school_name,
      registrationCount: parseInt(row.registration_count),
    }));

    res.json({
      students,
      stats: {
        totalStudents: students.length,
        totalRegistrations: students.reduce((s, r) => s + r.registrationCount, 0),
        activeStudents: students.filter((r) => r.registrationCount > 0).length,
      },
    });
  } catch (err) {
    console.error("Get my students error:", err);
    res.status(500).json({ message: "Failed to fetch students" });
  }
});

// ── GET /api/teachers/my-competitions ─────────────────────────────────────────
// Returns competitions that have at least one of this teacher's students registered,
// with the list of which students are registered for each.
router.get("/my-competitions", async (req: Request, res: Response) => {
  try {
    const teacherId = req.userId!;

    const result = await pool.query(
      `SELECT
         c.id AS comp_id,
         c.name AS comp_name,
         c.category,
         c.fee,
         c.reg_close_date,
         c.competition_date,
         r.id AS reg_id,
         r.status AS reg_status,
         r.registration_number,
         u.id AS student_id,
         u.full_name AS student_name,
         s.grade
       FROM teacher_student_links tsl
       JOIN registrations r ON r.user_id = tsl.student_id
       JOIN competitions c ON c.id = r.comp_id
       JOIN users u ON u.id = tsl.student_id
       JOIN students s ON s.id = u.id
       WHERE tsl.teacher_id = $1
       ORDER BY c.name ASC, u.full_name ASC`,
      [teacherId]
    );

    // Group by competition
    const compMap = new Map<string, {
      id: string;
      name: string;
      category: string | null;
      fee: number;
      regCloseDate: string | null;
      competitionDate: string | null;
      students: { id: string; fullName: string; grade: string; status: string; registrationNumber: string | null; registrationId: string }[];
    }>();

    for (const row of result.rows) {
      if (!compMap.has(row.comp_id)) {
        compMap.set(row.comp_id, {
          id: row.comp_id,
          name: row.comp_name,
          category: row.category,
          fee: row.fee,
          regCloseDate: row.reg_close_date,
          competitionDate: row.competition_date,
          students: [],
        });
      }
      compMap.get(row.comp_id)!.students.push({
        id: row.student_id,
        fullName: row.student_name,
        grade: row.grade,
        status: row.reg_status,
        registrationNumber: row.registration_number,
        registrationId: row.reg_id,
      });
    }

    res.json({ competitions: Array.from(compMap.values()) });
  } catch (err) {
    console.error("Get my competitions error:", err);
    res.status(500).json({ message: "Failed to fetch competitions" });
  }
});

// ── GET /api/teachers/dashboard-summary ───────────────────────────────────────
// Summary stats for dashboard — scoped to teacher's linked students only.
router.get("/dashboard-summary", async (req: Request, res: Response) => {
  try {
    const teacherId = req.userId!;

    const result = await pool.query(
      `SELECT
         COUNT(DISTINCT tsl.student_id) AS total_students,
         COUNT(r.id) AS total_registrations,
         COUNT(DISTINCT CASE WHEN r.status IN ('paid','approved','completed') THEN r.id END) AS confirmed_registrations,
         COUNT(DISTINCT CASE WHEN r.created_at >= NOW() - INTERVAL '30 days' THEN tsl.student_id END) AS active_students
       FROM teacher_student_links tsl
       LEFT JOIN registrations r ON r.user_id = tsl.student_id
       WHERE tsl.teacher_id = $1`,
      [teacherId]
    );

    const row = result.rows[0];

    res.json({
      totalStudents: parseInt(row.total_students),
      totalRegistrations: parseInt(row.total_registrations),
      confirmedRegistrations: parseInt(row.confirmed_registrations),
      activeStudents: parseInt(row.active_students),
    });
  } catch (err) {
    console.error("Get dashboard summary error:", err);
    res.status(500).json({ message: "Failed to fetch summary" });
  }
});

// ── GET /api/teachers/upcoming-deadlines ─────────────────────────────────────
// Competitions with approaching deadlines that any of this teacher's students
// are registered for (or have not yet registered for but are open).
router.get("/upcoming-deadlines", async (req: Request, res: Response) => {
  try {
    const teacherId = req.userId!;

    const result = await pool.query(
      `SELECT
         c.id,
         c.name,
         c.reg_close_date,
         COUNT(DISTINCT r.user_id) AS registered_count,
         EXTRACT(DAY FROM (c.reg_close_date - NOW())) AS days_left
       FROM competitions c
       LEFT JOIN registrations r ON r.comp_id = c.id
         AND r.user_id IN (
           SELECT student_id FROM teacher_student_links WHERE teacher_id = $1
         )
       WHERE c.reg_close_date > NOW()
         AND c.reg_close_date <= NOW() + INTERVAL '30 days'
       GROUP BY c.id, c.name, c.reg_close_date
       ORDER BY c.reg_close_date ASC
       LIMIT 5`,
      [teacherId]
    );

    res.json(
      result.rows.map((row) => ({
        id: row.id,
        competition: row.name,
        deadline: new Date(row.reg_close_date).toLocaleDateString("id-ID", {
          day: "numeric", month: "short", year: "numeric",
        }),
        daysLeft: Math.max(0, parseInt(row.days_left)),
        registeredCount: parseInt(row.registered_count),
        status: parseInt(row.days_left) <= 7 ? "urgent" : "upcoming",
      }))
    );
  } catch (err) {
    console.error("Get upcoming deadlines error:", err);
    res.status(500).json({ message: "Failed to fetch deadlines" });
  }
});

// ── Legacy endpoints kept for compatibility (now scoped to teacher's students) ─

router.get("/students", async (req: Request, res: Response) => {
  // Redirect to my-students with search/grade support for backward compat
  try {
    const teacherId = req.userId!;
    const { search = "", grade = "" } = req.query;

    let query = `
      SELECT
        u.id, u.full_name, u.email, u.photo_url,
        s.nisn, s.grade, s.school_name,
        COUNT(r.id) AS registration_count
      FROM teacher_student_links tsl
      JOIN users u ON u.id = tsl.student_id
      JOIN students s ON s.id = u.id
      LEFT JOIN registrations r ON r.user_id = u.id
      WHERE tsl.teacher_id = $1
    `;

    const params: unknown[] = [teacherId];
    let idx = 2;

    if (search) {
      query += ` AND (u.full_name ILIKE $${idx} OR u.email ILIKE $${idx})`;
      params.push(`%${search}%`);
      idx++;
    }
    if (grade) {
      query += ` AND s.grade = $${idx}`;
      params.push(grade);
      idx++;
    }

    query += ` GROUP BY u.id, u.full_name, u.email, u.photo_url, s.nisn, s.grade, s.school_name
               ORDER BY u.full_name ASC`;

    const result = await pool.query(query, params);
    const students = result.rows.map((row) => ({
      id: row.id,
      fullName: row.full_name,
      email: row.email,
      photoUrl: row.photo_url,
      nisn: row.nisn,
      grade: row.grade,
      school: row.school_name,
      registrationCount: parseInt(row.registration_count),
    }));

    res.json({
      students,
      stats: {
        totalStudents: students.length,
        totalRegistrations: students.reduce((s, r) => s + r.registrationCount, 0),
        activeStudents: students.filter((r) => r.registrationCount > 0).length,
      },
    });
  } catch (err) {
    console.error("Get teacher students error:", err);
    res.status(500).json({ message: "Failed to fetch students" });
  }
});

// ── GET /api/teachers/registrations ──────────────────────────────────────
// Mirrors /api/schools/registrations exactly — same shape, same pagination —
// but scoped to the teacher's roster via teacher_student_links instead of the
// school FK. Lets the existing web /school-registrations page swap the
// endpoint when the caller is a teacher and re-use the status tabs + filters.
router.get("/registrations", async (req: Request, res: Response) => {
  try {
    const teacherId = req.userId!;
    const { compId, status, page = "1", limit = "50" } = req.query;

    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(String(limit), 10) || 50));
    const offset = (pageNum - 1) * limitNum;

    const params: unknown[] = [teacherId];
    let idx = 2;
    let where = "tsl.teacher_id = $1";
    if (compId) {
      where += ` AND c.id = $${idx++}`;
      params.push(compId);
    }
    if (status) {
      where += ` AND r.status = $${idx++}`;
      params.push(status);
    }

    const rowsRes = await pool.query(
      `SELECT
         r.id AS registration_id,
         r.status,
         r.created_at AS registered_at,
         u.id AS student_id,
         u.full_name AS student_name,
         u.email AS student_email,
         s.grade,
         c.id AS competition_id,
         c.name AS competition_name,
         c.category,
         c.fee AS competition_fee,
         c.grade_level AS level,
         c.competition_date AS start_date,
         c.reg_close_date
       FROM teacher_student_links tsl
       JOIN users u ON u.id = tsl.student_id
       JOIN registrations r ON r.user_id = u.id AND r.deleted_at IS NULL
       LEFT JOIN students s ON s.id = u.id
       JOIN competitions c ON c.id = r.comp_id
      WHERE ${where}
      ORDER BY r.created_at DESC
      LIMIT $${idx++} OFFSET $${idx}`,
      [...params, limitNum, offset],
    );

    const countRes = await pool.query(
      `SELECT COUNT(*)::int AS total
         FROM teacher_student_links tsl
         JOIN users u ON u.id = tsl.student_id
         JOIN registrations r ON r.user_id = u.id AND r.deleted_at IS NULL
         JOIN competitions c ON c.id = r.comp_id
        WHERE ${where}`,
      params,
    );

    const total = countRes.rows[0]?.total ?? 0;

    res.json({
      registrations: rowsRes.rows.map((row) => ({
        registrationId: row.registration_id,
        status: row.status,
        registeredAt: row.registered_at,
        student: {
          id: row.student_id,
          name: row.student_name,
          email: row.student_email,
          grade: row.grade,
        },
        competition: {
          id: row.competition_id,
          name: row.competition_name,
          category: row.category,
          fee: Number(row.competition_fee ?? 0),
          level: row.level,
          startDate: row.start_date,
          regCloseDate: row.reg_close_date,
        },
      })),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.max(1, Math.ceil(total / limitNum)),
      },
      statusTabs: STATUS_TABS,
    });
  } catch (err) {
    console.error("Get teacher registrations error:", err);
    res.status(500).json({ message: "Failed to fetch registrations" });
  }
});

// ── GET /api/teachers/export/registrations/pdf ───────────────────────────
// PDF parity with /api/schools/export/registrations/pdf, scoped to the
// teacher's roster.
router.get("/export/registrations/pdf", async (req: Request, res: Response) => {
  try {
    const teacherId = req.userId!;
    const teacherRow = await pool.query(
      "SELECT full_name FROM users WHERE id = $1",
      [teacherId],
    );
    const teacherName: string = teacherRow.rows[0]?.full_name ?? "Teacher";

    const summary = await pool.query(
      `SELECT
         c.name AS competition_name,
         c.category,
         c.grade_level AS level,
         COUNT(*)::int AS registration_count,
         COUNT(*) FILTER (WHERE r.status = 'paid')::int AS paid_count,
         COUNT(*) FILTER (WHERE r.status = 'registered')::int AS registered_count
       FROM teacher_student_links tsl
       JOIN registrations r ON r.user_id = tsl.student_id AND r.deleted_at IS NULL
       JOIN competitions c ON c.id = r.comp_id
      WHERE tsl.teacher_id = $1
      GROUP BY c.id, c.name, c.category, c.grade_level
      ORDER BY registration_count DESC
      LIMIT 50`,
      [teacherId],
    );

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="registrations-${Date.now()}.pdf"`,
    );

    const doc = new PDFDocument({ margin: 50 });
    doc.pipe(res);

    doc.fontSize(20).text("Registration Report", { align: "center" });
    doc.moveDown();
    doc.fontSize(14).text(`Teacher: ${teacherName}`);
    doc.fontSize(12).text(`Generated: ${new Date().toLocaleDateString()}`);
    doc.moveDown();
    doc.fontSize(14).text("Competition Summary", { underline: true });
    doc.moveDown(0.5);

    if (summary.rows.length === 0) {
      doc.fontSize(12).text("No registrations found for your roster.");
    } else {
      doc.fontSize(10);
      const y0 = doc.y;
      doc.text("Competition", 50, y0, { width: 200 });
      doc.text("Category", 260, y0, { width: 100 });
      doc.text("Total", 370, y0, { width: 50 });
      doc.text("Paid", 430, y0, { width: 50 });
      doc.text("Reg.", 490, y0, { width: 50 });
      doc.moveDown();
      for (const row of summary.rows) {
        const y = doc.y;
        doc.text(row.competition_name, 50, y, { width: 200 });
        doc.text(`${row.category} - ${row.level}`, 260, y, { width: 100 });
        doc.text(String(row.registration_count), 370, y, { width: 50 });
        doc.text(String(row.paid_count), 430, y, { width: 50 });
        doc.text(String(row.registered_count), 490, y, { width: 50 });
        doc.moveDown(0.8);
      }
    }
    doc.end();
  } catch (err) {
    console.error("Teacher registrations PDF error:", err);
    if (!res.headersSent) res.status(500).json({ message: "Failed to export PDF" });
  }
});

// ── GET /api/teachers/export/achievement.pdf ─────────────────────────────
// Achievement PDF parity with /api/schools/export/achievement.pdf, scoped to
// the teacher's roster. Aggregates historical_participants (claimed) and
// current registrations whose status indicates a final result.
router.get("/export/achievement.pdf", async (req: Request, res: Response) => {
  try {
    const teacherId = req.userId!;
    const teacherRow = await pool.query(
      "SELECT full_name FROM users WHERE id = $1",
      [teacherId],
    );
    const teacherName: string = teacherRow.rows[0]?.full_name ?? "Teacher";

    const historical = await pool.query(
      `SELECT u.full_name, hp.comp_name, hp.comp_year, hp.result, hp.event_part
         FROM teacher_student_links tsl
         JOIN users u ON u.id = tsl.student_id
         JOIN historical_participants hp ON hp.claimed_by = u.id
        WHERE tsl.teacher_id = $1 AND hp.result IS NOT NULL
        ORDER BY hp.comp_year DESC, u.full_name ASC
        LIMIT 1000`,
      [teacherId],
    );

    const current = await pool.query(
      `SELECT u.full_name, c.name AS comp_name,
              EXTRACT(YEAR FROM c.competition_date)::int AS comp_year,
              r.status AS result
         FROM teacher_student_links tsl
         JOIN users u ON u.id = tsl.student_id
         JOIN registrations r ON r.user_id = u.id AND r.deleted_at IS NULL
         JOIN competitions c ON c.id = r.comp_id
        WHERE tsl.teacher_id = $1
          AND r.status IN ('paid', 'approved', 'completed')
        ORDER BY c.competition_date DESC NULLS LAST, u.full_name ASC
        LIMIT 1000`,
      [teacherId],
    );

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="achievement-${teacherName.replace(/\W+/g, "-").toLowerCase()}-${Date.now()}.pdf"`,
    );

    const doc = new PDFDocument({ margin: 48, size: "A4" });
    doc.pipe(res);

    doc.fontSize(9).fillColor("#94A3B8").text("COMPETZY", { align: "right" });
    doc.moveDown(0.6);
    doc.fontSize(22).fillColor("#0F172A").font("Helvetica-Bold")
      .text(teacherName, { align: "left" });
    doc.fontSize(11).fillColor("#475569").font("Helvetica")
      .text("Teacher roster", { align: "left" });
    doc.moveDown(0.4);
    doc.fontSize(16).fillColor("#0F172A").font("Helvetica-Bold")
      .text("Student Achievement Report");
    doc.fontSize(10).fillColor("#94A3B8").font("Helvetica")
      .text(
        `Generated ${new Date().toLocaleDateString("en-GB", {
          day: "numeric", month: "long", year: "numeric",
        })}`,
      );
    doc.moveDown(1);

    const allRows = [
      ...historical.rows.map((r) => ({ ...r, source: "historical" })),
      ...current.rows.map((r) => ({ ...r, source: "current" })),
    ];

    if (allRows.length === 0) {
      doc.fontSize(12).fillColor("#475569")
        .text("No achievements recorded yet for your roster.");
      doc.end();
      return;
    }

    doc.fontSize(10).fillColor("#0F172A").font("Helvetica-Bold");
    const startY = doc.y;
    doc.text("Student", 48, startY, { width: 180 });
    doc.text("Competition", 232, startY, { width: 200 });
    doc.text("Year", 436, startY, { width: 40 });
    doc.text("Result", 480, startY, { width: 80 });
    doc.moveTo(48, doc.y + 4).lineTo(560, doc.y + 4)
      .strokeColor("#CBD5E1").lineWidth(0.5).stroke();
    doc.moveDown(0.6);

    doc.fontSize(10).font("Helvetica").fillColor("#0F172A");
    for (const row of allRows) {
      const y = doc.y;
      doc.text(String(row.full_name ?? "—"), 48, y, { width: 180 });
      doc.text(
        `${row.comp_name ?? "—"}${row.event_part ? ` (${row.event_part})` : ""}`,
        232, y, { width: 200 },
      );
      doc.text(String(row.comp_year ?? "—"), 436, y, { width: 40 });
      doc.text(String(row.result ?? "—").toUpperCase(), 480, y, { width: 80 });
      doc.moveDown(0.7);
      if (doc.y > 760) doc.addPage();
    }

    doc.moveDown(1.4);
    doc.fontSize(8).fillColor("#94A3B8")
      .text(
        "This report is generated from competition data registered on Competzy and historical competition records.",
        { align: "center" },
      );
    doc.end();
  } catch (err) {
    console.error("Teacher achievement PDF error:", err);
    if (!res.headersSent) res.status(500).json({ message: "Failed to generate achievement PDF" });
  }
});

export default router;
