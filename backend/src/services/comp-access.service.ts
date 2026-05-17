import { pool } from "../config/database";

/**
 * Whether the caller may manage the question bank / exams of a competition.
 *
 * The competition must be NATIVE — affiliated competitions run on an external
 * platform and have no question bank or exams. An admin owns every native
 * competition; an organizer owns only the ones they created.
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
  if (role === "admin") return true;
  if (role === "organizer") return created_by === userId;
  return false;
}
