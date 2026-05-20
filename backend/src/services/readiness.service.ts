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

// Field-key vocabulary used by competitions.required_profile_fields and by
// computeMissingProfileFields. Keys mirror the JSON keys returned by
// GET /api/users/me so the web Profile Completion Dialog can map them 1:1 to
// form inputs.
export type ProfileFieldKey =
  | "fullName"
  | "email"
  | "phone"
  | "city"
  | "country"
  | "dateOfBirth"
  | "supervisorName"
  | "supervisorEmail"
  | "supervisorWhatsapp"
  | "supervisorPhone"
  | "schoolName"
  | "schoolEmail"
  | "schoolAddress"
  | "schoolWhatsapp"
  | "schoolPhone"
  | "parentName"
  | "parentWhatsapp"
  | "parentPhone"
  | "grade"
  | "nisn"
  | "npsn";

interface ProfileRow {
  full_name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  country: string | null;
  date_of_birth: string | Date | null;
  supervisor_name: string | null;
  supervisor_email: string | null;
  supervisor_whatsapp: string | null;
  supervisor_phone: string | null;
  school_name: string | null;
  school_email: string | null;
  school_address: string | null;
  school_whatsapp: string | null;
  school_phone: string | null;
  parent_name: string | null;
  parent_whatsapp: string | null;
  parent_phone: string | null;
  grade: string | null;
  nisn: string | null;
  npsn: string | null;
  school_id: string | null;
}

// True when the column value is present + non-empty. Trims strings; treats DATE
// columns (which come back as Date objects from node-pg) as present whenever
// they are non-null.
function isFilled(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (v instanceof Date) return true;
  if (typeof v === "string") return v.trim().length > 0;
  return true;
}

// Map a field key to the corresponding column on the joined users + students
// row. Returns the array of values that must ALL be filled for the field to
// count (e.g. `schoolName` is satisfied by either school_name OR school_id).
function valuesFor(key: ProfileFieldKey, p: ProfileRow): unknown[] {
  switch (key) {
    case "fullName":          return [p.full_name];
    case "email":             return [p.email];
    case "phone":             return [p.phone];
    case "city":              return [p.city];
    case "country":           return [p.country];
    case "dateOfBirth":       return [p.date_of_birth];
    case "supervisorName":    return [p.supervisor_name];
    case "supervisorEmail":   return [p.supervisor_email];
    case "supervisorWhatsapp":return [p.supervisor_whatsapp];
    case "supervisorPhone":   return [p.supervisor_phone];
    // School name OR a linked school_id satisfies the schoolName field.
    case "schoolName":        return [p.school_name || p.school_id];
    case "schoolEmail":       return [p.school_email];
    case "schoolAddress":     return [p.school_address];
    case "schoolWhatsapp":    return [p.school_whatsapp];
    case "schoolPhone":       return [p.school_phone];
    case "parentName":        return [p.parent_name];
    case "parentWhatsapp":    return [p.parent_whatsapp];
    case "parentPhone":       return [p.parent_phone];
    case "grade":             return [p.grade];
    case "nisn":              return [p.nisn];
    case "npsn":              return [p.npsn];
  }
}

/**
 * Returns the subset of `requiredKeys` that the user has NOT filled in. The
 * single source of truth for both `computeCompleteness` (when a registration
 * already exists) and the pre-payment gate on POST /registrations (when it
 * doesn't yet). Empty list ⇒ the student is ready to register.
 */
export async function computeMissingProfileFields(
  userId: string,
  requiredKeys: ProfileFieldKey[]
): Promise<ProfileFieldKey[]> {
  if (requiredKeys.length === 0) return [];

  const result = await pool.query<ProfileRow>(
    `SELECT u.full_name, u.email, u.phone, u.city, u.country,
            s.date_of_birth, s.supervisor_name, s.supervisor_email,
            s.supervisor_whatsapp, s.supervisor_phone,
            s.school_name, s.school_email, s.school_address,
            s.school_whatsapp, s.school_phone,
            s.parent_name, s.parent_whatsapp, s.parent_phone,
            s.grade, s.nisn, s.npsn, s.school_id
       FROM users u
       LEFT JOIN students s ON s.id = u.id
      WHERE u.id = $1 AND u.deleted_at IS NULL`,
    [userId]
  );

  if (result.rows.length === 0) return requiredKeys;
  const row = result.rows[0];

  return requiredKeys.filter((key) => !valuesFor(key, row).every(isFilled));
}

/**
 * The required field list for a competition — empty array when none configured.
 * Used by the POST /registrations pre-payment gate and by the per-registration
 * completeness check. Filters to known keys defensively in case the JSONB
 * carries an unknown string from operator input.
 */
export async function getRequiredProfileFields(
  compId: string
): Promise<ProfileFieldKey[]> {
  const result = await pool.query(
    "SELECT required_profile_fields FROM competitions WHERE id = $1",
    [compId]
  );
  if (result.rows.length === 0) return [];
  const raw = result.rows[0].required_profile_fields;
  if (!Array.isArray(raw)) return [];
  const known = new Set<ProfileFieldKey>([
    "fullName","email","phone","city","country","dateOfBirth",
    "supervisorName","supervisorEmail","supervisorWhatsapp","supervisorPhone",
    "schoolName","schoolEmail","schoolAddress","schoolWhatsapp","schoolPhone",
    "parentName","parentWhatsapp","parentPhone",
    "grade","nisn","npsn",
  ]);
  return raw.filter((k): k is ProfileFieldKey => typeof k === "string" && known.has(k as ProfileFieldKey));
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
            c.fee, c.required_docs, c.required_profile_fields,
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

  // 1. Profile completeness — generic baseline + per-competition extras.
  //    The baseline keeps the historic behaviour (every student needs name,
  //    phone, city, grade, school) so existing competitions don't suddenly
  //    look incomplete. Per-competition extras (Komodo) layer on top.
  const baseline: string[] = [];
  if (!row.full_name?.trim()) baseline.push("fullName");
  if (!row.phone?.trim())     baseline.push("phone");
  if (!row.city?.trim())      baseline.push("city");
  if (row.grade !== undefined) {
    if (!row.grade) baseline.push("grade");
    if (!row.school_name?.trim() && !row.school_id) baseline.push("schoolName");
  }
  // Per-competition required fields layer on top, deduped with the baseline.
  const required: ProfileFieldKey[] = Array.isArray(row.required_profile_fields)
    ? (row.required_profile_fields as ProfileFieldKey[])
    : [];
  const extras = required.length > 0
    ? await computeMissingProfileFields(row.user_id, required)
    : [];
  const allMissing = Array.from(new Set([...baseline, ...extras]));
  const profileComplete = { ok: allMissing.length === 0, missing: allMissing };

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
