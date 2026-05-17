import { Router, Request, Response } from "express";
import { pool } from "../config/database";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/require-role";
import { audit } from "../middleware/audit";
import { liveFilter, compFilter, softDelete } from "../db/query-helpers";
import { hasCompAccess } from "../services/comp-access.service";
import { recomputeSessionRollups, recomputePaperRollups } from "../services/exam-grading.service";

// Exam blueprint + builder + grading API (EMC Wave 7). Operator-facing — admin
// + organizer, native competitions only (the `hasCompAccess` gate). Mounted at
// /api; the `/question-bank/exams/*` + `/question-bank/grading/*` namespaces
// place exams inside the operator workspace alongside the question bank.

const router = Router();
// Path-scoped (this router is mounted at bare `/api`) so the operator gate does
// not 403 unrelated fall-through traffic — only `/question-bank/*` is gated.
router.use("/question-bank", authMiddleware);
router.use("/question-bank", requireRole("admin", "organizer"));

const EXAM_COLS = `id, comp_id, name, code, year, date, grades, choice, short,
  choice_count, short_count, start_time, end_time, minutes, correct_score,
  wrong_score, description, created_at, updated_at`;

// Resolve an exam's comp_id, then access-check. Returns the comp_id, or null if
// the exam is missing / soft-deleted / not in an accessible competition.
async function examCompIfAccessible(req: Request, examId: string): Promise<string | null> {
  const r = await pool.query(
    "SELECT comp_id FROM exams WHERE id = $1 AND deleted_at IS NULL",
    [examId]
  );
  if (r.rows.length === 0) return null;
  const compId = r.rows[0].comp_id as string;
  return (await hasCompAccess(req.userId!, req.userRole!, compId)) ? compId : null;
}

function mapExamRow(r: any) {
  return {
    id: r.id,
    compId: r.comp_id,
    name: r.name,
    code: r.code,
    year: r.year ?? null,
    date: r.date ?? null,
    grades: Array.isArray(r.grades) ? r.grades : [],
    choice: r.choice,
    short: r.short,
    choiceCount: r.choice_count ?? {},
    shortCount: r.short_count ?? {},
    startTime: r.start_time ?? null,
    endTime: r.end_time ?? null,
    minutes: r.minutes ?? null,
    correctScore: r.correct_score ?? {},
    wrongScore: r.wrong_score ?? {},
    description: r.description ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function mapExamQuestion(q: any) {
  return {
    id: q.id,
    code: q.code,
    type: q.type,
    content: q.content ?? "",
    status: q.status,
    grades: Array.isArray(q.grades) ? q.grades : [],
  };
}

// Load + map an exam's attached questions (live rows, code order).
async function loadExamQuestions(examId: string) {
  const r = await pool.query(
    `SELECT q.id, q.code, q.type, q.content, q.status, q.grades
       FROM exam_question eq
       JOIN questions q ON q.id = eq.question_id
      WHERE eq.exam_id = $1 AND q.deleted_at IS NULL
      ORDER BY q.code ASC`,
    [examId]
  );
  return r.rows.map(mapExamQuestion);
}

// Validate + normalise an exam create/update payload.
function parseExamBody(body: any): { error?: string; data?: any } {
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const code = typeof body?.code === "string" ? body.code.trim() : "";
  if (!name) return { error: "name is required" };
  if (!code) return { error: "code is required" };

  const num = (v: any): number | null =>
    v === null || v === undefined || v === "" || !Number.isFinite(Number(v))
      ? null
      : Number(v);
  const str = (v: any): string | null =>
    typeof v === "string" && v.trim() ? v.trim() : null;
  const jsonObj = (v: any) =>
    v && typeof v === "object" && !Array.isArray(v) ? v : {};

  return {
    data: {
      name,
      code,
      year: num(body?.year),
      date: str(body?.date), // 'YYYY-MM-DD'
      grades: Array.isArray(body?.grades) ? body.grades.map(String) : [],
      choice: body?.choice !== false, // default true
      short: !!body?.short,
      choiceCount: jsonObj(body?.choiceCount),
      shortCount: jsonObj(body?.shortCount),
      startTime: str(body?.startTime), // 'HH:MM'
      endTime: str(body?.endTime),
      minutes: num(body?.minutes),
      correctScore: jsonObj(body?.correctScore),
      wrongScore: jsonObj(body?.wrongScore),
      description: str(body?.description),
    },
  };
}

// ── GET /api/question-bank/exams?compId= ──────────────────────────────────
router.get("/question-bank/exams", async (req: Request, res: Response) => {
  try {
    const compId = String(req.query.compId ?? "");
    if (!compId || !(await hasCompAccess(req.userId!, req.userRole!, compId))) {
      res.status(403).json({ message: "No access to this competition" });
      return;
    }
    const r = await pool.query(
      `SELECT ${EXAM_COLS},
              (SELECT COUNT(*)::int FROM exam_question eq WHERE eq.exam_id = exams.id) AS question_count
         FROM exams
        WHERE ${compFilter()} AND ${liveFilter()}
        ORDER BY created_at DESC`,
      [compId]
    );
    res.json(r.rows.map((row) => ({ ...mapExamRow(row), questionCount: row.question_count })));
  } catch (err) {
    console.error("List exams error:", err);
    res.status(500).json({ message: "Failed to load exams" });
  }
});

// ── GET /api/question-bank/exams/:id ──────────────────────────────────────
router.get("/question-bank/exams/:id", async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    if (!(await examCompIfAccessible(req, id))) {
      res.status(404).json({ message: "Exam not found" });
      return;
    }
    const ex = await pool.query(`SELECT ${EXAM_COLS} FROM exams WHERE id = $1`, [id]);
    res.json({ ...mapExamRow(ex.rows[0]), questions: await loadExamQuestions(id) });
  } catch (err) {
    console.error("Get exam error:", err);
    res.status(500).json({ message: "Failed to load exam" });
  }
});

// ── POST /api/question-bank/exams ─────────────────────────────────────────
router.post(
  "/question-bank/exams",
  audit({ action: "exam.create", resourceType: "exam" }),
  async (req: Request, res: Response) => {
    try {
      const compId = String(req.body?.compId ?? "");
      if (!compId || !(await hasCompAccess(req.userId!, req.userRole!, compId))) {
        res.status(403).json({ message: "No access to this competition" });
        return;
      }
      const parsed = parseExamBody(req.body);
      if (parsed.error || !parsed.data) {
        res.status(400).json({ message: parsed.error });
        return;
      }
      const d = parsed.data;
      const inserted = await pool.query(
        `INSERT INTO exams
           (comp_id, name, code, year, date, grades, choice, short, choice_count,
            short_count, start_time, end_time, minutes, correct_score, wrong_score, description)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9::jsonb,$10::jsonb,$11,$12,$13,$14::jsonb,$15::jsonb,$16)
         RETURNING ${EXAM_COLS}`,
        [
          compId, d.name, d.code, d.year, d.date, JSON.stringify(d.grades),
          d.choice, d.short, JSON.stringify(d.choiceCount), JSON.stringify(d.shortCount),
          d.startTime, d.endTime, d.minutes, JSON.stringify(d.correctScore),
          JSON.stringify(d.wrongScore), d.description,
        ]
      );
      res.status(201).json({ ...mapExamRow(inserted.rows[0]), questions: [] });
    } catch (err: any) {
      if (err?.code === "23505") {
        res.status(409).json({ message: "An exam with this code already exists in this competition" });
        return;
      }
      console.error("Create exam error:", err);
      res.status(500).json({ message: "Failed to create exam" });
    }
  }
);

// ── PUT /api/question-bank/exams/:id ──────────────────────────────────────
router.put(
  "/question-bank/exams/:id",
  audit({ action: "exam.update", resourceType: "exam", resourceIdParam: "id" }),
  async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      if (!(await examCompIfAccessible(req, id))) {
        res.status(404).json({ message: "Exam not found" });
        return;
      }
      const parsed = parseExamBody(req.body);
      if (parsed.error || !parsed.data) {
        res.status(400).json({ message: parsed.error });
        return;
      }
      const d = parsed.data;
      const updated = await pool.query(
        `UPDATE exams SET
           name=$1, code=$2, year=$3, date=$4, grades=$5::jsonb, choice=$6, short=$7,
           choice_count=$8::jsonb, short_count=$9::jsonb, start_time=$10, end_time=$11,
           minutes=$12, correct_score=$13::jsonb, wrong_score=$14::jsonb, description=$15,
           updated_at=now()
         WHERE id=$16 RETURNING ${EXAM_COLS}`,
        [
          d.name, d.code, d.year, d.date, JSON.stringify(d.grades), d.choice, d.short,
          JSON.stringify(d.choiceCount), JSON.stringify(d.shortCount), d.startTime,
          d.endTime, d.minutes, JSON.stringify(d.correctScore), JSON.stringify(d.wrongScore),
          d.description, id,
        ]
      );
      res.json({ ...mapExamRow(updated.rows[0]), questions: await loadExamQuestions(id) });
    } catch (err: any) {
      if (err?.code === "23505") {
        res.status(409).json({ message: "An exam with this code already exists in this competition" });
        return;
      }
      console.error("Update exam error:", err);
      res.status(500).json({ message: "Failed to update exam" });
    }
  }
);

// ── DELETE /api/question-bank/exams/:id ───────────────────────────────────
router.delete(
  "/question-bank/exams/:id",
  audit({ action: "exam.delete", resourceType: "exam", resourceIdParam: "id" }),
  async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      if (!(await examCompIfAccessible(req, id))) {
        res.status(404).json({ message: "Exam not found" });
        return;
      }
      await softDelete("exams", id);
      res.json({ message: "Exam removed" });
    } catch (err) {
      console.error("Delete exam error:", err);
      res.status(500).json({ message: "Failed to delete exam" });
    }
  }
);

// ── PUT /api/question-bank/exams/:id/questions ────────────────────────────
// Replace the exam's question set. Every question must be an approved, live
// question of the SAME competition.
router.put(
  "/question-bank/exams/:id/questions",
  audit({ action: "exam.questions.set", resourceType: "exam", resourceIdParam: "id" }),
  async (req: Request, res: Response) => {
    const client = await pool.connect();
    try {
      const id = String(req.params.id);
      const compId = await examCompIfAccessible(req, id);
      if (!compId) {
        res.status(404).json({ message: "Exam not found" });
        return;
      }
      const ids = Array.isArray(req.body?.questionIds)
        ? req.body.questionIds.map(String)
        : [];
      const unique = [...new Set<string>(ids)];

      if (unique.length > 0) {
        const check = await pool.query(
          `SELECT id FROM questions
            WHERE id = ANY($1::uuid[]) AND comp_id = $2
              AND status = 'approved' AND deleted_at IS NULL`,
          [unique, compId]
        );
        if (check.rows.length !== unique.length) {
          res.status(400).json({
            message: "Every question must be an approved question of this competition",
          });
          return;
        }
      }

      await client.query("BEGIN");
      await client.query("DELETE FROM exam_question WHERE exam_id = $1", [id]);
      for (const qid of unique) {
        await client.query(
          "INSERT INTO exam_question (exam_id, question_id) VALUES ($1, $2)",
          [id, qid]
        );
      }
      await client.query("COMMIT");
      res.json({ questions: await loadExamQuestions(id) });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Set exam questions error:", err);
      res.status(500).json({ message: "Failed to update exam questions" });
    } finally {
      client.release();
    }
  }
);

// ── Manual grading (Wave 7 Phase 4) ───────────────────────────────────────
// Multiple-choice auto-grades on submit; short-answer responses are marked by
// hand here. Each grade recomputes the session rollup, so the score stays live
// and a session leaves the queue once nothing is pending.

// Resolve a session's comp_id, then access-check.
async function sessionCompIfAccessible(req: Request, sessionId: string): Promise<string | null> {
  const r = await pool.query(
    "SELECT comp_id FROM sessions WHERE id = $1 AND deleted_at IS NULL",
    [sessionId]
  );
  if (r.rows.length === 0) return null;
  const compId = r.rows[0].comp_id as string;
  return (await hasCompAccess(req.userId!, req.userRole!, compId)) ? compId : null;
}

// GET /api/question-bank/grading/queue?compId= — finished sessions that still
// have answered short-answer periods awaiting a manual grade.
router.get("/question-bank/grading/queue", async (req: Request, res: Response) => {
  try {
    const compId = String(req.query.compId ?? "");
    if (!compId || !(await hasCompAccess(req.userId!, req.userRole!, compId))) {
      res.status(403).json({ message: "No access to this competition" });
      return;
    }
    const r = await pool.query(
      `SELECT s.id, s.grade, s.finished_at, u.full_name AS student_name,
              e.name AS exam_name, e.code AS exam_code,
              COUNT(p.id)::int AS pending_count
         FROM sessions s
         JOIN users u ON u.id = s.user_id
         JOIN exams e ON e.id = s.exam_id
         JOIN periods p ON p.session_id = s.id
        WHERE s.comp_id = $1 AND s.deleted_at IS NULL AND s.finished_at IS NOT NULL
          AND p.type = 'short' AND p.is_correct IS NULL
          AND p.short_answer IS NOT NULL AND p.short_answer <> '' AND p.deleted_at IS NULL
        GROUP BY s.id, u.full_name, e.name, e.code
        ORDER BY s.finished_at ASC`,
      [compId]
    );
    res.json(
      r.rows.map((s) => ({
        sessionId: s.id,
        examName: s.exam_name,
        examCode: s.exam_code,
        studentName: s.student_name,
        grade: s.grade ?? null,
        finishedAt: s.finished_at,
        pendingCount: s.pending_count,
      }))
    );
  } catch (err) {
    console.error("Grading queue error:", err);
    res.status(500).json({ message: "Failed to load the grading queue" });
  }
});

// GET /api/question-bank/grading/sessions/:id — a session for the operator.
// Unlike the student-facing view, this DOES expose answer keys + explanations.
router.get("/question-bank/grading/sessions/:id", async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    if (!(await sessionCompIfAccessible(req, id))) {
      res.status(404).json({ message: "Session not found" });
      return;
    }
    const s = await pool.query(
      `SELECT s.id, s.grade, s.finished_at, s.total_point,
              s.corrects, s.wrongs, s.blanks, s.points,
              u.full_name AS student_name, e.name AS exam_name, e.code AS exam_code,
              e.correct_score, e.wrong_score
         FROM sessions s
         JOIN users u ON u.id = s.user_id
         JOIN exams e ON e.id = s.exam_id
        WHERE s.id = $1`,
      [id]
    );
    const periods = await pool.query(
      `SELECT p.id, p.number, p.type, p.question_id, p.answer_id, p.short_answer,
              p.is_correct, p.point, q.content AS question_content, q.explanation
         FROM periods p JOIN questions q ON q.id = p.question_id
        WHERE p.session_id = $1 AND p.deleted_at IS NULL
        ORDER BY p.number ASC`,
      [id]
    );
    const qids = [...new Set<string>(periods.rows.map((p) => p.question_id))];
    const ansByQ = new Map<string, any[]>();
    if (qids.length > 0) {
      const ans = await pool.query(
        `SELECT id, question_id, content, is_correct FROM answers
          WHERE question_id = ANY($1::uuid[]) AND deleted_at IS NULL
          ORDER BY created_at ASC`,
        [qids]
      );
      for (const a of ans.rows) {
        if (!ansByQ.has(a.question_id)) ansByQ.set(a.question_id, []);
        ansByQ.get(a.question_id)!.push(a);
      }
    }
    const sess = s.rows[0];
    const gradeScore = (matrix: unknown): number => {
      if (!matrix || typeof matrix !== "object" || !sess.grade) return 0;
      const v = Number((matrix as Record<string, unknown>)[sess.grade]);
      return Number.isFinite(v) ? v : 0;
    };
    res.json({
      id: sess.id,
      examName: sess.exam_name,
      examCode: sess.exam_code,
      studentName: sess.student_name,
      grade: sess.grade ?? null,
      finishedAt: sess.finished_at,
      totalPoint: sess.total_point != null ? Number(sess.total_point) : null,
      suggestedCorrectPoint: gradeScore(sess.correct_score),
      suggestedWrongPoint: gradeScore(sess.wrong_score),
      corrects: sess.corrects ?? {},
      wrongs: sess.wrongs ?? {},
      blanks: sess.blanks ?? {},
      points: sess.points ?? {},
      periods: periods.rows.map((p) => {
        const opts = ansByQ.get(p.question_id) ?? [];
        const chosen = opts.find((o) => o.id === p.answer_id);
        return {
          id: p.id,
          number: p.number,
          type: p.type,
          questionContent: p.question_content ?? "",
          explanation: p.explanation ?? null,
          isCorrect: p.is_correct,
          point: p.point != null ? Number(p.point) : null,
          studentAnswer:
            p.type === "short" ? p.short_answer ?? null : chosen ? chosen.content ?? "" : null,
          options:
            p.type === "choice"
              ? opts.map((o) => ({
                  id: o.id,
                  content: o.content ?? "",
                  isCorrect: o.is_correct,
                  chosen: o.id === p.answer_id,
                }))
              : [],
          answerKey:
            p.type === "short" ? opts.find((o) => o.is_correct)?.content ?? null : null,
        };
      }),
    });
  } catch (err) {
    console.error("Get grading session error:", err);
    res.status(500).json({ message: "Failed to load the session" });
  }
});

// PUT /api/question-bank/grading/periods/:periodId — mark one short answer.
router.put(
  "/question-bank/grading/periods/:periodId",
  audit({ action: "exam.period.grade", resourceType: "period", resourceIdParam: "periodId" }),
  async (req: Request, res: Response) => {
    try {
      const periodId = String(req.params.periodId);
      const pr = await pool.query(
        `SELECT p.id, p.type, p.session_id, s.comp_id
           FROM periods p JOIN sessions s ON s.id = p.session_id
          WHERE p.id = $1 AND p.deleted_at IS NULL`,
        [periodId]
      );
      if (pr.rows.length === 0) {
        res.status(404).json({ message: "Answer not found" });
        return;
      }
      const period = pr.rows[0];
      if (!(await hasCompAccess(req.userId!, req.userRole!, period.comp_id))) {
        res.status(404).json({ message: "Answer not found" });
        return;
      }
      if (period.type !== "short") {
        res.status(400).json({ message: "Only short-answer responses are graded manually" });
        return;
      }
      const isCorrect = !!req.body?.isCorrect;
      const point = Number(req.body?.point);
      if (!Number.isFinite(point)) {
        res.status(400).json({ message: "point must be a number" });
        return;
      }
      await pool.query(
        "UPDATE periods SET is_correct = $1, point = $2, updated_at = now() WHERE id = $3",
        [isCorrect, point, periodId]
      );
      await recomputeSessionRollups(pool, period.session_id);
      res.json({ graded: true });
    } catch (err) {
      console.error("Grade period error:", err);
      res.status(500).json({ message: "Failed to grade the answer" });
    }
  }
);

// ── Paper exams (Wave 7 Phase 5) ──────────────────────────────────────────
// The offline workflow: an operator records a student's paper attempt — one
// `paper_exams` envelope + a `paper_answers` row per question. MC answers
// auto-grade against the option key; short answers are marked by hand. The
// bulk-save endpoint grades + recomputes the rollup in one shot.

const CLEARED_REG = ["registered", "approved", "paid", "completed"];

// Pull a per-grade score out of an exams.correct_score / wrong_score JSONB map.
function perGradeScore(matrix: unknown, grade: string | null): number {
  if (!matrix || typeof matrix !== "object" || !grade) return 0;
  const v = Number((matrix as Record<string, unknown>)[grade]);
  return Number.isFinite(v) ? v : 0;
}

// Resolve a paper exam's comp_id, then access-check.
async function paperExamCompIfAccessible(req: Request, id: string): Promise<string | null> {
  const r = await pool.query(
    "SELECT comp_id FROM paper_exams WHERE id = $1 AND deleted_at IS NULL",
    [id]
  );
  if (r.rows.length === 0) return null;
  const compId = r.rows[0].comp_id as string;
  return (await hasCompAccess(req.userId!, req.userRole!, compId)) ? compId : null;
}

// The full paper-exam detail — the envelope + every answer joined to its
// question (by code-order `number`) + the MC options / short-answer key.
async function loadPaperExamDetail(id: string) {
  const pe = await pool.query(
    `SELECT pe.id, pe.exam_id, pe.user_id, pe.grade, pe.total_point,
            pe.corrects, pe.wrongs, pe.blanks, pe.points,
            u.full_name AS student_name, e.name AS exam_name, e.code AS exam_code,
            e.correct_score, e.wrong_score
       FROM paper_exams pe
       JOIN users u ON u.id = pe.user_id
       JOIN exams e ON e.id = pe.exam_id
      WHERE pe.id = $1 AND pe.deleted_at IS NULL`,
    [id]
  );
  if (pe.rows.length === 0) return null;
  const p = pe.rows[0];
  const ans = await pool.query(
    `WITH eq AS (
       SELECT q.id AS qid, q.type, q.content, q.explanation,
              row_number() OVER (ORDER BY q.code) AS num
         FROM exam_question x JOIN questions q ON q.id = x.question_id
        WHERE x.exam_id = $1 AND q.deleted_at IS NULL
     )
     SELECT pa.id, pa.number, pa.answer, pa.is_correct, pa.point,
            eq.qid, eq.type, eq.content, eq.explanation
       FROM paper_answers pa JOIN eq ON eq.num = pa.number
      WHERE pa.paper_exam_id = $2 AND pa.deleted_at IS NULL
      ORDER BY pa.number ASC`,
    [p.exam_id, id]
  );
  const qids = [...new Set<string>(ans.rows.map((a) => a.qid))];
  const optByQ = new Map<string, any[]>();
  if (qids.length > 0) {
    const opts = await pool.query(
      `SELECT id, question_id, content, is_correct FROM answers
        WHERE question_id = ANY($1::uuid[]) AND deleted_at IS NULL
        ORDER BY created_at ASC`,
      [qids]
    );
    for (const o of opts.rows) {
      if (!optByQ.has(o.question_id)) optByQ.set(o.question_id, []);
      optByQ.get(o.question_id)!.push(o);
    }
  }
  return {
    id: p.id,
    examId: p.exam_id,
    examName: p.exam_name,
    examCode: p.exam_code,
    studentName: p.student_name,
    grade: p.grade ?? null,
    totalPoint: p.total_point != null ? Number(p.total_point) : null,
    corrects: p.corrects ?? {},
    wrongs: p.wrongs ?? {},
    blanks: p.blanks ?? {},
    points: p.points ?? {},
    suggestedCorrectPoint: perGradeScore(p.correct_score, p.grade),
    suggestedWrongPoint: perGradeScore(p.wrong_score, p.grade),
    answers: ans.rows.map((a) => {
      const isShort = a.type === "short_answer";
      const opts = optByQ.get(a.qid) ?? [];
      return {
        id: a.id,
        number: a.number,
        type: a.type,
        questionContent: a.content ?? "",
        explanation: a.explanation ?? null,
        isCorrect: a.is_correct,
        point: a.point != null ? Number(a.point) : null,
        options: isShort
          ? []
          : opts.map((o) => ({ id: o.id, content: o.content ?? "", isCorrect: o.is_correct })),
        selectedOptionId: isShort ? null : a.answer ?? null,
        answerText: isShort ? a.answer ?? null : null,
        answerKey: isShort ? opts.find((o) => o.is_correct)?.content ?? null : null,
      };
    }),
  };
}

// GET /api/question-bank/exams/:examId/students — cleared registrants of the
// exam's competition, for the paper-exam student picker.
router.get("/question-bank/exams/:examId/students", async (req: Request, res: Response) => {
  try {
    const examId = String(req.params.examId);
    const compId = await examCompIfAccessible(req, examId);
    if (!compId) {
      res.status(404).json({ message: "Exam not found" });
      return;
    }
    const r = await pool.query(
      `SELECT u.id, u.full_name, st.grade AS student_grade, r.profile_snapshot,
              EXISTS (SELECT 1 FROM paper_exams pe
                       WHERE pe.exam_id = $2 AND pe.user_id = u.id AND pe.deleted_at IS NULL)
                AS has_paper
         FROM registrations r
         JOIN users u ON u.id = r.user_id
         LEFT JOIN students st ON st.id = r.user_id
        WHERE r.comp_id = $1 AND r.deleted_at IS NULL AND r.status = ANY($3)
        ORDER BY u.full_name ASC`,
      [compId, examId, CLEARED_REG]
    );
    res.json(
      r.rows.map((u) => {
        const snap = u.profile_snapshot;
        const snapGrade =
          snap && typeof snap === "object" && typeof snap.grade === "string" ? snap.grade : null;
        return {
          userId: u.id,
          name: u.full_name,
          grade: snapGrade || u.student_grade || null,
          hasPaper: u.has_paper,
        };
      })
    );
  } catch (err) {
    console.error("List exam students error:", err);
    res.status(500).json({ message: "Failed to load students" });
  }
});

// GET /api/question-bank/paper-exams?examId= ──────────────────────────────
router.get("/question-bank/paper-exams", async (req: Request, res: Response) => {
  try {
    const examId = String(req.query.examId ?? "");
    if (!examId || !(await examCompIfAccessible(req, examId))) {
      res.status(403).json({ message: "No access to this exam" });
      return;
    }
    const r = await pool.query(
      `SELECT pe.id, pe.grade, pe.total_point, pe.corrects, pe.wrongs, pe.blanks,
              u.full_name AS student_name,
              (SELECT COUNT(*)::int FROM paper_answers pa
                WHERE pa.paper_exam_id = pe.id AND pa.deleted_at IS NULL) AS answer_count
         FROM paper_exams pe
         JOIN users u ON u.id = pe.user_id
        WHERE pe.exam_id = $1 AND pe.deleted_at IS NULL
        ORDER BY u.full_name ASC`,
      [examId]
    );
    res.json(
      r.rows.map((p) => ({
        id: p.id,
        studentName: p.student_name,
        grade: p.grade ?? null,
        totalPoint: p.total_point != null ? Number(p.total_point) : null,
        answerCount: p.answer_count,
      }))
    );
  } catch (err) {
    console.error("List paper exams error:", err);
    res.status(500).json({ message: "Failed to load paper exams" });
  }
});

// GET /api/question-bank/paper-exams/:id ──────────────────────────────────
router.get("/question-bank/paper-exams/:id", async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    if (!(await paperExamCompIfAccessible(req, id))) {
      res.status(404).json({ message: "Paper exam not found" });
      return;
    }
    res.json(await loadPaperExamDetail(id));
  } catch (err) {
    console.error("Get paper exam error:", err);
    res.status(500).json({ message: "Failed to load the paper exam" });
  }
});

// POST /api/question-bank/paper-exams ─────────────────────────────────────
router.post(
  "/question-bank/paper-exams",
  audit({ action: "paper_exam.create", resourceType: "paper_exam" }),
  async (req: Request, res: Response) => {
    try {
      const examId = String(req.body?.examId ?? "");
      const userId = String(req.body?.userId ?? "");
      const compId = examId ? await examCompIfAccessible(req, examId) : null;
      if (!compId) {
        res.status(404).json({ message: "Exam not found" });
        return;
      }
      if (!userId) {
        res.status(400).json({ message: "userId is required" });
        return;
      }
      const exam = await pool.query(
        "SELECT name, code FROM exams WHERE id = $1 AND deleted_at IS NULL",
        [examId]
      );
      // The user must be a cleared registrant of this competition.
      const reg = await pool.query(
        `SELECT r.profile_snapshot, st.grade AS student_grade
           FROM registrations r
           LEFT JOIN students st ON st.id = r.user_id
          WHERE r.user_id = $1 AND r.comp_id = $2 AND r.deleted_at IS NULL
            AND r.status = ANY($3)
          ORDER BY r.created_at DESC LIMIT 1`,
        [userId, compId, CLEARED_REG]
      );
      if (reg.rows.length === 0) {
        res.status(400).json({ message: "That student is not registered for this competition" });
        return;
      }
      const dup = await pool.query(
        `SELECT 1 FROM paper_exams
          WHERE exam_id = $1 AND user_id = $2 AND deleted_at IS NULL LIMIT 1`,
        [examId, userId]
      );
      if (dup.rows.length > 0) {
        res.status(409).json({ message: "This student already has a paper result for this exam" });
        return;
      }
      const snap = reg.rows[0].profile_snapshot;
      const snapGrade =
        snap && typeof snap === "object" && typeof snap.grade === "string" ? snap.grade : null;
      const grade = snapGrade || reg.rows[0].student_grade || null;
      const questions = await pool.query(
        `SELECT q.id FROM exam_question x JOIN questions q ON q.id = x.question_id
          WHERE x.exam_id = $1 AND q.deleted_at IS NULL ORDER BY q.code ASC`,
        [examId]
      );
      if (questions.rows.length === 0) {
        res.status(409).json({ message: "This exam has no questions yet" });
        return;
      }
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const pe = await client.query(
          `INSERT INTO paper_exams (comp_id, user_id, exam_id, name, code, grade)
           VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
          [compId, userId, examId, exam.rows[0].name, exam.rows[0].code, grade]
        );
        const paperExamId = pe.rows[0].id as string;
        let n = 1;
        for (const _q of questions.rows) {
          await client.query(
            `INSERT INTO paper_answers (comp_id, user_id, paper_exam_id, number)
             VALUES ($1,$2,$3,$4)`,
            [compId, userId, paperExamId, n++]
          );
        }
        await client.query("COMMIT");
        res.status(201).json(await loadPaperExamDetail(paperExamId));
      } catch (txErr) {
        await client.query("ROLLBACK");
        throw txErr;
      } finally {
        client.release();
      }
    } catch (err) {
      console.error("Create paper exam error:", err);
      res.status(500).json({ message: "Failed to create the paper exam" });
    }
  }
);

// PUT /api/question-bank/paper-exams/:id/answers ──────────────────────────
// Bulk-save the answer sheet. MC entries (value = the chosen option id)
// auto-grade; short entries (value = text + the operator's isCorrect/point)
// are taken as given. Recomputes the rollup.
router.put(
  "/question-bank/paper-exams/:id/answers",
  audit({ action: "paper_exam.answers.save", resourceType: "paper_exam", resourceIdParam: "id" }),
  async (req: Request, res: Response) => {
    const client = await pool.connect();
    try {
      const id = String(req.params.id);
      if (!(await paperExamCompIfAccessible(req, id))) {
        res.status(404).json({ message: "Paper exam not found" });
        return;
      }
      const pe = await pool.query(
        "SELECT exam_id, grade FROM paper_exams WHERE id = $1",
        [id]
      );
      const examId = pe.rows[0].exam_id as string;
      const grade = pe.rows[0].grade as string | null;
      const ex = await pool.query(
        "SELECT correct_score, wrong_score FROM exams WHERE id = $1",
        [examId]
      );
      const correctPt = perGradeScore(ex.rows[0]?.correct_score, grade);
      const wrongPt = perGradeScore(ex.rows[0]?.wrong_score, grade);

      // number -> { type, options[] }
      const qrows = await pool.query(
        `WITH eq AS (
           SELECT q.id AS qid, q.type, row_number() OVER (ORDER BY q.code) AS num
             FROM exam_question x JOIN questions q ON q.id = x.question_id
            WHERE x.exam_id = $1 AND q.deleted_at IS NULL
         )
         SELECT eq.num, eq.type, a.id AS option_id, a.is_correct
           FROM eq LEFT JOIN answers a ON a.question_id = eq.qid AND a.deleted_at IS NULL`,
        [examId]
      );
      const byNumber = new Map<number, { type: string; options: Map<string, boolean> }>();
      for (const row of qrows.rows) {
        // row_number() is bigint → node-pg returns it as a string; coerce.
        const num = Number(row.num);
        if (!byNumber.has(num)) byNumber.set(num, { type: row.type, options: new Map() });
        if (row.option_id) byNumber.get(num)!.options.set(row.option_id, row.is_correct);
      }

      const items = Array.isArray(req.body?.answers) ? req.body.answers : [];
      await client.query("BEGIN");
      for (const it of items) {
        const number = Number(it?.number);
        const q = byNumber.get(number);
        if (!q) continue;
        let answer: string | null = null;
        let isCorrect: boolean | null = null;
        let point = 0;
        if (q.type === "short_answer") {
          answer = typeof it?.value === "string" ? it.value : null;
          isCorrect = typeof it?.isCorrect === "boolean" ? it.isCorrect : null;
          point = isCorrect == null ? 0 : Number(it?.point) || 0;
        } else {
          const optId = typeof it?.value === "string" ? it.value : "";
          if (optId && q.options.has(optId)) {
            answer = optId;
            isCorrect = !!q.options.get(optId);
            point = isCorrect ? correctPt : wrongPt;
          }
        }
        await client.query(
          `UPDATE paper_answers SET answer=$1, is_correct=$2, point=$3, updated_at=now()
            WHERE paper_exam_id=$4 AND number=$5 AND deleted_at IS NULL`,
          [answer, isCorrect, point, id, number]
        );
      }
      await recomputePaperRollups(client, id);
      await client.query("COMMIT");
      res.json(await loadPaperExamDetail(id));
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Save paper answers error:", err);
      res.status(500).json({ message: "Failed to save the answer sheet" });
    } finally {
      client.release();
    }
  }
);

// DELETE /api/question-bank/paper-exams/:id ───────────────────────────────
router.delete(
  "/question-bank/paper-exams/:id",
  audit({ action: "paper_exam.delete", resourceType: "paper_exam", resourceIdParam: "id" }),
  async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      if (!(await paperExamCompIfAccessible(req, id))) {
        res.status(404).json({ message: "Paper exam not found" });
        return;
      }
      await softDelete("paper_exams", id);
      res.json({ message: "Paper exam removed" });
    } catch (err) {
      console.error("Delete paper exam error:", err);
      res.status(500).json({ message: "Failed to delete the paper exam" });
    }
  }
);

export default router;
