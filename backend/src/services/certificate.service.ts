// Certificate auto-issue engine (EMC Wave 12).
//
// A Certificate of Participation is auto-issued the first time a student
// finishes a competition exam — an online `sessions` attempt with `finished_at`
// set, or an operator-recorded `paper_exams` row. Issuance is idempotent: one
// live certificate per (competition, student). An operator may later add an
// award label (→ Certificate of Achievement), adjust the score, or revoke it.
//
// `issueCertificateIfEligible` is called inline from the exam-finish handlers;
// `backfillCertificates` (a nightly cron + an on-demand operator button)
// catches anything the inline hooks missed and keeps unlocked scores in sync.

import crypto from "crypto";
import { pool } from "../config/database";

// Accepts both the pool and a transaction client — mirrors exam-grading.service.
type DB = { query: (text: string, params?: unknown[]) => Promise<{ rows: any[] }> };

// Registration statuses that count as a confirmed participant — mirrors the
// `CLEARED` set in exam-session.routes.ts.
const CLEARED = ["registered", "approved", "paid", "completed"];

// Unambiguous base32 alphabet (no I/L/O/0/1) for the public verification code.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** A random, unguessable 20-char verification code — the public capability. */
function makeVerificationCode(): string {
  const bytes = crypto.randomBytes(20);
  let out = "";
  for (let i = 0; i < 20; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

export interface BestAttempt {
  score: number | null;
  grade: string | null;
  sessionId: string | null;
  paperExamId: string | null;
}

/**
 * The student's best finished exam attempt in a competition — the
 * highest-scoring online session and the highest-scoring paper exam, whichever
 * scored higher. Returns null if the student has finished no exam at all.
 */
export async function bestAttempt(
  db: DB,
  compId: string,
  userId: string
): Promise<BestAttempt | null> {
  const online = await db.query(
    `SELECT id, total_point, grade FROM sessions
      WHERE user_id = $1 AND comp_id = $2 AND finished_at IS NOT NULL AND deleted_at IS NULL
      ORDER BY total_point DESC NULLS LAST, finished_at DESC LIMIT 1`,
    [userId, compId]
  );
  const paper = await db.query(
    `SELECT id, total_point, grade FROM paper_exams
      WHERE user_id = $1 AND comp_id = $2 AND deleted_at IS NULL
      ORDER BY total_point DESC NULLS LAST, created_at DESC LIMIT 1`,
    [userId, compId]
  );
  const o = online.rows[0];
  const p = paper.rows[0];
  if (!o && !p) return null;

  const oScore = o && o.total_point != null ? Number(o.total_point) : null;
  const pScore = p && p.total_point != null ? Number(p.total_point) : null;
  const scores = [oScore, pScore].filter((s): s is number => s != null);
  // The grade is taken from the higher-scoring attempt.
  const onlineWins = !!o && (!p || (oScore ?? -Infinity) >= (pScore ?? -Infinity));

  return {
    score: scores.length ? Math.max(...scores) : null,
    grade: (onlineWins ? o?.grade : p?.grade) ?? o?.grade ?? p?.grade ?? null,
    sessionId: o ? o.id : null,
    paperExamId: p ? p.id : null,
  };
}

export interface IssueResult {
  created: boolean;
  certificateId: string | null;
}

/**
 * Auto-issue a Certificate of Participation for a student who has finished an
 * exam in a native competition. Idempotent — a no-op if a live certificate
 * already exists. Safe to call from anywhere (best-effort; the caller should
 * never let a failure here block its own response).
 */
export async function issueCertificateIfEligible(
  db: DB,
  opts: { compId: string; userId: string }
): Promise<IssueResult> {
  const { compId, userId } = opts;

  // Already issued? (the common idempotent path; also avoids burning a number)
  const existing = await db.query(
    `SELECT id FROM certificates
      WHERE comp_id = $1 AND user_id = $2 AND deleted_at IS NULL LIMIT 1`,
    [compId, userId]
  );
  if (existing.rows.length > 0) {
    return { created: false, certificateId: existing.rows[0].id };
  }

  // The competition must exist and be native (affiliated comps have no exams).
  const comp = await db.query(
    `SELECT name FROM competitions WHERE id = $1 AND kind = 'native'`,
    [compId]
  );
  if (comp.rows.length === 0) return { created: false, certificateId: null };

  // The student's most recent cleared, live registration in this competition.
  const reg = await db.query(
    `SELECT id FROM registrations
      WHERE user_id = $1 AND comp_id = $2 AND deleted_at IS NULL AND status = ANY($3)
      ORDER BY created_at DESC LIMIT 1`,
    [userId, compId, CLEARED]
  );
  if (reg.rows.length === 0) return { created: false, certificateId: null };

  // Eligibility — the student must have finished at least one exam.
  const attempt = await bestAttempt(db, compId, userId);
  if (!attempt) return { created: false, certificateId: null };

  const u = await db.query(`SELECT full_name FROM users WHERE id = $1`, [userId]);
  const studentName = (u.rows[0]?.full_name as string) || "Student";
  const grade =
    attempt.grade ??
    (await db.query(`SELECT grade FROM students WHERE id = $1`, [userId])).rows[0]?.grade ??
    null;

  const inserted = await db.query(
    `INSERT INTO certificates
       (comp_id, user_id, registration_id, session_id, paper_exam_id,
        certificate_number, verification_code,
        student_name, competition_name, grade, score)
     VALUES ($1,$2,$3,$4,$5,
        'CTZ-CERT-2026-' || LPAD(nextval('certificate_number_seq')::text, 4, '0'), $6,
        $7,$8,$9,$10)
     ON CONFLICT (comp_id, user_id) WHERE deleted_at IS NULL DO NOTHING
     RETURNING id`,
    [
      compId,
      userId,
      reg.rows[0].id,
      attempt.sessionId,
      attempt.paperExamId,
      makeVerificationCode(),
      studentName,
      comp.rows[0].name,
      grade,
      attempt.score,
    ]
  );
  if (inserted.rows.length > 0) {
    return { created: true, certificateId: inserted.rows[0].id };
  }
  // Lost a race against a concurrent caller — return the row they created.
  const raced = await db.query(
    `SELECT id FROM certificates
      WHERE comp_id = $1 AND user_id = $2 AND deleted_at IS NULL LIMIT 1`,
    [compId, userId]
  );
  return { created: false, certificateId: raced.rows[0]?.id ?? null };
}

/**
 * Issue certificates for every eligible student missing one, and refresh the
 * snapshot score on unlocked, non-revoked certificates. Runs nightly (cron) and
 * on demand from the operator UI. Pass `compId` to scope to one competition.
 */
export async function backfillCertificates(
  compId?: string
): Promise<{ issued: number; refreshed: number }> {
  // Eligible (competition, student) pairs that lack a live certificate.
  const candidates = await pool.query(
    `SELECT DISTINCT r.comp_id, r.user_id
       FROM registrations r
       JOIN competitions c ON c.id = r.comp_id AND c.kind = 'native'
      WHERE r.deleted_at IS NULL
        AND r.status = ANY($1)
        AND ($2::text IS NULL OR r.comp_id = $2)
        AND (
          EXISTS (SELECT 1 FROM sessions s
                   WHERE s.user_id = r.user_id AND s.comp_id = r.comp_id
                     AND s.finished_at IS NOT NULL AND s.deleted_at IS NULL)
          OR EXISTS (SELECT 1 FROM paper_exams pe
                   WHERE pe.user_id = r.user_id AND pe.comp_id = r.comp_id
                     AND pe.deleted_at IS NULL)
        )
        AND NOT EXISTS (SELECT 1 FROM certificates ct
                   WHERE ct.comp_id = r.comp_id AND ct.user_id = r.user_id
                     AND ct.deleted_at IS NULL)`,
    [CLEARED, compId ?? null]
  );
  let issued = 0;
  for (const row of candidates.rows) {
    const r = await issueCertificateIfEligible(pool, {
      compId: row.comp_id,
      userId: row.user_id,
    });
    if (r.created) issued++;
  }

  // Refresh the snapshot score on unlocked, non-revoked, live certificates.
  const live = await pool.query(
    `SELECT id, comp_id, user_id, score FROM certificates
      WHERE deleted_at IS NULL AND revoked_at IS NULL AND score_locked = false
        AND ($1::text IS NULL OR comp_id = $1)`,
    [compId ?? null]
  );
  let refreshed = 0;
  for (const c of live.rows) {
    const attempt = await bestAttempt(pool, c.comp_id, c.user_id);
    if (!attempt || attempt.score == null) continue;
    const current = c.score != null ? Number(c.score) : null;
    if (attempt.score !== current) {
      await pool.query(
        `UPDATE certificates SET score = $1, updated_at = now() WHERE id = $2`,
        [attempt.score, c.id]
      );
      refreshed++;
    }
  }
  return { issued, refreshed };
}
