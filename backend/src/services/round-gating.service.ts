// Round-to-round gating (multi-round Phase 3). A `competition_rounds` row may
// carry a `gating` rule — {"mode":"open"} (default) or
// {"mode":"prerequisite","requiresRoundId":"<id>","rule":"registered|paid|completed"}.
// `checkRoundGating` decides whether a student may register for a round.

// Both `pool` and a transaction client satisfy this.
type DB = { query: (text: string, params?: unknown[]) => Promise<{ rows: any[] }> };

export interface GatingResult {
  allowed: boolean;
  /** A student-facing explanation when `allowed` is false. */
  reason?: string;
}

// Registration statuses that count as "paid" for the `paid` gating rule.
const PAID_STATUSES = ["paid", "pending_review", "approved", "submitted", "completed"];

/**
 * May `userId` register for round `roundId`? An "open" round (or one with no
 * gating) is always allowed; a "prerequisite" round checks the caller's
 * registration for the required round against the rule.
 */
export async function checkRoundGating(
  db: DB,
  userId: string,
  roundId: string,
): Promise<GatingResult> {
  const r = await db.query(
    `SELECT cr.gating, cr.requires_round_id, cr.comp_id, cr.is_active,
            req.round_name AS prereq_name
       FROM competition_rounds cr
       LEFT JOIN competition_rounds req ON req.id = cr.requires_round_id
      WHERE cr.id = $1`,
    [roundId],
  );
  if (r.rows.length === 0) return { allowed: false, reason: "Round not found." };

  const { gating, requires_round_id, comp_id, prereq_name, is_active } = r.rows[0];

  // Operator visibility toggle — an inactive round is not open to anyone.
  if (is_active === false) {
    return { allowed: false, reason: "This round isn't open for registration yet." };
  }

  const mode: string | undefined = gating?.mode;

  // Global Round — needs a medal anywhere in the competition.
  if (mode === "qualified") {
    return (await hasMedal(db, userId, comp_id))
      ? { allowed: true }
      : {
          allowed: false,
          reason: "You need a qualifying score from a round to enter the Global Round.",
        };
  }
  // Fast Track — open only to students not yet qualified.
  if (mode === "unqualified") {
    return (await hasMedal(db, userId, comp_id))
      ? {
          allowed: false,
          reason:
            "You have already qualified — the Fast Track is for students still without a spot.",
        }
      : { allowed: true };
  }

  if (mode !== "prerequisite" || !requires_round_id) return { allowed: true };

  const rule: string = gating?.rule ?? "completed";
  const label = prereq_name || "the previous round";

  // The caller's most recent live registration for the prerequisite round.
  const reg = await db.query(
    `SELECT status FROM registrations
      WHERE user_id = $1 AND comp_id = $2 AND round_id = $3 AND deleted_at IS NULL
      ORDER BY created_at DESC LIMIT 1`,
    [userId, comp_id, requires_round_id],
  );
  const status: string | undefined = reg.rows[0]?.status;

  if (rule === "registered") {
    return status && status !== "rejected"
      ? { allowed: true }
      : { allowed: false, reason: `You must first register for ${label}.` };
  }

  if (rule === "paid") {
    return status && PAID_STATUSES.includes(status)
      ? { allowed: true }
      : { allowed: false, reason: `You must complete payment for ${label} first.` };
  }

  // rule === "completed" — the registration is marked completed, or the student
  // has a finished exam attempt for that round.
  if (status === "completed") return { allowed: true };
  const finished = await db.query(
    `SELECT 1 FROM sessions s JOIN exams e ON e.id = s.exam_id
      WHERE s.user_id = $1 AND e.round_id = $2
        AND s.finished_at IS NOT NULL AND s.deleted_at IS NULL
      LIMIT 1`,
    [userId, requires_round_id],
  );
  return finished.rows.length > 0
    ? { allowed: true }
    : { allowed: false, reason: `You must complete ${label} first.` };
}

/** Has the student earned a medal in any round of this competition? */
export async function hasMedal(
  db: DB,
  userId: string,
  compId: string,
): Promise<boolean> {
  const r = await db.query(
    `SELECT 1 FROM registrations
      WHERE user_id = $1 AND comp_id = $2 AND is_medalist = true AND deleted_at IS NULL
      LIMIT 1`,
    [userId, compId],
  );
  return r.rows.length > 0;
}

/**
 * After an online exam is submitted, record its score on the student's
 * registration for that exam's round and auto-decide the medal — score vs the
 * round's `qualifying_score`. An operator-locked medal (`medalist_locked`) is
 * left untouched. A no-op for an exam not tied to a round.
 */
export async function applyMedalFromSession(db: DB, sessionId: string): Promise<void> {
  const r = await db.query(
    `SELECT s.user_id, s.comp_id, s.total_point, e.round_id, cr.qualifying_score
       FROM sessions s
       JOIN exams e ON e.id = s.exam_id
       LEFT JOIN competition_rounds cr ON cr.id = e.round_id
      WHERE s.id = $1`,
    [sessionId],
  );
  const row = r.rows[0];
  if (!row || !row.round_id) return; // not a round-scoped exam
  const score = row.total_point != null ? Number(row.total_point) : 0;
  const isMedalist =
    row.qualifying_score != null ? score >= Number(row.qualifying_score) : null;
  await db.query(
    `UPDATE registrations
        SET score = $1,
            is_medalist = CASE WHEN medalist_locked THEN is_medalist ELSE $2 END,
            updated_at = now()
      WHERE user_id = $3 AND comp_id = $4 AND round_id = $5 AND deleted_at IS NULL`,
    [score, isMedalist, row.user_id, row.comp_id, row.round_id],
  );
}
