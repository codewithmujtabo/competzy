// Exam grading (EMC Wave 7). Multiple-choice periods auto-grade against the
// question's correct answer; short-answer periods are graded manually (Phase 4).
// `recomputeSessionRollups` aggregates a session's periods into its rollup —
// safe to call repeatedly (after submit, and after each manual grade).

// Both `pool` and a transaction client satisfy this — avoids importing pg types.
type DB = { query: (text: string, params?: unknown[]) => Promise<{ rows: any[] }> };

// Pull a per-grade score out of an exams.correct_score / wrong_score JSONB map.
function scoreFor(matrix: unknown, grade: string | null): number {
  if (!matrix || typeof matrix !== "object" || !grade) return 0;
  const v = Number((matrix as Record<string, unknown>)[grade]);
  return Number.isFinite(v) ? v : 0;
}

/**
 * Auto-grade the multiple-choice periods of a session. A choice period with a
 * selected answer is correct/wrong by that answer's `is_correct` flag and
 * scores the exam's per-grade correct/wrong points; a choice period with no
 * selection stays blank (`is_correct` NULL, 0 points). Short-answer periods are
 * left untouched — they are graded manually.
 */
export async function autoGradeMcPeriods(db: DB, sessionId: string): Promise<void> {
  const s = await db.query(
    `SELECT s.grade, e.correct_score, e.wrong_score
       FROM sessions s JOIN exams e ON e.id = s.exam_id
      WHERE s.id = $1`,
    [sessionId]
  );
  if (s.rows.length === 0) return;
  const grade = s.rows[0].grade as string | null;
  const correct = scoreFor(s.rows[0].correct_score, grade);
  const wrong = scoreFor(s.rows[0].wrong_score, grade);

  // Answered choice periods → graded by the selected answer's is_correct.
  // The CASE params are cast — bound params inside a CASE infer as text.
  await db.query(
    `UPDATE periods p
        SET is_correct = a.is_correct,
            point = CASE WHEN a.is_correct THEN $2::numeric ELSE $3::numeric END,
            updated_at = now()
       FROM answers a
      WHERE p.answer_id = a.id
        AND p.session_id = $1 AND p.type = 'choice' AND p.deleted_at IS NULL`,
    [sessionId, correct, wrong]
  );
  // Unanswered choice periods → blank.
  await db.query(
    `UPDATE periods
        SET is_correct = NULL, point = 0, updated_at = now()
      WHERE session_id = $1 AND type = 'choice' AND answer_id IS NULL
        AND deleted_at IS NULL`,
    [sessionId]
  );
}

/**
 * Recompute a session's rollups (`corrects`/`wrongs`/`blanks`/`points` per
 * section + `total_point`) from its current periods. An answered short-answer
 * period that has not been graded yet (`is_correct` NULL) is counted nowhere —
 * the session score stays partial until manual grading finalises it.
 */
export async function recomputeSessionRollups(db: DB, sessionId: string): Promise<void> {
  const r = await db.query(
    `SELECT type, is_correct, answer_id, short_answer, point
       FROM periods WHERE session_id = $1 AND deleted_at IS NULL`,
    [sessionId]
  );
  const sec = {
    choice: { correct: 0, wrong: 0, blank: 0, points: 0 },
    short: { correct: 0, wrong: 0, blank: 0, points: 0 },
  };
  for (const p of r.rows) {
    const k: "choice" | "short" = p.type === "short" ? "short" : "choice";
    const answered =
      k === "choice"
        ? p.answer_id != null
        : !!(p.short_answer && String(p.short_answer).trim());
    if (p.is_correct === true) sec[k].correct++;
    else if (p.is_correct === false) sec[k].wrong++;
    else if (!answered) sec[k].blank++;
    // answered + is_correct NULL → pending; counted nowhere yet.
    sec[k].points += Number(p.point) || 0;
  }
  const total = sec.choice.points + sec.short.points;
  await db.query(
    `UPDATE sessions
        SET corrects=$2::jsonb, wrongs=$3::jsonb, blanks=$4::jsonb,
            points=$5::jsonb, total_point=$6, updated_at=now()
      WHERE id=$1`,
    [
      sessionId,
      JSON.stringify({ choice: sec.choice.correct, short: sec.short.correct }),
      JSON.stringify({ choice: sec.choice.wrong, short: sec.short.wrong }),
      JSON.stringify({ choice: sec.choice.blank, short: sec.short.blank }),
      JSON.stringify({ choice: sec.choice.points, short: sec.short.points }),
      total,
    ]
  );
}

/**
 * Recompute a paper exam's rollups from its `paper_answers`. The MC/short split
 * is derived by joining each answer's `number` to the exam's questions in code
 * order (paper_answers carries no type column).
 */
export async function recomputePaperRollups(db: DB, paperExamId: string): Promise<void> {
  const pe = await db.query("SELECT exam_id FROM paper_exams WHERE id = $1", [paperExamId]);
  if (pe.rows.length === 0) return;
  const examId = pe.rows[0].exam_id;
  const r = await db.query(
    `WITH eq AS (
       SELECT q.type, row_number() OVER (ORDER BY q.code) AS num
         FROM exam_question x JOIN questions q ON q.id = x.question_id
        WHERE x.exam_id = $2 AND q.deleted_at IS NULL
     )
     SELECT eq.type, pa.is_correct, pa.answer, pa.point
       FROM paper_answers pa JOIN eq ON eq.num = pa.number
      WHERE pa.paper_exam_id = $1 AND pa.deleted_at IS NULL`,
    [paperExamId, examId]
  );
  const sec = {
    choice: { correct: 0, wrong: 0, blank: 0, points: 0 },
    short: { correct: 0, wrong: 0, blank: 0, points: 0 },
  };
  for (const a of r.rows) {
    const k: "choice" | "short" = a.type === "short_answer" ? "short" : "choice";
    const answered = !!(a.answer && String(a.answer).trim());
    if (a.is_correct === true) sec[k].correct++;
    else if (a.is_correct === false) sec[k].wrong++;
    else if (!answered) sec[k].blank++;
    sec[k].points += Number(a.point) || 0;
  }
  const total = sec.choice.points + sec.short.points;
  await db.query(
    `UPDATE paper_exams
        SET corrects=$2::jsonb, wrongs=$3::jsonb, blanks=$4::jsonb,
            points=$5::jsonb, total_point=$6, updated_at=now()
      WHERE id=$1`,
    [
      paperExamId,
      JSON.stringify({ choice: sec.choice.correct, short: sec.short.correct }),
      JSON.stringify({ choice: sec.choice.wrong, short: sec.short.wrong }),
      JSON.stringify({ choice: sec.choice.blank, short: sec.short.blank }),
      JSON.stringify({ choice: sec.choice.points, short: sec.short.points }),
      total,
    ]
  );
}

/** True if a finished session still has answered short-answer periods awaiting a manual grade. */
export async function sessionHasPendingGrading(db: DB, sessionId: string): Promise<boolean> {
  const r = await db.query(
    `SELECT 1 FROM periods
      WHERE session_id = $1 AND type = 'short' AND is_correct IS NULL
        AND short_answer IS NOT NULL AND short_answer <> '' AND deleted_at IS NULL
      LIMIT 1`,
    [sessionId]
  );
  return r.rows.length > 0;
}
