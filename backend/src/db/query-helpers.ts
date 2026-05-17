import { pool } from "../config/database";

/**
 * Soft-delete + multi-tenancy query helpers.
 *
 * Soft-delete: tables in this app have a nullable `deleted_at TIMESTAMPTZ` column
 * (Sprint 14 migration 1747000000000_soft-delete.sql; EMC-port tables since
 * Wave 1). Any query that returns "live" rows must filter on it.
 *
 * Multi-tenancy: EMC-port content/state tables carry a `comp_id TEXT` column
 * tying them to a competition (Wave 1 Phase D). Comp-scoped queries must filter
 * on it — use `compFilter`.
 *
 * Usage in raw SQL:
 *   SELECT * FROM questions q
 *    WHERE ${compFilter("q")} AND ${liveFilter("q")}
 *   -- bind: [compId]
 */

/**
 * Returns a SQL fragment to filter out soft-deleted rows.
 * Pass the table alias if the query uses one.
 *
 *   liveFilter()        -> "deleted_at IS NULL"
 *   liveFilter("users") -> "users.deleted_at IS NULL"
 *   liveFilter("u")     -> "u.deleted_at IS NULL"
 */
export function liveFilter(tableOrAlias?: string): string {
  return tableOrAlias ? `${tableOrAlias}.deleted_at IS NULL` : `deleted_at IS NULL`;
}

/**
 * Returns a parameterised SQL fragment scoping a query to one competition.
 * Mirrors `liveFilter`; because `comp_id` is a bound value (never inlined),
 * the caller supplies it in the params array at `paramIndex` (1-based).
 *
 *   compFilter("q")     -> "q.comp_id = $1"     (default: comp_id is the first param)
 *   compFilter("q", 2)  -> "q.comp_id = $2"     (comp_id is the second param)
 *   compFilter()        -> "comp_id = $1"
 *
 *   pool.query(
 *     `SELECT * FROM subjects s WHERE ${compFilter("s")} AND ${liveFilter("s")}`,
 *     [compId],
 *   );
 */
export function compFilter(tableOrAlias?: string, paramIndex: number = 1): string {
  const col = tableOrAlias ? `${tableOrAlias}.comp_id` : "comp_id";
  return `${col} = $${paramIndex}`;
}

/**
 * Tables that carry a `deleted_at` column and may be soft-deleted / restored.
 * A whitelist guard — never accept a table name from user input.
 */
const SOFT_DELETE_TABLES = new Set([
  // Sprint 14 PII tables (1747000000000_soft-delete.sql)
  "users",
  "students",
  "parents",
  "teachers",
  "registrations",
  "payments",
  "documents",
  "historical_participants",
  "notifications",
  // EMC-port question-bank tables (1748100000000_emc-content.sql)
  "subjects",
  "topics",
  "subtopics",
  "questions",
  "answers",
  "proofreads",
  // EMC-port step-flow (1749000000000_competition-flows.sql)
  "competition_flows",
  // Affiliated-competition credentials (1749100000000_affiliated-competitions.sql)
  "affiliated_credentials",
  // EMC-port exam delivery (1748300000000_emc-exam-delivery.sql)
  "exams",
  "sessions",
  "periods",
  "paper_exams",
  "paper_answers",
  // EMC-port venues (1748200000000_emc-venues.sql)
  "areas",
  "test_centers",
  // EMC-port webcam proctoring (1748300000000_emc-exam-delivery.sql)
  "webcams",
]);

/**
 * Soft-delete a row by id. Returns true if a row was updated, false otherwise.
 * Idempotent: re-soft-deleting a row keeps the original deleted_at timestamp.
 */
export async function softDelete(table: string, id: string, idColumn: string = "id"): Promise<boolean> {
  if (!SOFT_DELETE_TABLES.has(table)) {
    throw new Error(`softDelete: refusing to operate on non-allowlisted table '${table}'`);
  }
  if (!/^[a-z_][a-z0-9_]*$/i.test(idColumn)) {
    throw new Error(`softDelete: invalid id column '${idColumn}'`);
  }

  const result = await pool.query(
    `UPDATE ${table} SET deleted_at = now() WHERE ${idColumn} = $1 AND deleted_at IS NULL`,
    [id]
  );
  return (result.rowCount ?? 0) > 0;
}

/**
 * Restore a soft-deleted row. Useful for "oops" recovery flows.
 */
export async function restore(table: string, id: string, idColumn: string = "id"): Promise<boolean> {
  if (!SOFT_DELETE_TABLES.has(table)) {
    throw new Error(`restore: refusing to operate on non-allowlisted table '${table}'`);
  }
  if (!/^[a-z_][a-z0-9_]*$/i.test(idColumn)) {
    throw new Error(`restore: invalid id column '${idColumn}'`);
  }

  const result = await pool.query(
    `UPDATE ${table} SET deleted_at = NULL WHERE ${idColumn} = $1 AND deleted_at IS NOT NULL`,
    [id]
  );
  return (result.rowCount ?? 0) > 0;
}
