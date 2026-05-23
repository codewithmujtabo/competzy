// Competition rounds — the multi-round write path shared by the admin and
// organizer competition POST/PUT handlers. `replaceRounds` swaps a
// competition's rounds wholesale (delete-all + re-insert) inside the caller's
// transaction.

import type { PoolClient } from "pg";

const VALID_ROUND_TYPES = ["Online", "On-site", "Hybrid"];
const VALID_RULES = ["registered", "paid", "completed"];
const VALID_CATEGORIES = ["online", "fast_track", "local", "global"];
const VALID_EXAM_MODES = ["online", "offline"];

export interface RoundInput {
  roundName?: string;
  roundType?: string | null;
  startDate?: string | null;
  registrationDeadline?: string | null;
  examDate?: string | null;
  resultsDate?: string | null;
  fee?: number | null;
  /** Optional international price in USD (display-only — Midtrans is IDR-only). */
  feeInternational?: number | null;
  location?: string | null;
  requiredDocs?: string[] | null;
  /** "online" (default) | "fast_track" | "local" | "global". */
  roundCategory?: string | null;
  /** For a local round — the country it serves. */
  country?: string | null;
  /** "online" (default — platform exam) | "offline" (printed, score-imported). */
  examMode?: string | null;
  /** Score at/above which a round attempt earns a medal. */
  qualifyingScore?: number | null;
  /** "open" (default) | "prerequisite" | "qualified" | "unqualified". */
  gatingMode?: string | null;
  /** Ordinal (0-based) of the prerequisite round, for "prerequisite" gating. */
  requiresRoundIndex?: number | null;
  /** "registered" | "paid" | "completed" — how the prerequisite must be met. */
  gatingRule?: string | null;
  /** Operator visibility toggle — false = hidden from students. Default true. */
  isActive?: boolean | null;
  /**
   * For age-grouped competitions (Komodo): the date the student's age is
   * measured against to pick a creature/bracket. Per-round so the bracket
   * can shift across rounds. ISO 'YYYY-MM-DD'. Null for grade-based comps.
   */
  ageCutoffDate?: string | null;
  /**
   * Long-form round details rendered in the student rounds list. Optional —
   * a null value renders no description paragraph.
   */
  description?: string | null;
}

/**
 * Replace a competition's rounds wholesale, inside the caller's transaction.
 * Two-pass so a round's gating prerequisite — referenced by ordinal in
 * `requiresRoundIndex` — can point at any sibling regardless of insert order.
 */
export async function replaceRounds(
  client: PoolClient,
  compId: string,
  rounds: RoundInput[] | undefined | null,
): Promise<void> {
  await client.query("DELETE FROM competition_rounds WHERE comp_id = $1", [compId]);
  if (!Array.isArray(rounds) || rounds.length === 0) return;

  // Pass 1 — insert every round, no prerequisite wired yet.
  const ids: string[] = [];
  for (let i = 0; i < rounds.length; i++) {
    const r = rounds[i];
    const roundType = VALID_ROUND_TYPES.includes(String(r.roundType))
      ? r.roundType
      : "Online";
    const category = VALID_CATEGORIES.includes(String(r.roundCategory))
      ? r.roundCategory
      : "online";
    const examMode = VALID_EXAM_MODES.includes(String(r.examMode))
      ? r.examMode
      : "online";
    // open / qualified / unqualified gating is self-contained; prerequisite is
    // wired in pass 2, once every round has an id.
    const initialGating =
      r.gatingMode === "qualified"
        ? { mode: "qualified" }
        : r.gatingMode === "unqualified"
          ? { mode: "unqualified" }
          : { mode: "open" };
    const inserted = await client.query(
      `INSERT INTO competition_rounds (
         comp_id, round_name, round_type, start_date,
         registration_deadline, exam_date, results_date,
         fee, fee_international, location, round_order, required_docs, gating,
         round_category, country, exam_mode, qualifying_score, is_active,
         age_cutoff_date, description
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
       RETURNING id`,
      [
        compId,
        r.roundName || `Round ${i + 1}`,
        roundType,
        r.startDate || null,
        r.registrationDeadline || null,
        r.examDate || null,
        r.resultsDate || null,
        r.fee || 0,
        // NUMERIC accepts null; the column means "no international price".
        r.feeInternational != null && Number.isFinite(Number(r.feeInternational))
          ? Number(r.feeInternational)
          : null,
        r.location || null,
        i + 1,
        JSON.stringify(Array.isArray(r.requiredDocs) ? r.requiredDocs : []),
        JSON.stringify(initialGating),
        category,
        r.country || null,
        examMode,
        r.qualifyingScore ?? null,
        r.isActive !== false,
        r.ageCutoffDate || null,
        r.description || null,
      ],
    );
    ids.push(inserted.rows[0].id as string);
  }

  // Pass 2 — wire prerequisite gating now that every round has an id.
  for (let i = 0; i < rounds.length; i++) {
    const r = rounds[i];
    if (r.gatingMode !== "prerequisite") continue;
    const idx = r.requiresRoundIndex;
    if (idx == null || idx < 0 || idx >= ids.length || idx === i) continue;
    const rule = VALID_RULES.includes(String(r.gatingRule)) ? r.gatingRule : "completed";
    const requiresRoundId = ids[idx];
    await client.query(
      `UPDATE competition_rounds SET requires_round_id = $1, gating = $2 WHERE id = $3`,
      [
        requiresRoundId,
        JSON.stringify({ mode: "prerequisite", requiresRoundId, rule }),
        ids[i],
      ],
    );
  }
}
