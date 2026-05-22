import { pool } from "../config/database";

/**
 * Whether the caller may manage the question bank / exams of a competition.
 *
 * The competition must be NATIVE — affiliated competitions run on an external
 * platform and have no question bank or exams. Roles:
 *   - admin           — every native competition
 *   - organizer       — only competitions they created
 *   - question_maker  — every native competition (they're a content author,
 *                       not an owner; the per-handler guards in
 *                       question-bank.routes.ts already block them from
 *                       review / approve / send-back / proofread writes)
 *
 * Shared by question-bank.routes.ts and exam.routes.ts.
 */
export async function hasCompAccess(
  userId: string,
  role: string,
  compId: string
): Promise<boolean> {
  const r = await pool.query(
    "SELECT created_by, kind FROM competitions WHERE id = $1",
    [compId]
  );
  if (r.rows.length === 0) return false;
  const { created_by, kind } = r.rows[0];
  if (kind !== "native") return false;
  if (role === "admin" || role === "question_maker") return true;
  if (role === "organizer") return created_by === userId;
  return false;
}
