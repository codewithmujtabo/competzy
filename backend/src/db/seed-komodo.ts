/**
 * Add the Komodo — International Math Competition to a database.
 *
 *   npm run db:seed:komodo
 *
 * Non-destructive and idempotent — plain INSERTs, NO TRUNCATE. Unlike
 * `db:seed:test-competitions` (DEV/TEST only — it wipes every competition
 * table), this script is safe to run on production: it only adds the Komodo
 * competition + its 6 rounds + the default 6-step flow. If a `komodo`
 * competition already exists it exits without making any change.
 *
 * Prerequisite: the multi-round migrations (1750000000000–1750600000000) must
 * be applied first. `ts-node` is pruned from the production image, so run this
 * from a machine whose DATABASE_URL points at the target database (e.g. an
 * SSH tunnel or a temporary publish of the Coolify Postgres).
 *
 * Exams, the question bank and other content are NOT seeded — an operator
 * authors those through the question-bank UI after the competition exists.
 */

import { pool } from "../config/database";
import { seedDefaultFlow } from "../services/competition-flow.service";
import { replaceRounds, type RoundInput } from "../services/competition-rounds.service";

const COMP_ID = "comp-komodo";
const COMP_SLUG = "komodo";

// Local YYYY-MM-DD offset by `days` — not toISOString() (UTC can land a day off).
function ymd(days = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

// Numeric grades 1–12.
const GRADE_LEVEL = Array.from({ length: 12 }, (_, i) => i + 1).join(",");

// Komodo's six rounds — three open online qualification rounds, a Fast Track
// catch-up, a per-country Local Round, and the medal-gated Bali Global Round.
// Fast Track and the Global Round ship inactive (hidden from students) so an
// operator stages them on in due course; dates are a relative timeline an
// operator can adjust in the admin competition form.
// The age-cutoff date applied to every round — Komodo classifies students by
// age at this date into the five creature brackets (Gecko → Dragon). The
// per-round override lets a future season nudge it; today every Komodo round
// shares the same cutoff.
const AGE_CUTOFF = "2026-09-19";

const ROUNDS: RoundInput[] = [
  {
    roundName: "Online Round 1",
    roundNameId: "Babak Daring 1",
    roundType: "Online",
    roundCategory: "online",
    fee: 200000,
    feeInternational: 15,
    qualifyingScore: 16,
    examDate: ymd(-2),
    registrationDeadline: ymd(-5),
    isActive: true,
    gatingMode: "open",
    ageCutoffDate: AGE_CUTOFF,
    description:
      "First of three online qualification rounds. 60-minute multiple-choice paper, " +
      "scored automatically. Earn a medal to unlock the Bali Global Round.",
  },
  {
    roundName: "Online Round 2",
    roundNameId: "Babak Daring 2",
    roundType: "Online",
    roundCategory: "online",
    fee: 200000,
    feeInternational: 15,
    qualifyingScore: 16,
    examDate: ymd(30),
    registrationDeadline: ymd(25),
    isActive: true,
    gatingMode: "open",
    ageCutoffDate: AGE_CUTOFF,
    description:
      "Second qualification round. Independent of Round 1 — a student can join " +
      "any combination of online rounds.",
  },
  {
    roundName: "Online Round 3",
    roundNameId: "Babak Daring 3",
    roundType: "Online",
    roundCategory: "online",
    fee: 200000,
    feeInternational: 15,
    qualifyingScore: 16,
    examDate: ymd(60),
    registrationDeadline: ymd(55),
    isActive: true,
    gatingMode: "open",
    ageCutoffDate: AGE_CUTOFF,
    description:
      "Final qualification round — the last chance to earn a medal before the " +
      "Bali Global Round closes its qualifying gate.",
  },
  {
    roundName: "Fast Track",
    roundNameId: "Jalur Cepat",
    roundType: "Online",
    roundCategory: "fast_track",
    fee: 200000,
    feeInternational: 15,
    qualifyingScore: 16,
    examDate: ymd(90),
    registrationDeadline: ymd(85),
    isActive: false, // staged off — an operator turns it on once the online rounds close
    gatingMode: "unqualified",
    ageCutoffDate: AGE_CUTOFF,
    description:
      "Catch-up round for students who haven't yet earned a medal in the three " +
      "online rounds. Same scoring; passing here also unlocks the Bali Global Round.",
  },
  {
    roundName: "Local Round — Malaysia",
    roundNameId: "Babak Lokal — Malaysia",
    roundType: "On-site",
    roundCategory: "local",
    country: "Malaysia",
    examMode: "offline",
    fee: 200000,
    feeInternational: 15,
    qualifyingScore: 16,
    examDate: ymd(40),
    registrationDeadline: ymd(35),
    isActive: true,
    gatingMode: "open",
    ageCutoffDate: AGE_CUTOFF,
    description:
      "Offline paper exam held in Malaysia, organised by the country representative. " +
      "Open to Malaysian students only — additional country local rounds appear " +
      "automatically as each representative is appointed.",
  },
  {
    roundName: "Bali Global Round",
    roundNameId: "Babak Global Bali",
    roundType: "On-site",
    roundCategory: "global",
    fee: 500000,
    feeInternational: 40,
    location: "Bali, Indonesia",
    examDate: ymd(120),
    registrationDeadline: ymd(115),
    isActive: false, // staged off — an operator opens it once the earlier rounds finish
    gatingMode: "qualified",
    ageCutoffDate: AGE_CUTOFF,
    description:
      "The Grand Final — an in-person event in Bali for every medalist from the " +
      "online + fast-track + local rounds. Includes day-trip and 3-day packages.",
  },
];

async function main(): Promise<void> {
  // Idempotency — never duplicate Komodo, but DO backfill missing rounds /
  // flow when the competition row exists from an earlier run that predates
  // the multi-round migrations. This is the path operators on prod hit when
  // the comp was created via the admin UI without rounds.
  const existing = await pool.query(
    "SELECT id FROM competitions WHERE id = $1 OR slug = $2 LIMIT 1",
    [COMP_ID, COMP_SLUG],
  );

  // Owner — prefer an admin, then an organizer; NULL is acceptable (the
  // competition is still valid and an admin can claim it later).
  const ownerRes = await pool.query(
    `SELECT id FROM users
      WHERE role IN ('admin', 'organizer') AND deleted_at IS NULL
      ORDER BY (role = 'organizer') ASC, created_at ASC
      LIMIT 1`,
  );
  const createdBy: string | null = ownerRes.rows[0]?.id ?? null;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    let compId: string;
    if (existing.rows.length > 0) {
      compId = existing.rows[0].id as string;
      console.log(`Komodo already exists (id=${compId}) — checking rounds + flow.`);
    } else {
      await client.query(
        `INSERT INTO competitions
           (id, name, organizer_name, category, grade_level, fee, quota,
            reg_open_date, reg_close_date, competition_date, required_docs,
            description, slug, kind, registration_status, is_international,
            image_url, logo_url, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,500,$7,$8,$9,'{}',$10,$11,'native','On Going',
                 true,$12,$13,$14)`,
        [
          COMP_ID,
          "Komodo — International Math Competition",
          "Competzy",
          "Mathematics",
          GRADE_LEVEL,
          200000,
          ymd(-30),
          ymd(30),
          ymd(45),
          "The Komodo International Math Competition — a global mathematics challenge " +
            "with three online qualification rounds leading to the Grand Final in Bali, Indonesia.",
          COMP_SLUG,
          // Hero + logo URLs — public assets hosted on the competzy.com landing
          // site. Operators can swap these via the admin competition form.
          "https://competzy.com/images/Komodo/hero.webp",
          "https://competzy.com/images/Komodo/logo.webp",
          createdBy,
        ],
      );
      compId = COMP_ID;
      console.log(`Komodo created (id=${compId}).`);
    }

    // Always backfill is_international + image/logo URLs onto an existing row
    // too — production may carry a Komodo created without these columns set
    // (the original seed predated the international filter + image polish).
    // `competitions` has no updated_at column, so we skip the timestamp.
    await client.query(
      `UPDATE competitions
          SET is_international = true,
              image_url = COALESCE(image_url, $2),
              logo_url  = COALESCE(logo_url, $3)
        WHERE id = $1`,
      [
        compId,
        "https://competzy.com/images/Komodo/hero.webp",
        "https://competzy.com/images/Komodo/logo.webp",
      ],
    );

    // Backfill the 6-step native flow if it's missing. seedDefaultFlow inserts
    // unconditionally — guard with a count so it stays a no-op when present.
    const flowCount = await client.query(
      "SELECT COUNT(*)::int AS n FROM competition_flows WHERE comp_id = $1 AND deleted_at IS NULL",
      [compId],
    );
    if (flowCount.rows[0].n === 0) {
      await seedDefaultFlow(client, compId, "native");
      console.log(`  + Seeded the 6-step native flow.`);
    } else {
      console.log(`  · Flow already present (${flowCount.rows[0].n} steps) — left alone.`);
    }

    // Backfill the 6 rounds if missing. We deliberately DO NOT replace existing
    // rounds — an operator may have edited dates / fees and we'd clobber them.
    const roundCount = await client.query(
      "SELECT COUNT(*)::int AS n FROM competition_rounds WHERE comp_id = $1",
      [compId],
    );
    if (roundCount.rows[0].n === 0) {
      await replaceRounds(client, compId, ROUNDS);
      console.log(`  + Seeded ${ROUNDS.length} rounds.`);
    } else {
      console.log(`  · Rounds already present (${roundCount.rows[0].n}) — left alone.`);
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  console.log(
    `Komodo seed finished (slug=${COMP_SLUG})` +
      (createdBy ? ` — owner candidate ${createdBy}.` : " — no admin/organizer found to own it."),
  );
  await pool.end();
}

main().catch((err) => {
  console.error("seed-komodo failed:", err);
  process.exit(1);
});
