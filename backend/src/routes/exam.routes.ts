import { Router, Request, Response } from "express";
import { pool } from "../config/database";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/require-role";
import { audit } from "../middleware/audit";
import { liveFilter, compFilter, softDelete } from "../db/query-helpers";
import { hasCompAccess } from "../services/comp-access.service";

// Exam blueprint + builder API (EMC Wave 7). Operator-facing — admin + organizer,
// native competitions only (the `hasCompAccess` gate). Mounted at /api; the
// `/question-bank/exams/*` namespace places exams inside the operator workspace
// alongside the question bank.

const router = Router();
// Path-scoped (this router is mounted at bare `/api`) so the operator gate does
// not 403 unrelated fall-through traffic — only `/question-bank/exams/*`.
router.use("/question-bank/exams", authMiddleware);
router.use("/question-bank/exams", requireRole("admin", "organizer"));

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

export default router;
