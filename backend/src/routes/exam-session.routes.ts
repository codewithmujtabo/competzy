import { Router, Request, Response } from "express";
import { pool } from "../config/database";
import { authMiddleware } from "../middleware/auth";
import {
  autoGradeMcPeriods,
  recomputeSessionRollups,
  sessionHasPendingGrading,
} from "../services/exam-grading.service";

// Online exam attempt API (EMC Wave 7 Phase 3). Student-facing — any
// authenticated user; every session is owned by `req.userId` and each route
// checks that ownership. Mounted at /api.
//   GET  /exams/available?compId=
//   POST /exams/:examId/sessions          start / resume an attempt
//   GET  /sessions/:id                    leak-safe — never serves answer keys
//   PUT  /sessions/:id/periods/:periodId  save one answer
//   POST /sessions/:id/submit             finish + MC auto-grade

const router = Router();
router.use(authMiddleware);

// Registration statuses that clear a student to sit a competition's exam.
const CLEARED = ["registered", "approved", "paid", "completed"];

// The caller's grade for a competition (registration snapshot first, then the
// students row) and whether they hold a cleared registration.
async function studentContext(userId: string, compId: string) {
  const r = await pool.query(
    `SELECT r.profile_snapshot, st.grade AS student_grade
       FROM registrations r
       LEFT JOIN students st ON st.id = r.user_id
      WHERE r.user_id = $1 AND r.comp_id = $2 AND r.deleted_at IS NULL
        AND r.status = ANY($3)
      ORDER BY r.created_at DESC LIMIT 1`,
    [userId, compId, CLEARED]
  );
  if (r.rows.length === 0) return { registered: false, grade: null as string | null };
  const snap = r.rows[0].profile_snapshot;
  const snapGrade =
    snap && typeof snap === "object" && typeof snap.grade === "string" ? snap.grade : null;
  return { registered: true, grade: (snapGrade || r.rows[0].student_grade || null) as string | null };
}

type WindowStatus = "unscheduled" | "upcoming" | "open" | "closed";

// `date` is 'YYYY-MM-DD', times are 'HH:MM:SS' — cast ::text in SQL. Parsed as
// server-local time (no Z), consistent with the rest of the platform.
function windowStatus(
  date: string | null,
  startTime: string | null,
  endTime: string | null
): WindowStatus {
  if (!date) return "unscheduled";
  const start = new Date(`${date}T${startTime || "00:00:00"}`);
  const end = new Date(`${date}T${endTime || "23:59:59"}`);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return "unscheduled";
  const now = new Date();
  if (now < start) return "upcoming";
  if (now > end) return "closed";
  return "open";
}

// The hard deadline for an in-progress attempt — the earlier of the per-attempt
// duration and the exam's closing time.
function attemptDeadline(
  startedAt: Date,
  minutes: number | null,
  date: string | null,
  endTime: string | null
): Date {
  const candidates: number[] = [];
  if (minutes) candidates.push(startedAt.getTime() + minutes * 60000);
  if (date) {
    const w = new Date(`${date}T${endTime || "23:59:59"}`);
    if (!isNaN(w.getTime())) candidates.push(w.getTime());
  }
  if (candidates.length === 0) return new Date(startedAt.getTime() + 3 * 3600 * 1000);
  return new Date(Math.min(...candidates));
}

// ── GET /api/exams/available?compId= ──────────────────────────────────────
router.get("/exams/available", async (req: Request, res: Response) => {
  try {
    const compId = String(req.query.compId ?? "");
    if (!compId) {
      res.status(400).json({ message: "compId is required" });
      return;
    }
    const ctx = await studentContext(req.userId!, compId);
    if (!ctx.registered || !ctx.grade) {
      res.json([]);
      return;
    }
    const exams = await pool.query(
      `SELECT id, name, code, minutes, date::text AS date,
              start_time::text AS start_time, end_time::text AS end_time
         FROM exams
        WHERE comp_id = $1 AND deleted_at IS NULL AND grades @> $2::jsonb
        ORDER BY date ASC NULLS LAST, name ASC`,
      [compId, JSON.stringify([ctx.grade])]
    );
    const sessions = await pool.query(
      `SELECT id, exam_id, finished_at FROM sessions
        WHERE user_id = $1 AND comp_id = $2 AND deleted_at IS NULL`,
      [req.userId, compId]
    );
    const byExam = new Map<string, any>();
    for (const s of sessions.rows) byExam.set(s.exam_id, s);
    res.json(
      exams.rows.map((e) => {
        const s = byExam.get(e.id);
        return {
          examId: e.id,
          name: e.name,
          code: e.code,
          minutes: e.minutes ?? null,
          date: e.date,
          startTime: e.start_time,
          endTime: e.end_time,
          windowStatus: windowStatus(e.date, e.start_time, e.end_time),
          session: s ? { id: s.id, state: s.finished_at ? "finished" : "in_progress" } : null,
        };
      })
    );
  } catch (err) {
    console.error("List available exams error:", err);
    res.status(500).json({ message: "Failed to load exams" });
  }
});

// ── POST /api/exams/:examId/sessions ──────────────────────────────────────
router.post("/exams/:examId/sessions", async (req: Request, res: Response) => {
  try {
    const examId = String(req.params.examId);
    const ex = await pool.query(
      `SELECT id, comp_id, grades, date::text AS date,
              start_time::text AS start_time, end_time::text AS end_time
         FROM exams WHERE id = $1 AND deleted_at IS NULL`,
      [examId]
    );
    if (ex.rows.length === 0) {
      res.status(404).json({ message: "Exam not found" });
      return;
    }
    const exam = ex.rows[0];
    const ctx = await studentContext(req.userId!, exam.comp_id);
    if (!ctx.registered) {
      res.status(403).json({ message: "You are not registered for this competition" });
      return;
    }
    const grades = Array.isArray(exam.grades) ? exam.grades : [];
    if (!ctx.grade || !grades.includes(ctx.grade)) {
      res.status(403).json({ message: "This exam is not available for your grade" });
      return;
    }
    if (windowStatus(exam.date, exam.start_time, exam.end_time) !== "open") {
      res.status(409).json({ message: "This exam is not open for sitting right now" });
      return;
    }
    // Resume an unfinished attempt; block a re-attempt of a finished one.
    const existing = await pool.query(
      `SELECT id, finished_at FROM sessions
        WHERE user_id = $1 AND exam_id = $2 AND deleted_at IS NULL LIMIT 1`,
      [req.userId, examId]
    );
    if (existing.rows.length > 0) {
      if (existing.rows[0].finished_at) {
        res.status(409).json({ message: "You have already completed this exam" });
        return;
      }
      res.json({ sessionId: existing.rows[0].id, resumed: true });
      return;
    }
    const questions = await pool.query(
      `SELECT q.id, q.type FROM exam_question eq
         JOIN questions q ON q.id = eq.question_id
        WHERE eq.exam_id = $1 AND q.deleted_at IS NULL
        ORDER BY q.code ASC`,
      [examId]
    );
    if (questions.rows.length === 0) {
      res.status(409).json({ message: "This exam has no questions yet" });
      return;
    }
    // Snapshot the question set into `periods` so a later exam edit can't
    // change the student's paper.
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const sess = await client.query(
        `INSERT INTO sessions (comp_id, user_id, exam_id, grade, started_at)
         VALUES ($1,$2,$3,$4, now()) RETURNING id`,
        [exam.comp_id, req.userId, examId, ctx.grade]
      );
      const sessionId = sess.rows[0].id as string;
      let n = 1;
      for (const q of questions.rows) {
        await client.query(
          `INSERT INTO periods (comp_id, session_id, question_id, type, number)
           VALUES ($1,$2,$3,$4,$5)`,
          [exam.comp_id, sessionId, q.id, q.type === "short_answer" ? "short" : "choice", n++]
        );
      }
      await client.query("COMMIT");
      res.status(201).json({ sessionId, resumed: false });
    } catch (txErr) {
      await client.query("ROLLBACK");
      throw txErr;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Start session error:", err);
    res.status(500).json({ message: "Failed to start the exam" });
  }
});

// ── GET /api/sessions/:id ─────────────────────────────────────────────────
// Leak-safe: never selects answers.is_correct or questions.explanation.
router.get("/sessions/:id", async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const s = await pool.query(
      `SELECT s.id, s.started_at, s.finished_at,
              e.name AS exam_name, e.minutes, e.date::text AS date,
              e.end_time::text AS end_time
         FROM sessions s JOIN exams e ON e.id = s.exam_id
        WHERE s.id = $1 AND s.user_id = $2 AND s.deleted_at IS NULL`,
      [id, req.userId]
    );
    if (s.rows.length === 0) {
      res.status(404).json({ message: "Session not found" });
      return;
    }
    const sess = s.rows[0];
    const periods = await pool.query(
      `SELECT p.id, p.number, p.type, p.question_id, p.answer_id, p.short_answer,
              q.content AS question_content
         FROM periods p JOIN questions q ON q.id = p.question_id
        WHERE p.session_id = $1 AND p.deleted_at IS NULL
        ORDER BY p.number ASC`,
      [id]
    );
    const choiceQids = [
      ...new Set(periods.rows.filter((p) => p.type === "choice").map((p) => p.question_id)),
    ];
    const optionsByQ = new Map<string, { id: string; content: string }[]>();
    if (choiceQids.length > 0) {
      const ans = await pool.query(
        `SELECT id, question_id, content FROM answers
          WHERE question_id = ANY($1::uuid[]) AND deleted_at IS NULL
          ORDER BY created_at ASC`,
        [choiceQids]
      );
      for (const a of ans.rows) {
        if (!optionsByQ.has(a.question_id)) optionsByQ.set(a.question_id, []);
        optionsByQ.get(a.question_id)!.push({ id: a.id, content: a.content ?? "" });
      }
    }
    const deadline = sess.started_at
      ? attemptDeadline(new Date(sess.started_at), sess.minutes, sess.date, sess.end_time)
      : null;
    res.json({
      id: sess.id,
      examName: sess.exam_name,
      startedAt: sess.started_at,
      finishedAt: sess.finished_at ?? null,
      deadline: deadline ? deadline.toISOString() : null,
      remainingSeconds: deadline
        ? Math.max(0, Math.floor((deadline.getTime() - Date.now()) / 1000))
        : null,
      periods: periods.rows.map((p) => ({
        id: p.id,
        number: p.number,
        type: p.type,
        questionContent: p.question_content ?? "",
        options: p.type === "choice" ? optionsByQ.get(p.question_id) ?? [] : [],
        answerId: p.answer_id ?? null,
        shortAnswer: p.short_answer ?? null,
      })),
    });
  } catch (err) {
    console.error("Get session error:", err);
    res.status(500).json({ message: "Failed to load the session" });
  }
});

// ── PUT /api/sessions/:id/periods/:periodId ───────────────────────────────
router.put("/sessions/:id/periods/:periodId", async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const periodId = String(req.params.periodId);
    const s = await pool.query(
      `SELECT s.started_at, s.finished_at, e.minutes, e.date::text AS date,
              e.end_time::text AS end_time
         FROM sessions s JOIN exams e ON e.id = s.exam_id
        WHERE s.id = $1 AND s.user_id = $2 AND s.deleted_at IS NULL`,
      [id, req.userId]
    );
    if (s.rows.length === 0) {
      res.status(404).json({ message: "Session not found" });
      return;
    }
    if (s.rows[0].finished_at) {
      res.status(409).json({ message: "This exam has already been submitted" });
      return;
    }
    const deadline = attemptDeadline(
      new Date(s.rows[0].started_at),
      s.rows[0].minutes,
      s.rows[0].date,
      s.rows[0].end_time
    );
    if (Date.now() > deadline.getTime()) {
      res.status(409).json({ message: "Time is up — submit the exam to finish" });
      return;
    }
    const p = await pool.query(
      `SELECT id, type, question_id FROM periods
        WHERE id = $1 AND session_id = $2 AND deleted_at IS NULL`,
      [periodId, id]
    );
    if (p.rows.length === 0) {
      res.status(404).json({ message: "Question not found in this session" });
      return;
    }
    const period = p.rows[0];
    if (period.type === "choice") {
      const answerId = req.body?.answerId ? String(req.body.answerId) : null;
      if (answerId) {
        const valid = await pool.query(
          `SELECT 1 FROM answers WHERE id = $1 AND question_id = $2 AND deleted_at IS NULL`,
          [answerId, period.question_id]
        );
        if (valid.rows.length === 0) {
          res.status(400).json({ message: "Invalid answer option" });
          return;
        }
      }
      await pool.query(
        `UPDATE periods SET answer_id = $1, finished_at = now(), updated_at = now() WHERE id = $2`,
        [answerId, periodId]
      );
    } else {
      const shortAnswer = typeof req.body?.shortAnswer === "string" ? req.body.shortAnswer : "";
      await pool.query(
        `UPDATE periods SET short_answer = $1, finished_at = now(), updated_at = now() WHERE id = $2`,
        [shortAnswer, periodId]
      );
    }
    res.json({ saved: true });
  } catch (err) {
    console.error("Save answer error:", err);
    res.status(500).json({ message: "Failed to save the answer" });
  }
});

// ── POST /api/sessions/:id/submit ─────────────────────────────────────────
router.post("/sessions/:id/submit", async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const s = await pool.query(
      `SELECT id, finished_at FROM sessions
        WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
      [id, req.userId]
    );
    if (s.rows.length === 0) {
      res.status(404).json({ message: "Session not found" });
      return;
    }
    if (s.rows[0].finished_at) {
      // Idempotent — already submitted.
      res.json({ finished: true, awaitingGrading: await sessionHasPendingGrading(pool, id) });
      return;
    }
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `UPDATE sessions SET finished_at = now(), updated_at = now() WHERE id = $1`,
        [id]
      );
      await autoGradeMcPeriods(client, id);
      await recomputeSessionRollups(client, id);
      await client.query("COMMIT");
    } catch (txErr) {
      await client.query("ROLLBACK");
      throw txErr;
    } finally {
      client.release();
    }
    res.json({ finished: true, awaitingGrading: await sessionHasPendingGrading(pool, id) });
  } catch (err) {
    console.error("Submit session error:", err);
    res.status(500).json({ message: "Failed to submit the exam" });
  }
});

export default router;
