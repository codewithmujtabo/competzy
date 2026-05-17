/**
 * Test-environment seeder — DEV / TEST ONLY (it TRUNCATEs tables).
 *
 * Resets ALL competition data and re-seeds three NATIVE competitions — EMC,
 * ISPO, OSEBI — each fully wired for the lifecycle (register → pay → exam →
 * certificate): a 6-step flow, a question bank, an open exam, products, a
 * voucher batch, announcements, materials, and fresh affiliate referral codes.
 *
 *   npm run db:seed:test-competitions
 *
 * `users` and `historical_participants` (the 63k legacy records) are NOT
 * touched. Re-running gives a fresh, clean test environment.
 */

import { pool } from "../config/database";
import { storeFile } from "../services/storage.service";
import { seedDefaultFlow } from "../services/competition-flow.service";

// A tiny valid JPEG — stands in for product images / material files.
const DEMO_JPEG_B64 =
  "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEB" +
  "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAA" +
  "AAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AVN//2Q==";

// Local YYYY-MM-DD offset by `days` — not toISOString() (UTC can land a day off).
function ymd(days = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

async function userId(email: string): Promise<string | null> {
  const r = await pool.query("SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL", [
    email,
  ]);
  return r.rows[0]?.id ?? null;
}

// ── Reset ─────────────────────────────────────────────────────────────────
// Every competition-scoped table. CASCADE also mops up anything else with an
// inbound FK (favorites, bulk jobs, …). users / historical_participants /
// schools / audit_log have no FK into this set and survive untouched.
const RESET_TABLES = [
  "competitions", "registrations", "payments", "competition_flows",
  "affiliated_credentials", "certificates",
  "subjects", "topics", "subtopics", "questions", "answers", "question_topics",
  "proofreads", "exams", "exam_question", "sessions", "periods", "answer_keys",
  "paper_exams", "paper_answers", "webcams",
  "voucher_groups", "vouchers", "products", "orders", "order_items",
  "referrals", "clicks", "announcements", "materials", "suggestions", "accesses",
  "areas", "test_centers", "area_user", "test_center_user",
];

async function reset(): Promise<void> {
  await pool.query(`TRUNCATE ${RESET_TABLES.join(", ")} RESTART IDENTITY CASCADE`);
}

// ── Seed types ────────────────────────────────────────────────────────────
interface SeedQuestion {
  content: string;
  grades: string[];
  options: [string, boolean][]; // [text, isCorrect]
}

interface CompSpec {
  id: string;
  slug: string;
  name: string;
  organizer: string;
  category: string;
  gradeLevel: string; // "SD,SMP,SMA"
  grades: string[]; // ["SD","SMP","SMA"]
  fee: number;
  description: string;
  tag: string; // code prefix, e.g. "EMC"
  subjects: { name: string; topics: string[] }[];
  examName: string;
  questions: SeedQuestion[];
  products: { name: string; price: number; description: string }[];
  announcements: { title: string; body: string }[];
  materials: { title: string; body: string; category: string }[];
  referrals: { name: string; email: string }[];
}

// ── The three competitions ────────────────────────────────────────────────
const mc = (...opts: [string, boolean][]): [string, boolean][] => opts;

const SPECS: CompSpec[] = [
  {
    id: "comp-emc",
    slug: "emc",
    name: "EMC — Mathematics Competition",
    organizer: "Competzy",
    category: "Mathematics",
    gradeLevel: "SD,SMP,SMA",
    grades: ["SD", "SMP", "SMA"],
    fee: 50000,
    description:
      "The Eduversal Mathematics Competition — a national math challenge spanning arithmetic, algebra and geometry for SD, SMP and SMA students.",
    tag: "EMC",
    subjects: [
      { name: "Arithmetic", topics: ["Fractions", "Percentages"] },
      { name: "Algebra", topics: ["Linear Equations", "Quadratics"] },
      { name: "Geometry", topics: ["Triangles", "Circles"] },
    ],
    examName: "EMC Round 1",
    questions: [
      { content: "What is 1/2 + 1/4?", grades: ["SD", "SMP", "SMA"], options: mc(["3/4", true], ["1/2", false], ["2/6", false], ["1/4", false]) },
      { content: "Solve: 2x + 3 = 11", grades: ["SD", "SMP", "SMA"], options: mc(["x = 4", true], ["x = 5", false], ["x = 7", false], ["x = 3", false]) },
      { content: "Sum of the interior angles of a triangle?", grades: ["SD", "SMP", "SMA"], options: mc(["180°", true], ["90°", false], ["360°", false], ["270°", false]) },
      { content: "What is 25% of 80?", grades: ["SD", "SMP", "SMA"], options: mc(["20", true], ["25", false], ["40", false], ["15", false]) },
      { content: "Which of these is a prime number?", grades: ["SD", "SMP", "SMA"], options: mc(["7", true], ["9", false], ["15", false], ["21", false]) },
      { content: "If x = 6, what is x²?", grades: ["SD", "SMP", "SMA"], options: mc(["36", true], ["12", false], ["18", false], ["66", false]) },
      { content: "What is 12 × 12?", grades: ["SD", "SMP", "SMA"], options: mc(["144", true], ["121", false], ["169", false], ["132", false]) },
      { content: "What is the positive value of x when x² = 49?", grades: ["SD", "SMP", "SMA"], options: mc(["7", true], ["8", false], ["6", false], ["9", false]) },
    ],
    products: [
      { name: "EMC Official T-Shirt", price: 85000, description: "Soft cotton tee with the EMC crest." },
      { name: "EMC Math Notebook Set", price: 45000, description: "A set of three grid notebooks." },
    ],
    announcements: [
      { title: "EMC Round 1 is open", body: "Registration for EMC Round 1 is now open. Complete your profile and pay to lock in your seat." },
    ],
    materials: [
      { title: "EMC Past Paper 2025", body: "Last year's Round 1 paper with the full answer key.", category: "Past Papers" },
      { title: "Algebra Quick Reference", body: "A one-page summary of the algebra topics on the exam.", category: "Study Guides" },
    ],
    referrals: [
      { name: "EMC Ambassador — Jakarta", email: "emc.ambassador@example.com" },
      { name: "EMC Ambassador — Bandung", email: "emc.ambassador2@example.com" },
    ],
  },
  {
    id: "comp-ispo",
    slug: "ispo",
    name: "ISPO — Science Project Olympiad",
    organizer: "Competzy",
    category: "Science",
    gradeLevel: "SMP,SMA",
    grades: ["SMP", "SMA"],
    fee: 75000,
    description:
      "The Indonesia Science Project Olympiad — a science competition covering physics, chemistry and biology for SMP and SMA students.",
    tag: "ISPO",
    subjects: [
      { name: "Physics", topics: ["Motion", "Energy"] },
      { name: "Chemistry", topics: ["Matter", "Reactions"] },
      { name: "Biology", topics: ["Cells", "Ecosystems"] },
    ],
    examName: "ISPO Round 1",
    questions: [
      { content: "What is the chemical formula of water?", grades: ["SMP", "SMA"], options: mc(["H₂O", true], ["CO₂", false], ["O₂", false], ["NaCl", false]) },
      { content: "Which planet is closest to the Sun?", grades: ["SMP", "SMA"], options: mc(["Mercury", true], ["Venus", false], ["Earth", false], ["Mars", false]) },
      { content: "Which organelle is the powerhouse of the cell?", grades: ["SMP", "SMA"], options: mc(["Mitochondria", true], ["Nucleus", false], ["Ribosome", false], ["Chloroplast", false]) },
      { content: "Which gas do plants absorb for photosynthesis?", grades: ["SMP", "SMA"], options: mc(["Carbon dioxide", true], ["Oxygen", false], ["Nitrogen", false], ["Hydrogen", false]) },
      { content: "What force pulls objects toward the Earth?", grades: ["SMP", "SMA"], options: mc(["Gravity", true], ["Friction", false], ["Magnetism", false], ["Tension", false]) },
      { content: "What is the hardest known natural material?", grades: ["SMP", "SMA"], options: mc(["Diamond", true], ["Gold", false], ["Iron", false], ["Quartz", false]) },
      { content: "How many bones are in the adult human body?", grades: ["SMP", "SMA"], options: mc(["206", true], ["201", false], ["212", false], ["198", false]) },
      { content: "Which part of a plant conducts photosynthesis?", grades: ["SMP", "SMA"], options: mc(["Leaf", true], ["Root", false], ["Stem", false], ["Flower", false]) },
    ],
    products: [
      { name: "ISPO Lab Coat", price: 120000, description: "A junior lab coat for the science fair." },
      { name: "ISPO Field Notebook", price: 40000, description: "Waterproof notebook for project notes." },
    ],
    announcements: [
      { title: "ISPO project abstracts due soon", body: "Submit your project abstract before the registration deadline. Round 1 follows shortly after." },
    ],
    materials: [
      { title: "ISPO Project Guidelines", body: "How to structure and present a science project.", category: "Guides" },
      { title: "Science Fair Rubric", body: "The criteria judges use to score projects.", category: "Guides" },
    ],
    referrals: [
      { name: "ISPO Ambassador — Surabaya", email: "ispo.ambassador@example.com" },
      { name: "ISPO Ambassador — Medan", email: "ispo.ambassador2@example.com" },
    ],
  },
  {
    id: "comp-osebi",
    slug: "osebi",
    name: "OSEBI — Arts & Culture Competition",
    organizer: "Competzy",
    category: "Arts & Culture",
    gradeLevel: "SD,SMP,SMA",
    grades: ["SD", "SMP", "SMA"],
    fee: 60000,
    description:
      "The Olimpiade Seni & Budaya Indonesia — an arts and culture competition covering music, visual arts and literature.",
    tag: "OSEBI",
    subjects: [
      { name: "Music", topics: ["Instruments", "Rhythm"] },
      { name: "Visual Arts", topics: ["Colour", "Composition"] },
      { name: "Literature", topics: ["Poetry", "Prose"] },
    ],
    examName: "OSEBI Round 1",
    questions: [
      { content: "How many strings does a standard guitar have?", grades: ["SD", "SMP", "SMA"], options: mc(["6", true], ["4", false], ["5", false], ["7", false]) },
      { content: "Which set are the primary colours?", grades: ["SD", "SMP", "SMA"], options: mc(["Red, yellow, blue", true], ["Red, green, blue", false], ["Orange, green, purple", false], ["Black, white, grey", false]) },
      { content: "Who painted the Mona Lisa?", grades: ["SD", "SMP", "SMA"], options: mc(["Leonardo da Vinci", true], ["Pablo Picasso", false], ["Vincent van Gogh", false], ["Claude Monet", false]) },
      { content: "How many lines does a haiku have?", grades: ["SD", "SMP", "SMA"], options: mc(["3", true], ["4", false], ["2", false], ["5", false]) },
      { content: "What is the traditional Indonesian shadow-puppet theatre called?", grades: ["SD", "SMP", "SMA"], options: mc(["Wayang", true], ["Gamelan", false], ["Batik", false], ["Angklung", false]) },
      { content: "Which instrument has black and white keys?", grades: ["SD", "SMP", "SMA"], options: mc(["Piano", true], ["Violin", false], ["Flute", false], ["Drum", false]) },
      { content: "What is the Japanese art of paper folding called?", grades: ["SD", "SMP", "SMA"], options: mc(["Origami", true], ["Ikebana", false], ["Calligraphy", false], ["Sumi-e", false]) },
      { content: "A large group of musicians playing together is an…?", grades: ["SD", "SMP", "SMA"], options: mc(["Orchestra", true], ["Solo", false], ["Duet", false], ["Choir", false]) },
    ],
    products: [
      { name: "OSEBI Sketchbook", price: 55000, description: "A4 sketchbook for the visual-arts category." },
      { name: "OSEBI Tote Bag", price: 35000, description: "Canvas tote with the OSEBI motif." },
    ],
    announcements: [
      { title: "OSEBI categories announced", body: "Music, visual arts and literature categories are open. Pick yours during registration." },
    ],
    materials: [
      { title: "OSEBI Submission Format", body: "File formats and sizes accepted for each category.", category: "Guides" },
    ],
    referrals: [
      { name: "OSEBI Ambassador — Yogyakarta", email: "osebi.ambassador@example.com" },
      { name: "OSEBI Ambassador — Bali", email: "osebi.ambassador2@example.com" },
    ],
  },
];

const REFERRAL_RATE = 25000; // commission per paid registration

// ── Per-competition seeding ───────────────────────────────────────────────
async function seedCompetition(spec: CompSpec, admin: string, client: import("pg").PoolClient) {
  // The competition row.
  await pool.query(
    `INSERT INTO competitions
       (id, name, organizer_name, category, grade_level, fee, quota,
        reg_open_date, reg_close_date, competition_date, required_docs,
        description, slug, kind, registration_status)
     VALUES ($1,$2,$3,$4,$5,$6,500,$7,$8,$9,'{}',$10,$11,'native','On Going')`,
    [
      spec.id, spec.name, spec.organizer, spec.category, spec.gradeLevel, spec.fee,
      ymd(-30), ymd(30), ymd(45), spec.description, spec.slug,
    ]
  );
  // The 6-step native flow.
  await seedDefaultFlow(client, spec.id, "native");

  // Taxonomy.
  for (const s of spec.subjects) {
    const subj = await pool.query(
      "INSERT INTO subjects (comp_id, name) VALUES ($1,$2) RETURNING id",
      [spec.id, s.name]
    );
    for (const t of s.topics) {
      await pool.query("INSERT INTO topics (comp_id, subject_id, name) VALUES ($1,$2,$3)", [
        spec.id, subj.rows[0].id, t,
      ]);
    }
  }

  // Question bank — all approved multiple-choice.
  const questionIds: string[] = [];
  let n = 1;
  for (const q of spec.questions) {
    const code = `${spec.tag}-Q${String(n++).padStart(2, "0")}`;
    const inserted = await pool.query(
      `INSERT INTO questions
         (comp_id, code, writer_id, approver_id, type, level, grades, content, status, approved_at)
       VALUES ($1,$2,$3,$3,'multiple_choice','medium',$4::jsonb,$5,'approved',now())
       RETURNING id`,
      [spec.id, code, admin, JSON.stringify(q.grades), q.content]
    );
    const qid = inserted.rows[0].id as string;
    questionIds.push(qid);
    for (const [text, isCorrect] of q.options) {
      await pool.query(
        "INSERT INTO answers (comp_id, question_id, content, is_correct) VALUES ($1,$2,$3,$4)",
        [spec.id, qid, text, isCorrect]
      );
    }
  }

  // One open exam (dated today, open all day) wired to every question.
  const score = Object.fromEntries(spec.grades.map((g) => [g, 4]));
  const wrong = Object.fromEntries(spec.grades.map((g) => [g, -1]));
  const exam = await pool.query(
    `INSERT INTO exams
       (comp_id, name, code, year, date, grades, choice, short, start_time, end_time,
        minutes, correct_score, wrong_score)
     VALUES ($1,$2,$3,2026,$4,$5::jsonb,true,false,'00:00','23:59',60,$6::jsonb,$7::jsonb)
     RETURNING id`,
    [spec.id, spec.examName, `${spec.tag}-R1`, ymd(0), JSON.stringify(spec.grades),
     JSON.stringify(score), JSON.stringify(wrong)]
  );
  for (const qid of questionIds) {
    await pool.query("INSERT INTO exam_question (exam_id, question_id) VALUES ($1,$2)", [
      exam.rows[0].id, qid,
    ]);
  }

  // Store products.
  let p = 1;
  for (const prod of spec.products) {
    const image = await storeFile(
      admin,
      Buffer.from(DEMO_JPEG_B64, "base64"),
      `${spec.tag}-product-${p}.jpg`,
      "image/jpeg"
    );
    const slug = prod.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    await pool.query(
      `INSERT INTO products (comp_id, code, name, slug, price, description, image, active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,true)`,
      [spec.id, `${spec.tag}-PRD${String(p++).padStart(2, "0")}`, prod.name, slug, prod.price,
       prod.description, image]
    );
  }

  // One voucher batch (5 codes — Rp 20k off the registration fee).
  const vg = await pool.query(
    `INSERT INTO voucher_groups (comp_id, name, code, usable_count, price, discounted, is_active)
     VALUES ($1,$2,$3,5,$4,$5,true) RETURNING id`,
    [spec.id, `${spec.tag} demo voucher batch`, `${spec.tag}-VG1`, spec.fee, Math.max(0, spec.fee - 20000)]
  );
  for (let i = 1; i <= 5; i++) {
    await pool.query(
      "INSERT INTO vouchers (comp_id, group_id, code, used, max) VALUES ($1,$2,$3,0,1)",
      [spec.id, vg.rows[0].id, `${spec.tag}-VG1-${String(i).padStart(3, "0")}`]
    );
  }

  // Announcements + materials.
  for (const a of spec.announcements) {
    await pool.query(
      `INSERT INTO announcements (comp_id, title, body, type, is_active, is_featured, published_at)
       VALUES ($1,$2,$3,'news',true,true,now())`,
      [spec.id, a.title, a.body]
    );
  }
  for (const m of spec.materials) {
    const file = await storeFile(
      admin,
      Buffer.from(DEMO_JPEG_B64, "base64"),
      `${spec.tag}-material-${m.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.jpg`,
      "image/jpeg"
    );
    await pool.query(
      `INSERT INTO materials (comp_id, title, body, type, category, grades, file, is_active, published_at)
       VALUES ($1,$2,$3,'file',$4,'[]'::jsonb,$5,true,now())`,
      [spec.id, m.title, m.body, m.category, file]
    );
  }

  // Fresh affiliate referral codes — a zeroed funnel, ready to test.
  let r = 1;
  for (const ref of spec.referrals) {
    await pool.query(
      `INSERT INTO referrals
         (comp_id, name, email, code, year, commission_per_paid,
          click, account, registration, paid, commission, total)
       VALUES ($1,$2,$3,$4,2026,$5,0,0,0,0,0,0)`,
      [spec.id, ref.name, ref.email, `${spec.tag}-AFF${r++}`, REFERRAL_RATE]
    );
  }
}

async function main() {
  const admin = await userId("admin@eduversal.com");
  if (!admin) {
    throw new Error("admin@eduversal.com not found — run `npm run db:create-admin` first.");
  }

  console.log("Resetting all competition data …");
  await reset();

  // Shared venues (global — no comp_id).
  const jkt = await pool.query(
    "INSERT INTO areas (province, code, part, is_active) VALUES ('DKI Jakarta','JKT','Jabodetabek',true) RETURNING id"
  );
  const bdg = await pool.query(
    "INSERT INTO areas (province, code, part, is_active) VALUES ('Jawa Barat','JABAR','West Java',true) RETURNING id"
  );
  await pool.query(
    "INSERT INTO test_centers (name, code, area_id, city, is_active) VALUES ('SMAN 8 Jakarta','TC-JKT-8',$1,'Jakarta',true)",
    [jkt.rows[0].id]
  );
  await pool.query(
    "INSERT INTO test_centers (name, code, area_id, city, is_active) VALUES ('Bandung Test Center','TC-BDG-1',$1,'Bandung',true)",
    [bdg.rows[0].id]
  );

  const client = await pool.connect();
  try {
    for (const spec of SPECS) await seedCompetition(spec, admin, client);
  } finally {
    client.release();
  }

  console.log("\nTest environment seeded — 3 native competitions:");
  for (const s of SPECS) {
    console.log(
      `  ${s.tag.padEnd(6)} (/${s.slug}) — ${s.questions.length} questions, exam ${s.tag}-R1 (open today), ` +
        `${s.products.length} products, voucher batch ${s.tag}-VG1, ${s.referrals.length} referral codes`
    );
  }
  console.log("\nReferral codes: " + SPECS.flatMap((s) => s.referrals.map((_, i) => `${s.tag}-AFF${i + 1}`)).join(", "));
  console.log("Venues: 2 areas, 2 test centers. users + historical_participants untouched.");
  await pool.end();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
