import { pool } from "../config/database";

// Per-requirement registration readiness (Spec F-ID-07). Extracted from the
// GET /registrations/:id/completeness route handler so both that endpoint and
// the step-flow GET /registrations/:id/flow-progress endpoint evaluate against
// one source of truth.

export interface CompletenessChecks {
  profileComplete:   { ok: boolean; missing: string[] };
  documentsUploaded: { ok: boolean; required: string[]; missing: string[] };
  paymentPaid:       { ok: boolean; status: string; fee: number };
  schoolNpsnSet:     { ok: boolean; required: boolean };
  parentLinked:      { ok: boolean; required: boolean };
}

export interface CompletenessResult {
  registrationId: string;
  userId: string;
  compId: string;
  status: string;
  isReady: boolean;
  checks: CompletenessChecks;
}

/**
 * Computes per-requirement readiness for a registration. Returns null when the
 * registration does not exist or is soft-deleted. The caller is responsible
 * for the ownership/role check before exposing the result.
 */
export async function computeCompleteness(
  registrationId: string
): Promise<CompletenessResult | null> {
  const reg = await pool.query(
    `SELECT r.id, r.user_id, r.comp_id, r.status,
            c.fee, c.required_docs,
            u.full_name, u.phone, u.city,
            s.grade, s.school_name, s.npsn, s.school_id
       FROM registrations r
       JOIN competitions  c ON c.id = r.comp_id
       JOIN users         u ON u.id = r.user_id
  LEFT JOIN students      s ON s.id = r.user_id
      WHERE r.id = $1 AND r.deleted_at IS NULL`,
    [registrationId]
  );

  if (reg.rows.length === 0) return null;
  const row = reg.rows[0];

  // 1. Profile completeness — required for all roles.
  const profileMissing: string[] = [];
  if (!row.full_name?.trim()) profileMissing.push("full_name");
  if (!row.phone?.trim())     profileMissing.push("phone");
  if (!row.city?.trim())      profileMissing.push("city");
  // Student-specific fields (the students row only exists for students).
  if (row.grade !== undefined) {
    if (!row.grade) profileMissing.push("grade");
    if (!row.school_name?.trim() && !row.school_id) profileMissing.push("school");
  }
  const profileComplete = { ok: profileMissing.length === 0, missing: profileMissing };

  // 2. Required documents uploaded (per competition.required_docs[]).
  const requiredDocs: string[] = Array.isArray(row.required_docs) ? row.required_docs : [];
  let documentsUploaded: { ok: boolean; required: string[]; missing: string[] };
  if (requiredDocs.length === 0) {
    documentsUploaded = { ok: true, required: [], missing: [] };
  } else {
    const docs = await pool.query(
      `SELECT DISTINCT doc_type FROM documents
        WHERE user_id = $1 AND deleted_at IS NULL AND doc_type = ANY($2)`,
      [row.user_id, requiredDocs]
    );
    const uploaded = new Set(docs.rows.map((d) => d.doc_type));
    const missing = requiredDocs.filter((d) => !uploaded.has(d));
    documentsUploaded = { ok: missing.length === 0, required: requiredDocs, missing };
  }

  // 3. Payment status — either paid, or the competition is free.
  const isFree = !row.fee || Number(row.fee) === 0;
  const paymentOk = isFree || ["paid", "approved", "registered"].includes(row.status);
  const paymentPaid = { ok: paymentOk, status: row.status, fee: Number(row.fee ?? 0) };

  // 4. School NPSN set (only meaningful for students; advisory, not blocking).
  const schoolNpsnSet =
    row.grade === undefined
      ? { ok: true, required: false }
      : { ok: !!row.npsn, required: false };

  // 5. Parent linked (advisory; not blocking).
  const parentLink = await pool.query(
    `SELECT 1 FROM parent_student_links
      WHERE student_id = $1 AND status = 'active'
      LIMIT 1`,
    [row.user_id]
  );
  const parentLinked = { ok: parentLink.rows.length > 0, required: false };

  const isReady = profileComplete.ok && documentsUploaded.ok && paymentPaid.ok;

  return {
    registrationId: row.id,
    userId: row.user_id,
    compId: row.comp_id,
    status: row.status,
    isReady,
    checks: { profileComplete, documentsUploaded, paymentPaid, schoolNpsnSet, parentLinked },
  };
}
