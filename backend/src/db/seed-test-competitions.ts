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
import { replaceRounds } from "../services/competition-rounds.service";

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
  "competitions", "competition_rounds", "registrations", "payments", "competition_flows",
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

// One round of a multi-round competition — its own exam + question set, fee
// and (optionally) a gating prerequisite.
interface RoundSpec {
  roundName: string;
  roundType: string; // "Online" | "On-site"
  roundCategory?: string; // "online" (default) | "fast_track" | "local" | "global"
  fee: number;
  examDate: string; // the round's scheduled date, "YYYY-MM-DD"
  registrationDeadline?: string; // last day to register for the round
  location?: string;
  country?: string; // for a local round — the country it serves
  examMode?: string; // "online" (default) | "offline" (printed, score-imported)
  qualifyingScore?: number; // score at/above which a round attempt medals
  isActive?: boolean; // operator visibility toggle — default true; false = hidden
  /** Omit for an open round. `mode`: prerequisite | qualified | unqualified. */
  gating?: { mode: string; requiresRoundIndex?: number; rule?: string };
  examName: string;
  examCode: string; // e.g. "KMD-R1"
  questions: SeedQuestion[];
}

interface FlowStageSpec {
  key: string;
  title: string;
  description: string;
  check: "profile" | "documents" | "payment" | "approval" | "none";
  startOffset?: number; // days from today → starts_on
  endOffset?: number; // days from today → ends_on
  location?: string;
}

interface CompSpec {
  id: string;
  slug: string;
  name: string;
  organizer: string;
  category: string;
  gradeLevel: string; // comma-joined numeric grades, e.g. "1,2,3"
  grades: string[]; // numeric grades, e.g. ["7","8","9"]
  fee: number;
  description: string;
  tag: string; // code prefix, e.g. "EMC"
  subjects: { name: string; topics: string[] }[];
  // Single-round competitions: one exam from these.
  examName?: string;
  questions?: SeedQuestion[];
  // Multi-round competitions: rounds, each with its own exam + question set.
  rounds?: RoundSpec[];
  // Custom dated flow (the mockup's contest stages). Seeded instead of the
  // generic native lifecycle flow when present.
  flow?: FlowStageSpec[];
  products: { name: string; price: number; description: string }[];
  announcements: { title: string; body: string }[];
  materials: { title: string; body: string; category: string }[];
  referrals: { name: string; email: string }[];
}

// ── The three competitions ────────────────────────────────────────────────
const mc = (...opts: [string, boolean][]): [string, boolean][] => opts;

// Grade vocabulary — numeric grades 1-12 (replaced SD/SMP/SMA).
const ALL_GRADES = Array.from({ length: 12 }, (_, i) => String(i + 1));
const SECONDARY_GRADES = ["7", "8", "9", "10", "11", "12"];

const SPECS: CompSpec[] = [
  {
    id: "comp-emc",
    slug: "emc",
    name: "EMC — Mathematics Competition",
    organizer: "Competzy",
    category: "Mathematics",
    gradeLevel: ALL_GRADES.join(","),
    grades: ALL_GRADES,
    fee: 50000,
    description:
      "The Eduversal Mathematics Competition — a national math challenge spanning arithmetic, algebra and geometry for SD, SMP and SMA students.",
    tag: "EMC",
    subjects: [
      { name: "Arithmetic", topics: ["Fractions", "Percentages"] },
      { name: "Algebra", topics: ["Linear Equations", "Quadratics"] },
      { name: "Geometry", topics: ["Triangles", "Circles"] },
    ],
    flow: [
      {
        key: "registration",
        title: "Registration",
        check: "payment",
        description:
          "Complete your registration form and pay the fee to activate your participant card.",
        startOffset: -5,
        endOffset: 55,
        location: "Online / Test Center",
      },
      {
        key: "simulation",
        title: "Online Simulation",
        check: "none",
        description:
          "A practice run to learn the exam interface. Your simulation score does not affect any round.",
        startOffset: 63,
        location: "Online",
      },
      {
        key: "round1",
        title: "Round 1 · City / Regency Level",
        check: "none",
        description:
          "The first qualifying round, online. Opens automatically after the simulation.",
        startOffset: 70,
        location: "Online",
      },
      {
        key: "round2",
        title: "Round 2 · Provincial Level",
        check: "none",
        description: "Provincial round — open to participants who pass Round 1.",
        startOffset: 84,
        location: "Online",
      },
      {
        key: "round3",
        title: "Round 3 · National Level",
        check: "none",
        description:
          "The offline national final at a Test Center, for participants who pass Round 2.",
        startOffset: 112,
        location: "Offline · Test Center",
      },
      {
        key: "announcement",
        title: "Winners Announcement",
        check: "none",
        description: "Champions announced and the closing ceremony.",
        startOffset: 133,
        location: "Online · Zoom",
      },
    ],
    examName: "EMC Round 1",
    questions: [
      { content: "What is 1/2 + 1/4?", grades: ALL_GRADES, options: mc(["3/4", true], ["1/2", false], ["2/6", false], ["1/4", false]) },
      { content: "Solve: 2x + 3 = 11", grades: ALL_GRADES, options: mc(["x = 4", true], ["x = 5", false], ["x = 7", false], ["x = 3", false]) },
      { content: "Sum of the interior angles of a triangle?", grades: ALL_GRADES, options: mc(["180°", true], ["90°", false], ["360°", false], ["270°", false]) },
      { content: "What is 25% of 80?", grades: ALL_GRADES, options: mc(["20", true], ["25", false], ["40", false], ["15", false]) },
      { content: "Which of these is a prime number?", grades: ALL_GRADES, options: mc(["7", true], ["9", false], ["15", false], ["21", false]) },
      { content: "If x = 6, what is x²?", grades: ALL_GRADES, options: mc(["36", true], ["12", false], ["18", false], ["66", false]) },
      { content: "What is 12 × 12?", grades: ALL_GRADES, options: mc(["144", true], ["121", false], ["169", false], ["132", false]) },
      { content: "What is the positive value of x when x² = 49?", grades: ALL_GRADES, options: mc(["7", true], ["8", false], ["6", false], ["9", false]) },
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
    gradeLevel: SECONDARY_GRADES.join(","),
    grades: SECONDARY_GRADES,
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
      { content: "What is the chemical formula of water?", grades: SECONDARY_GRADES, options: mc(["H₂O", true], ["CO₂", false], ["O₂", false], ["NaCl", false]) },
      { content: "Which planet is closest to the Sun?", grades: SECONDARY_GRADES, options: mc(["Mercury", true], ["Venus", false], ["Earth", false], ["Mars", false]) },
      { content: "Which organelle is the powerhouse of the cell?", grades: SECONDARY_GRADES, options: mc(["Mitochondria", true], ["Nucleus", false], ["Ribosome", false], ["Chloroplast", false]) },
      { content: "Which gas do plants absorb for photosynthesis?", grades: SECONDARY_GRADES, options: mc(["Carbon dioxide", true], ["Oxygen", false], ["Nitrogen", false], ["Hydrogen", false]) },
      { content: "What force pulls objects toward the Earth?", grades: SECONDARY_GRADES, options: mc(["Gravity", true], ["Friction", false], ["Magnetism", false], ["Tension", false]) },
      { content: "What is the hardest known natural material?", grades: SECONDARY_GRADES, options: mc(["Diamond", true], ["Gold", false], ["Iron", false], ["Quartz", false]) },
      { content: "How many bones are in the adult human body?", grades: SECONDARY_GRADES, options: mc(["206", true], ["201", false], ["212", false], ["198", false]) },
      { content: "Which part of a plant conducts photosynthesis?", grades: SECONDARY_GRADES, options: mc(["Leaf", true], ["Root", false], ["Stem", false], ["Flower", false]) },
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
    gradeLevel: ALL_GRADES.join(","),
    grades: ALL_GRADES,
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
      { content: "How many strings does a standard guitar have?", grades: ALL_GRADES, options: mc(["6", true], ["4", false], ["5", false], ["7", false]) },
      { content: "Which set are the primary colours?", grades: ALL_GRADES, options: mc(["Red, yellow, blue", true], ["Red, green, blue", false], ["Orange, green, purple", false], ["Black, white, grey", false]) },
      { content: "Who painted the Mona Lisa?", grades: ALL_GRADES, options: mc(["Leonardo da Vinci", true], ["Pablo Picasso", false], ["Vincent van Gogh", false], ["Claude Monet", false]) },
      { content: "How many lines does a haiku have?", grades: ALL_GRADES, options: mc(["3", true], ["4", false], ["2", false], ["5", false]) },
      { content: "What is the traditional Indonesian shadow-puppet theatre called?", grades: ALL_GRADES, options: mc(["Wayang", true], ["Gamelan", false], ["Batik", false], ["Angklung", false]) },
      { content: "Which instrument has black and white keys?", grades: ALL_GRADES, options: mc(["Piano", true], ["Violin", false], ["Flute", false], ["Drum", false]) },
      { content: "What is the Japanese art of paper folding called?", grades: ALL_GRADES, options: mc(["Origami", true], ["Ikebana", false], ["Calligraphy", false], ["Sumi-e", false]) },
      { content: "A large group of musicians playing together is an…?", grades: ALL_GRADES, options: mc(["Orchestra", true], ["Solo", false], ["Duet", false], ["Choir", false]) },
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
  {
    id: "comp-komodo",
    slug: "komodo",
    name: "Komodo — International Math Competition",
    organizer: "Competzy",
    category: "Mathematics",
    gradeLevel: ALL_GRADES.join(","),
    grades: ALL_GRADES,
    fee: 200000,
    description:
      "The Komodo International Math Competition — a global mathematics challenge with three online qualification rounds leading to the Grand Final in Bali, Indonesia.",
    tag: "KMD",
    subjects: [
      { name: "Number Sense", topics: ["Arithmetic", "Number Theory"] },
      { name: "Algebra", topics: ["Equations", "Sequences"] },
      { name: "Geometry", topics: ["Angles & Shapes", "Area & Measurement"] },
    ],
    rounds: [
      {
        roundName: "Online Round 1",
        roundType: "Online",
        roundCategory: "online",
        fee: 200000,
        qualifyingScore: 16,
        examDate: ymd(-2),
        registrationDeadline: ymd(-5),
        examName: "Komodo Online Round 1",
        examCode: "KMD-R1",
        questions: [
          { content: "What is 7 + 8?", grades: ALL_GRADES, options: mc(["15", true], ["14", false], ["16", false], ["13", false]) },
          { content: "What is 9 × 6?", grades: ALL_GRADES, options: mc(["54", true], ["48", false], ["56", false], ["63", false]) },
          { content: "What is half of 84?", grades: ALL_GRADES, options: mc(["42", true], ["44", false], ["38", false], ["40", false]) },
          { content: "What is 100 − 37?", grades: ALL_GRADES, options: mc(["63", true], ["67", false], ["73", false], ["57", false]) },
          { content: "How many sides does a hexagon have?", grades: ALL_GRADES, options: mc(["6", true], ["5", false], ["7", false], ["8", false]) },
          { content: "Which of these is a prime number?", grades: ALL_GRADES, options: mc(["11", true], ["9", false], ["15", false], ["21", false]) },
        ],
      },
      {
        roundName: "Online Round 2",
        roundType: "Online",
        roundCategory: "online",
        fee: 200000,
        qualifyingScore: 16,
        examDate: ymd(30),
        registrationDeadline: ymd(25),
        examName: "Komodo Online Round 2",
        examCode: "KMD-R2",
        questions: [
          { content: "What is 3/4 + 1/8?", grades: ALL_GRADES, options: mc(["7/8", true], ["1/2", false], ["4/12", false], ["5/8", false]) },
          { content: "What is 15% of 200?", grades: ALL_GRADES, options: mc(["30", true], ["25", false], ["35", false], ["15", false]) },
          { content: "Solve: 3x = 21", grades: ALL_GRADES, options: mc(["x = 7", true], ["x = 6", false], ["x = 8", false], ["x = 3", false]) },
          { content: "What is the area of a rectangle 5 by 8?", grades: ALL_GRADES, options: mc(["40", true], ["13", false], ["26", false], ["45", false]) },
          { content: "What is 2³?", grades: ALL_GRADES, options: mc(["8", true], ["6", false], ["9", false], ["16", false]) },
          { content: "What is the average of 10, 20 and 30?", grades: ALL_GRADES, options: mc(["20", true], ["25", false], ["15", false], ["30", false]) },
        ],
      },
      {
        roundName: "Online Round 3",
        roundType: "Online",
        roundCategory: "online",
        fee: 200000,
        qualifyingScore: 16,
        examDate: ymd(60),
        registrationDeadline: ymd(55),
        examName: "Komodo Online Round 3",
        examCode: "KMD-R3",
        questions: [
          { content: "What is the positive solution of x² = 64?", grades: ALL_GRADES, options: mc(["8", true], ["6", false], ["16", false], ["32", false]) },
          { content: "What is the sum of the interior angles of a pentagon?", grades: ALL_GRADES, options: mc(["540°", true], ["360°", false], ["450°", false], ["720°", false]) },
          { content: "If 2x + 5 = 19, what is x?", grades: ALL_GRADES, options: mc(["7", true], ["6", false], ["8", false], ["12", false]) },
          { content: "What is 7! ÷ 5!?", grades: ALL_GRADES, options: mc(["42", true], ["35", false], ["49", false], ["30", false]) },
          { content: "The legs of a right triangle are 3 and 4 — what is the hypotenuse?", grades: ALL_GRADES, options: mc(["5", true], ["6", false], ["7", false], ["25", false]) },
          { content: "Simplify (x²)³.", grades: ALL_GRADES, options: mc(["x⁶", true], ["x⁵", false], ["x⁸", false], ["x⁹", false]) },
        ],
      },
      {
        roundName: "Fast Track",
        roundType: "Online",
        roundCategory: "fast_track",
        fee: 200000,
        examDate: ymd(90),
        registrationDeadline: ymd(85),
        qualifyingScore: 16,
        // Staged off — an operator turns it on once the online rounds close.
        isActive: false,
        gating: { mode: "unqualified" },
        examName: "Komodo Fast Track Exam",
        examCode: "KMD-FT",
        questions: [
          { content: "What is 6 × 7?", grades: ALL_GRADES, options: mc(["42", true], ["36", false], ["48", false], ["49", false]) },
          { content: "What is half of 60?", grades: ALL_GRADES, options: mc(["30", true], ["25", false], ["35", false], ["20", false]) },
          { content: "Solve: x + 9 = 20", grades: ALL_GRADES, options: mc(["x = 11", true], ["x = 9", false], ["x = 29", false], ["x = 12", false]) },
          { content: "What is 5²?", grades: ALL_GRADES, options: mc(["25", true], ["10", false], ["20", false], ["55", false]) },
          { content: "How many minutes are in 2 hours?", grades: ALL_GRADES, options: mc(["120", true], ["60", false], ["100", false], ["240", false]) },
          { content: "What is 144 ÷ 12?", grades: ALL_GRADES, options: mc(["12", true], ["14", false], ["11", false], ["10", false]) },
        ],
      },
      {
        roundName: "Local Round — Malaysia",
        roundType: "On-site",
        roundCategory: "local",
        country: "Malaysia",
        examMode: "offline",
        fee: 200000,
        examDate: ymd(40),
        registrationDeadline: ymd(35),
        qualifyingScore: 16,
        examName: "Komodo Local Round — Malaysia",
        examCode: "KMD-MY",
        questions: [],
      },
      {
        roundName: "Bali Global Round",
        roundType: "On-site",
        roundCategory: "global",
        fee: 500000,
        examDate: ymd(120),
        registrationDeadline: ymd(115),
        location: "Bali, Indonesia",
        // Staged off — an operator opens it once every earlier round finishes.
        isActive: false,
        gating: { mode: "qualified" },
        examName: "Komodo Bali Global Round",
        examCode: "KMD-R4",
        questions: [
          { content: "If log₂(x) = 5, what is x?", grades: ALL_GRADES, options: mc(["32", true], ["25", false], ["10", false], ["16", false]) },
          { content: "What is the sum of the first 10 positive integers?", grades: ALL_GRADES, options: mc(["55", true], ["50", false], ["45", false], ["100", false]) },
          { content: "How many diagonals does an octagon have?", grades: ALL_GRADES, options: mc(["20", true], ["16", false], ["24", false], ["28", false]) },
          { content: "How many ways can 4 distinct books be arranged on a shelf?", grades: ALL_GRADES, options: mc(["24", true], ["12", false], ["16", false], ["8", false]) },
          { content: "What is the next term of the sequence 2, 6, 12, 20, …?", grades: ALL_GRADES, options: mc(["30", true], ["28", false], ["26", false], ["32", false]) },
          { content: "Two angles of a triangle are 40° and 75°. What is the third?", grades: ALL_GRADES, options: mc(["65°", true], ["75°", false], ["55°", false], ["70°", false]) },
        ],
      },
    ],
    products: [
      { name: "Komodo Competitor Hoodie", price: 220000, description: "A warm hoodie with the Komodo crest." },
      { name: "Komodo Medal Display Box", price: 95000, description: "A wooden box to display your Komodo medal." },
    ],
    announcements: [
      { title: "Komodo 2027 registration is open", body: "The Komodo International Math Competition is open for the 2027 season. Register for Online Round 1 to begin your journey to the Bali Global Round." },
    ],
    materials: [
      { title: "Komodo Sample Questions", body: "A set of practice questions covering all four rounds.", category: "Practice" },
      { title: "How the Komodo Rounds Work", body: "A guide to the three online rounds and the Bali Global Round.", category: "Guides" },
    ],
    referrals: [
      { name: "Komodo Ambassador — Singapore", email: "komodo.ambassador@example.com" },
      { name: "Komodo Ambassador — Manila", email: "komodo.ambassador2@example.com" },
    ],
  },
];

const REFERRAL_RATE = 25000; // commission per paid registration

// Seed a competition's question bank — approved multiple-choice questions with
// codes <tag>-Q01, Q02, … starting at `startNum`. Returns the question ids.
async function seedQuestionBank(
  spec: CompSpec,
  admin: string,
  questions: SeedQuestion[],
  startNum: number
): Promise<string[]> {
  const ids: string[] = [];
  let n = startNum;
  for (const q of questions) {
    const code = `${spec.tag}-Q${String(n++).padStart(2, "0")}`;
    const inserted = await pool.query(
      `INSERT INTO questions
         (comp_id, code, writer_id, approver_id, type, level, grades, content, status, approved_at)
       VALUES ($1,$2,$3,$3,'multiple_choice','medium',$4::jsonb,$5,'approved',now())
       RETURNING id`,
      [spec.id, code, admin, JSON.stringify(q.grades), q.content]
    );
    const qid = inserted.rows[0].id as string;
    ids.push(qid);
    for (const [text, isCorrect] of q.options) {
      await pool.query(
        "INSERT INTO answers (comp_id, question_id, content, is_correct) VALUES ($1,$2,$3,$4)",
        [spec.id, qid, text, isCorrect]
      );
    }
  }
  return ids;
}

// Seed one exam — open today (so it's testable now) and wired to `questionIds`.
// `roundId` ties it to a competition round (NULL for a single-round comp).
async function seedExam(
  compId: string,
  roundId: string | null,
  name: string,
  code: string,
  grades: string[],
  questionIds: string[]
): Promise<void> {
  const score = Object.fromEntries(grades.map((g) => [g, 4]));
  const wrong = Object.fromEntries(grades.map((g) => [g, -1]));
  const exam = await pool.query(
    `INSERT INTO exams
       (comp_id, round_id, name, code, year, date, grades, choice, short,
        start_time, end_time, minutes, correct_score, wrong_score)
     VALUES ($1,$2,$3,$4,2026,$5,$6::jsonb,true,false,'00:00','23:59',60,$7::jsonb,$8::jsonb)
     RETURNING id`,
    [compId, roundId, name, code, ymd(0), JSON.stringify(grades),
     JSON.stringify(score), JSON.stringify(wrong)]
  );
  for (const qid of questionIds) {
    await pool.query("INSERT INTO exam_question (exam_id, question_id) VALUES ($1,$2)", [
      exam.rows[0].id, qid,
    ]);
  }
}

// ── Per-competition seeding ───────────────────────────────────────────────
async function seedCompetition(
  spec: CompSpec,
  admin: string,
  owner: string,
  client: import("pg").PoolClient
) {
  // The competition row — owned by `owner` (the organizer test account) so the
  // organizer portal lists and manages it.
  await pool.query(
    `INSERT INTO competitions
       (id, name, organizer_name, category, grade_level, fee, quota,
        reg_open_date, reg_close_date, competition_date, required_docs,
        description, slug, kind, registration_status, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,500,$7,$8,$9,'{}',$10,$11,'native','On Going',$12)`,
    [
      spec.id, spec.name, spec.organizer, spec.category, spec.gradeLevel, spec.fee,
      ymd(-30), ymd(30), ymd(45), spec.description, spec.slug, owner,
    ]
  );
  // A custom dated flow (the mockup's contest stages) when the spec defines
  // one, else the generic native lifecycle flow.
  if (spec.flow && spec.flow.length > 0) {
    for (let i = 0; i < spec.flow.length; i++) {
      const f = spec.flow[i];
      await client.query(
        `INSERT INTO competition_flows
           (comp_id, step_order, step_key, title, description, check_type, starts_on, ends_on, location)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          spec.id,
          i + 1,
          f.key,
          f.title,
          f.description,
          f.check,
          f.startOffset != null ? ymd(f.startOffset) : null,
          f.endOffset != null ? ymd(f.endOffset) : null,
          f.location ?? null,
        ]
      );
    }
  } else {
    await seedDefaultFlow(client, spec.id, "native");
  }

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

  // Question bank + exams — one exam for a single-round competition, or one
  // exam per round (each tied to its competition_rounds row) for a multi-round
  // competition.
  if (spec.rounds && spec.rounds.length > 0) {
    const roundInputs = spec.rounds.map((rd) => ({
      roundName: rd.roundName,
      roundType: rd.roundType,
      roundCategory: rd.roundCategory ?? "online",
      examDate: rd.examDate,
      registrationDeadline: rd.registrationDeadline ?? null,
      fee: rd.fee,
      location: rd.location ?? null,
      country: rd.country ?? null,
      examMode: rd.examMode ?? "online",
      qualifyingScore: rd.qualifyingScore ?? null,
      isActive: rd.isActive ?? true,
      gatingMode: rd.gating?.mode ?? "open",
      requiresRoundIndex: rd.gating?.requiresRoundIndex ?? null,
      gatingRule: rd.gating?.rule ?? null,
    }));
    await replaceRounds(client, spec.id, roundInputs);
    const roundRows = (
      await pool.query(
        "SELECT id FROM competition_rounds WHERE comp_id = $1 ORDER BY round_order ASC",
        [spec.id]
      )
    ).rows;
    let qNum = 1;
    for (let i = 0; i < spec.rounds.length; i++) {
      const rd = spec.rounds[i];
      // An offline round has no online exam — scores arrive via CSV import.
      if (rd.examMode === "offline") continue;
      const qids = await seedQuestionBank(spec, admin, rd.questions, qNum);
      qNum += rd.questions.length;
      await seedExam(spec.id, roundRows[i].id, rd.examName, rd.examCode, spec.grades, qids);
    }
  } else {
    const qids = await seedQuestionBank(spec, admin, spec.questions ?? [], 1);
    await seedExam(
      spec.id, null, spec.examName ?? `${spec.tag} Round 1`, `${spec.tag}-R1`, spec.grades, qids
    );
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
  // Competitions are owned by the organizer test account so the organizer
  // portal can see + manage them. Falls back to admin if no organizer exists.
  const owner = (await userId("organizer@eduversal.com")) ?? admin;

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
    for (const spec of SPECS) await seedCompetition(spec, admin, owner, client);
  } finally {
    client.release();
  }

  console.log(`\nTest environment seeded — ${SPECS.length} native competitions:`);
  for (const s of SPECS) {
    const qCount = s.rounds
      ? s.rounds.reduce((sum, rd) => sum + rd.questions.length, 0)
      : s.questions?.length ?? 0;
    const examInfo = s.rounds ? `${s.rounds.length} rounds` : `exam ${s.tag}-R1 (open today)`;
    console.log(
      `  ${s.tag.padEnd(6)} (/${s.slug}) — ${qCount} questions, ${examInfo}, ` +
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
