/**
 * Seed script — populates the competitions table with realistic
 * Indonesian K-12 competition data covering all categories and levels.
 *
 * Run:  npm run db:seed
 *
 * Safe to re-run: uses INSERT ... ON CONFLICT DO NOTHING so existing rows
 * are left untouched.
 */

import dotenv from "dotenv";
dotenv.config();

import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const competitions = [
  {
    id: "comp-001",
    name: "English Math Championship",
    organizer_name: "Kemendikbud",
    category: "Math",
    grade_level: "SD,SMP",
    fee: 0,
    quota: 500,
    reg_open_date: "2026-03-01",
    reg_close_date: "2026-03-30",
    competition_date: "2026-04-30",
    required_docs: ["student_id", "report_card"],
    description:
      "A national math challenge for young learners focusing on fundamentals and problem solving. Open to SD and SMP students across Indonesia.",
    image_url: null,
  },
  {
    id: "comp-002",
    name: "ISPO Science Olympiad",
    organizer_name: "ISPO Committee",
    category: "Science",
    grade_level: "SMP,SMA",
    fee: 75000,
    quota: 300,
    reg_open_date: "2026-03-15",
    reg_close_date: "2026-04-15",
    competition_date: "2026-04-25",
    required_docs: ["student_id", "report_card", "recommendation_letter"],
    description:
      "A practical and theoretical science competition covering physics, chemistry and biology. Includes project track with abstract submission.",
    image_url: null,
  },
  {
    id: "comp-003",
    name: "Kompetisi Debat Nasional SMA",
    organizer_name: "Competzy Foundation",
    category: "Debate",
    grade_level: "SMA",
    fee: 150000,
    quota: 200,
    reg_open_date: "2026-03-10",
    reg_close_date: "2026-04-10",
    competition_date: "2026-05-15",
    required_docs: ["student_id", "report_card"],
    description:
      "Kompetisi debat bahasa Indonesia tingkat nasional untuk pelajar SMA. Menggunakan format Asean Parliamentary. Tim terdiri dari 3 anggota.",
    image_url: null,
  },
  {
    id: "comp-004",
    name: "Festival Seni Budaya Nusantara",
    organizer_name: "Dinas Kebudayaan Jakarta",
    category: "Arts",
    grade_level: "SD,SMP,SMA",
    fee: 50000,
    quota: 400,
    reg_open_date: "2026-03-20",
    reg_close_date: "2026-04-20",
    competition_date: "2026-05-20",
    required_docs: ["student_id"],
    description:
      "Festival seni budaya nusantara yang menampilkan tari tradisional, musik, dan seni rupa. Terbuka untuk semua jenjang pendidikan.",
    image_url: null,
  },
  {
    id: "comp-005",
    name: "Olimpiade Fisika Indonesia (OFI)",
    organizer_name: "Himpunan Fisika Indonesia",
    category: "Science",
    grade_level: "SMA",
    fee: 100000,
    quota: 250,
    reg_open_date: "2026-04-01",
    reg_close_date: "2026-04-30",
    competition_date: "2026-06-01",
    required_docs: ["student_id", "report_card"],
    description:
      "Olimpiade fisika tingkat nasional sebagai seleksi untuk Olimpiade Fisika Internasional (IPhO). Materi meliputi mekanika, termodinamika, dan elektromagnetisme.",
    image_url: null,
  },
  {
    id: "comp-006",
    name: "Story Telling & Public Speaking SD",
    organizer_name: "Competzy Foundation",
    category: "Language",
    grade_level: "SD",
    fee: 0,
    quota: 300,
    reg_open_date: "2026-03-25",
    reg_close_date: "2026-04-25",
    competition_date: "2026-05-10",
    required_docs: ["student_id"],
    description:
      "Kompetisi bercerita dan berbicara di depan umum dalam Bahasa Indonesia untuk siswa SD. Membangun kepercayaan diri dan kemampuan komunikasi sejak dini.",
    image_url: null,
  },
  {
    id: "comp-007",
    name: "Kompetisi Robotika SMP Nasional",
    organizer_name: "BRIN",
    category: "Technology",
    grade_level: "SMP",
    fee: 200000,
    quota: 150,
    reg_open_date: "2026-04-05",
    reg_close_date: "2026-05-05",
    competition_date: "2026-06-15",
    required_docs: ["student_id", "recommendation_letter"],
    description:
      "Kompetisi robotika untuk siswa SMP. Tim merancang dan memprogram robot untuk menyelesaikan tantangan yang diberikan. Tim terdiri dari 2-4 anggota.",
    image_url: null,
  },
  {
    id: "comp-008",
    name: "Olimpiade Matematika Nasional (OMN)",
    organizer_name: "Kemendikbud",
    category: "Math",
    grade_level: "SMP,SMA",
    fee: 0,
    quota: 1000,
    reg_open_date: "2026-04-10",
    reg_close_date: "2026-05-10",
    competition_date: "2026-06-20",
    required_docs: ["student_id", "report_card"],
    description:
      "Seleksi resmi Olimpiade Matematika tingkat nasional. Peraih medali emas SMA berkesempatan mewakili Indonesia di IMO.",
    image_url: null,
  },
  {
    id: "comp-009",
    name: "Lomba Menulis Cerpen Remaja",
    organizer_name: "Balai Bahasa",
    category: "Language",
    grade_level: "SMP,SMA",
    fee: 25000,
    quota: 600,
    reg_open_date: "2026-03-15",
    reg_close_date: "2026-05-15",
    competition_date: "2026-06-30",
    required_docs: ["student_id"],
    description:
      "Lomba menulis cerita pendek dalam Bahasa Indonesia. Naskah dikirim secara online. Tema: Keberagaman Indonesia.",
    image_url: null,
  },
  {
    id: "comp-010",
    name: "National English Olympiad (NEO)",
    organizer_name: "Competzy Foundation",
    category: "Language",
    grade_level: "SMA",
    fee: 125000,
    quota: 350,
    reg_open_date: "2026-04-15",
    reg_close_date: "2026-05-15",
    competition_date: "2026-07-01",
    required_docs: ["student_id", "report_card"],
    description:
      "National English Olympiad testing reading, writing, speaking, and listening skills. Top 3 finalists represent Indonesia at international level.",
    image_url: null,
  },
  {
    id: "comp-011",
    name: "Kejuaraan Badminton Pelajar Nasional",
    organizer_name: "PBSI",
    category: "Sports",
    grade_level: "SD,SMP,SMA",
    fee: 75000,
    quota: 500,
    reg_open_date: "2026-04-01",
    reg_close_date: "2026-05-01",
    competition_date: "2026-06-10",
    required_docs: ["student_id", "health_certificate"],
    description:
      "Kejuaraan bulu tangkis pelajar tingkat nasional. Kategori tunggal putra, tunggal putri, dan ganda. Terbuka untuk SD, SMP, dan SMA.",
    image_url: null,
  },
  {
    id: "comp-012",
    name: "Kompetisi Sains Madrasah (KSM)",
    organizer_name: "Kemenag",
    category: "Science",
    grade_level: "SD,SMP",
    fee: 0,
    quota: 800,
    reg_open_date: "2026-05-01",
    reg_close_date: "2026-05-31",
    competition_date: "2026-07-15",
    required_docs: ["student_id", "report_card"],
    description:
      "Kompetisi sains untuk siswa madrasah. Mata pelajaran: IPA, IPS, dan Matematika. Pendaftaran melalui madrasah asal.",
    image_url: null,
  },
  {
    id: "comp-013",
    name: "Lomba Karya Tulis Ilmiah (LKTI) SMA",
    organizer_name: "Universitas Indonesia",
    category: "Science",
    grade_level: "SMA",
    fee: 100000,
    quota: 200,
    reg_open_date: "2026-04-20",
    reg_close_date: "2026-05-20",
    competition_date: "2026-07-05",
    required_docs: ["student_id", "report_card", "recommendation_letter"],
    description:
      "Lomba karya tulis ilmiah tingkat nasional untuk siswa SMA. Tema: Inovasi untuk Indonesia Berkelanjutan. Terdiri dari seleksi abstrak dan presentasi final.",
    image_url: null,
  },
  {
    id: "comp-014",
    name: "Olimpiade Olahraga Siswa Nasional (O2SN)",
    organizer_name: "Kemendikbud",
    category: "Sports",
    grade_level: "SD,SMP,SMA",
    fee: 0,
    quota: 2000,
    reg_open_date: "2026-05-10",
    reg_close_date: "2026-06-10",
    competition_date: "2026-08-01",
    required_docs: ["student_id", "health_certificate"],
    description:
      "Olimpiade olahraga pelajar terbesar di Indonesia. Cabang olahraga: atletik, renang, senam, bola voli, dan pencak silat.",
    image_url: null,
  },
  {
    id: "comp-015",
    name: "Festival Film Pendek Pelajar",
    organizer_name: "Kemendikbud",
    category: "Arts",
    grade_level: "SMP,SMA",
    fee: 50000,
    quota: 300,
    reg_open_date: "2026-04-01",
    reg_close_date: "2026-05-01",
    competition_date: "2026-06-25",
    required_docs: ["student_id", "recommendation_letter"],
    description:
      "Festival film pendek bagi pelajar SMP dan SMA. Durasi maksimal 10 menit. Tema bebas namun bermuatan positif. Film dikirim secara online.",
    image_url: null,
  },
];

async function seed() {
  const client = await pool.connect();
  try {
    console.log("Seeding competitions...");

    for (const comp of competitions) {
      await client.query(
        `INSERT INTO competitions (
          id, name, organizer_name, category, grade_level,
          fee, quota, reg_open_date, reg_close_date, competition_date,
          required_docs, description, image_url
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        ON CONFLICT (id) DO NOTHING`,
        [
          comp.id,
          comp.name,
          comp.organizer_name,
          comp.category,
          comp.grade_level,
          comp.fee,
          comp.quota,
          comp.reg_open_date,
          comp.reg_close_date,
          comp.competition_date,
          comp.required_docs,
          comp.description,
          comp.image_url,
        ]
      );
    }

    console.log(`Seeded ${competitions.length} competitions.`);
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
