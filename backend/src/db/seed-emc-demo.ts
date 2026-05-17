// Demo-data seeder for the EMC feature set (Waves 6–8): venues, the question
// bank (subjects / topics / subtopics / questions), exams, and a sample
// finished exam attempt. Idempotent — every row is keyed by a natural key
// (code / name) and skipped if it already exists, so re-running is safe.
//
//   npm run db:seed:emc-demo
//
// Targets the EMC competition. Demo questions use the `Q-D…` code namespace
// so they never collide with the app's auto-generated `Q-NNN` codes.

import { pool } from "../config/database";
import { storeFile } from "../services/storage.service";

const COMP = "comp-1-eduversal-mathematics-competition";

// A tiny valid JPEG — stands in for a webcam snapshot in the proctoring demo.
const DEMO_JPEG_B64 =
  "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEB" +
  "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAA" +
  "AAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AVN//2Q==";

async function userId(email: string): Promise<string | null> {
  const r = await pool.query("SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL", [email]);
  return r.rows[0]?.id ?? null;
}

// ── Venues ──────────────────────────────────────────────────────────────
async function area(province: string, code: string, part: string): Promise<string> {
  const found = await pool.query("SELECT id FROM areas WHERE code = $1 AND deleted_at IS NULL", [code]);
  if (found.rows[0]) return found.rows[0].id;
  const r = await pool.query(
    "INSERT INTO areas (province, code, part, is_active) VALUES ($1,$2,$3,true) RETURNING id",
    [province, code, part]
  );
  return r.rows[0].id;
}

async function testCenter(name: string, code: string, areaId: string, city: string): Promise<void> {
  const found = await pool.query("SELECT id FROM test_centers WHERE code = $1 AND deleted_at IS NULL", [code]);
  if (found.rows[0]) return;
  await pool.query(
    "INSERT INTO test_centers (name, code, area_id, city, is_active) VALUES ($1,$2,$3,$4,true)",
    [name, code, areaId, city]
  );
}

// ── Taxonomy ────────────────────────────────────────────────────────────
async function subject(name: string): Promise<string> {
  const found = await pool.query(
    "SELECT id FROM subjects WHERE comp_id = $1 AND name = $2 AND deleted_at IS NULL",
    [COMP, name]
  );
  if (found.rows[0]) return found.rows[0].id;
  const r = await pool.query(
    "INSERT INTO subjects (comp_id, name) VALUES ($1,$2) RETURNING id",
    [COMP, name]
  );
  return r.rows[0].id;
}

async function topic(subjectId: string, name: string): Promise<string> {
  const found = await pool.query(
    "SELECT id FROM topics WHERE comp_id = $1 AND subject_id = $2 AND name = $3 AND deleted_at IS NULL",
    [COMP, subjectId, name]
  );
  if (found.rows[0]) return found.rows[0].id;
  const r = await pool.query(
    "INSERT INTO topics (comp_id, subject_id, name) VALUES ($1,$2,$3) RETURNING id",
    [COMP, subjectId, name]
  );
  return r.rows[0].id;
}

async function subtopic(topicId: string, name: string): Promise<void> {
  const found = await pool.query(
    "SELECT id FROM subtopics WHERE comp_id = $1 AND topic_id = $2 AND name = $3 AND deleted_at IS NULL",
    [COMP, topicId, name]
  );
  if (found.rows[0]) return;
  await pool.query(
    "INSERT INTO subtopics (comp_id, topic_id, name) VALUES ($1,$2,$3)",
    [COMP, topicId, name]
  );
}

// ── Questions ───────────────────────────────────────────────────────────
interface SeedQuestion {
  code: string;
  type: "multiple_choice" | "short_answer";
  content: string;
  grades: string[];
  level: string;
  status: "draft" | "submitted" | "approved";
  answers: { content: string; isCorrect: boolean }[];
  topicId?: string;
}

async function question(writer: string, q: SeedQuestion): Promise<string> {
  const found = await pool.query(
    "SELECT id FROM questions WHERE comp_id = $1 AND code = $2 AND deleted_at IS NULL",
    [COMP, q.code]
  );
  if (found.rows[0]) return found.rows[0].id;
  const approved = q.status === "approved";
  const inserted = await pool.query(
    `INSERT INTO questions
       (comp_id, code, writer_id, approver_id, type, level, grades, content, status, approved_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10) RETURNING id`,
    [
      COMP, q.code, writer, approved ? writer : null, q.type, q.level,
      JSON.stringify(q.grades), q.content, q.status, approved ? new Date() : null,
    ]
  );
  const id = inserted.rows[0].id as string;
  for (const a of q.answers) {
    await pool.query(
      "INSERT INTO answers (comp_id, question_id, content, is_correct) VALUES ($1,$2,$3,$4)",
      [COMP, id, a.content, a.isCorrect]
    );
  }
  if (q.topicId) {
    await pool.query(
      "INSERT INTO question_topics (question_id, topic_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
      [id, q.topicId]
    );
  }
  return id;
}

// The current LOCAL date (YYYY-MM-DD). Not toISOString() — that is UTC, and
// the exam window check parses date+time as local; a UTC date can land the
// demo exam a day off and read as "closed".
function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

// ── Exams ───────────────────────────────────────────────────────────────
async function exam(
  name: string,
  code: string,
  grades: string[],
  minutes: number,
  questionIds: string[]
): Promise<string> {
  const today = localToday();
  const found = await pool.query(
    "SELECT id FROM exams WHERE comp_id = $1 AND code = $2 AND deleted_at IS NULL",
    [COMP, code]
  );
  let id: string;
  if (found.rows[0]) {
    id = found.rows[0].id;
    // Refresh the window so the demo exam is open on the day the seed runs.
    await pool.query(
      "UPDATE exams SET date = $1, start_time = '00:00', end_time = '23:59', updated_at = now() WHERE id = $2",
      [today, id]
    );
  } else {
    const score = Object.fromEntries(grades.map((g) => [g, 4]));
    const wrong = Object.fromEntries(grades.map((g) => [g, -1]));
    const r = await pool.query(
      `INSERT INTO exams
         (comp_id, name, code, year, date, grades, choice, short, start_time, end_time,
          minutes, correct_score, wrong_score)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,true,true,'00:00','23:59',$7,$8::jsonb,$9::jsonb)
       RETURNING id`,
      [COMP, name, code, 2026, today, JSON.stringify(grades), minutes,
       JSON.stringify(score), JSON.stringify(wrong)]
    );
    id = r.rows[0].id;
  }
  for (const qid of questionIds) {
    await pool.query(
      "INSERT INTO exam_question (exam_id, question_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
      [id, qid]
    );
  }
  return id;
}

async function main() {
  const admin = await userId("admin@eduversal.com");
  const student = await userId("student@test.local");
  if (!admin) throw new Error("admin@eduversal.com not found — run db:create-admin first");

  // 1 — Venues
  const jkt = await area("DKI Jakarta", "JKT", "Jabodetabek");
  const jabar = await area("Jawa Barat", "JABAR", "West Java");
  const jatim = await area("Jawa Timur", "JATIM", "East Java");
  await testCenter("SMAN 8 Jakarta", "TC-JKT-8", jkt, "Jakarta");
  await testCenter("Universitas Indonesia Hall", "TC-JKT-UI", jkt, "Depok");
  await testCenter("Bandung Math Center", "TC-BDG-1", jabar, "Bandung");
  await testCenter("SMAN 3 Bandung", "TC-BDG-3", jabar, "Bandung");
  await testCenter("Surabaya Test Hall", "TC-SBY-1", jatim, "Surabaya");

  // 2 — Taxonomy
  const arithmetic = await subject("Arithmetic");
  const algebra = await subject("Algebra");
  const geometry = await subject("Geometry");
  const fractions = await topic(arithmetic, "Fractions");
  const percentages = await topic(arithmetic, "Percentages");
  const linearEq = await topic(algebra, "Linear Equations");
  const quadratics = await topic(algebra, "Quadratics");
  const triangles = await topic(geometry, "Triangles");
  const circles = await topic(geometry, "Circles");
  await subtopic(fractions, "Adding fractions");
  await subtopic(linearEq, "One variable");
  await subtopic(quadratics, "Perfect squares");
  await subtopic(triangles, "Angle sums");

  // 3 — Questions (8 approved, 2 submitted, 2 draft)
  const mc = (content: string, opts: [string, boolean][]) =>
    opts.map(([content, isCorrect]) => ({ content, isCorrect }));
  const q: SeedQuestion[] = [
    { code: "Q-D01", type: "multiple_choice", content: "What is 1/2 + 1/4?", grades: ["SD", "SMP"], level: "easy", status: "approved", topicId: fractions,
      answers: mc("", [["3/4", true], ["1/2", false], ["2/6", false], ["1/4", false]]) },
    { code: "Q-D02", type: "multiple_choice", content: "Solve: 2x + 3 = 11", grades: ["SMP"], level: "easy", status: "approved", topicId: linearEq,
      answers: mc("", [["x = 4", true], ["x = 5", false], ["x = 7", false], ["x = 3", false]]) },
    { code: "Q-D03", type: "multiple_choice", content: "Sum of the interior angles of a triangle?", grades: ["SD", "SMP"], level: "easy", status: "approved", topicId: triangles,
      answers: mc("", [["180°", true], ["90°", false], ["360°", false], ["270°", false]]) },
    { code: "Q-D04", type: "multiple_choice", content: "What is 25% of 80?", grades: ["SD"], level: "easy", status: "approved", topicId: percentages,
      answers: mc("", [["20", true], ["25", false], ["40", false], ["15", false]]) },
    { code: "Q-D05", type: "multiple_choice", content: "Which of these is a prime number?", grades: ["SD", "SMP"], level: "medium", status: "approved",
      answers: mc("", [["7", true], ["9", false], ["15", false], ["21", false]]) },
    { code: "Q-D06", type: "multiple_choice", content: "If x = 6, what is x²?", grades: ["SMP", "SMA"], level: "medium", status: "approved", topicId: quadratics,
      answers: mc("", [["36", true], ["12", false], ["18", false], ["66", false]]) },
    { code: "Q-D07", type: "short_answer", content: "What is 12 × 12?", grades: ["SD", "SMP"], level: "easy", status: "approved",
      answers: [{ content: "144", isCorrect: true }] },
    { code: "Q-D08", type: "short_answer", content: "Solve x² = 49 (give the positive value of x).", grades: ["SMP", "SMA"], level: "medium", status: "approved", topicId: quadratics,
      answers: [{ content: "7", isCorrect: true }] },
    { code: "Q-D09", type: "multiple_choice", content: "Area of a circle with radius 1 (in terms of π)?", grades: ["SMA"], level: "medium", status: "submitted", topicId: circles,
      answers: mc("", [["π", true], ["2π", false], ["π²", false], ["1", false]]) },
    { code: "Q-D10", type: "short_answer", content: "What is 100 ÷ 4?", grades: ["SD"], level: "easy", status: "submitted",
      answers: [{ content: "25", isCorrect: true }] },
    { code: "Q-D11", type: "multiple_choice", content: "What is the next prime number after 13?", grades: ["SMP"], level: "medium", status: "draft",
      answers: mc("", [["17", true], ["15", false], ["19", false], ["14", false]]) },
    { code: "Q-D12", type: "short_answer", content: "What is half of 250?", grades: ["SD"], level: "easy", status: "draft",
      answers: [{ content: "125", isCorrect: true }] },
  ];
  const qid: Record<string, string> = {};
  for (const item of q) qid[item.code] = await question(admin, item);

  // 4 — Exams
  const round1 = await exam(
    "EMC Mid-Year Round 1", "EMC-R1", ["SD", "SMP", "SMA"], 60,
    ["Q-D01", "Q-D02", "Q-D03", "Q-D04", "Q-D05", "Q-D06", "Q-D07", "Q-D08"].map((c) => qid[c])
  );
  const practice = await exam(
    "EMC Practice Test", "EMC-PRAC", ["SMA"], 30,
    ["Q-D06", "Q-D08"].map((c) => qid[c])
  );

  // 5 — A sample finished attempt on the practice exam (so the grading queue
  //     + proctoring review have data): one MC graded, one short answer
  //     awaiting a manual grade, camera proctored with snapshots.
  let attemptNote = "skipped (no test student)";
  if (student) {
    const exists = await pool.query(
      "SELECT id FROM sessions WHERE user_id = $1 AND exam_id = $2 AND deleted_at IS NULL",
      [student, practice]
    );
    let sid: string;
    if (exists.rows.length > 0) {
      sid = exists.rows[0].id;
      attemptNote = "refreshed";
    } else {
      const s = await pool.query(
        `INSERT INTO sessions (comp_id, user_id, exam_id, grade, started_at, finished_at,
                               camera_available, corrects, wrongs, blanks, points, total_point)
         VALUES ($1,$2,$3,'SMA', now() - interval '1 hour', now() - interval '30 minutes',
                 true, '{"choice":1,"short":0}'::jsonb, '{"choice":0,"short":0}'::jsonb,
                 '{"choice":0,"short":0}'::jsonb, '{"choice":4,"short":0}'::jsonb, 4)
         RETURNING id`,
        [COMP, student, practice]
      );
      sid = s.rows[0].id;
      const correctOpt = await pool.query(
        "SELECT id FROM answers WHERE question_id = $1 AND is_correct = true LIMIT 1",
        [qid["Q-D06"]]
      );
      await pool.query(
        `INSERT INTO periods (comp_id, session_id, question_id, answer_id, type, number, is_correct, point)
         VALUES ($1,$2,$3,$4,'choice',1,true,4)`,
        [COMP, sid, qid["Q-D06"], correctOpt.rows[0].id]
      );
      await pool.query(
        `INSERT INTO periods (comp_id, session_id, question_id, type, short_answer, number)
         VALUES ($1,$2,$3,'short','seven',2)`,
        [COMP, sid, qid["Q-D08"]]
      );
      attemptNote = "created";
    }
    // Ensure the session is camera-proctored with a few snapshots (idempotent).
    await pool.query("UPDATE sessions SET camera_available = true WHERE id = $1", [sid]);
    const wc = await pool.query("SELECT count(*)::int n FROM webcams WHERE session_id = $1", [sid]);
    if (wc.rows[0].n === 0) {
      const buf = Buffer.from(DEMO_JPEG_B64, "base64");
      for (let i = 0; i < 3; i++) {
        const imagePath = await storeFile(student, buf, `demo-webcam-${sid}-${i}.jpg`, "image/jpeg");
        await pool.query(
          "INSERT INTO webcams (comp_id, session_id, image_path) VALUES ($1,$2,$3)",
          [COMP, sid, imagePath]
        );
      }
    }
  }

  console.log("EMC demo data seeded:");
  console.log("  venues:    3 areas, 5 test centers");
  console.log("  taxonomy:  3 subjects, 6 topics, 4 subtopics");
  console.log("  questions: 12 (8 approved, 2 submitted, 2 draft)");
  console.log("  exams:     EMC-R1 (8 questions), EMC-PRAC (2 questions)");
  console.log(`  attempt:   ${attemptNote} — proctored, awaiting grading, 3 webcam snapshots`);
  await pool.end();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
