import type { Pool, PoolClient } from "pg";

/** Either the shared pool or a transaction client — both expose `.query`. */
type Db = Pick<Pool, "query"> | Pick<PoolClient, "query">;

/**
 * Upsert a school into the directory from a student-provided NPSN + name.
 *
 * Students pick a school by NPSN at signup; without this the choice only ever
 * lived on the `students` row and never reached the admin Schools directory.
 * NPSN is the unique key on `schools`, so re-running is safe
 * (`ON CONFLICT DO NOTHING`). No-ops when the NPSN or name is missing.
 *
 * Returns the school's id (whether newly inserted or already present), or null.
 */
export async function upsertSchoolFromNpsn(
  db: Db,
  npsn: string | null | undefined,
  name: string | null | undefined,
  address?: string | null,
): Promise<string | null> {
  const cleanNpsn = (npsn ?? "").trim();
  // Some legacy rows prefix the NPSN into the name ("20206227 - SMAN 1 …").
  const cleanName = (name ?? "").replace(/^\s*\d+\s*-\s*/, "").trim();
  if (!cleanNpsn || !cleanName) return null;

  const inserted = await db.query(
    `INSERT INTO schools (npsn, name, address)
     VALUES ($1, $2, $3)
     ON CONFLICT (npsn) DO NOTHING
     RETURNING id`,
    [cleanNpsn, cleanName, (address ?? "").trim() || null],
  );
  if (inserted.rows[0]) return inserted.rows[0].id as string;

  const existing = await db.query("SELECT id FROM schools WHERE npsn = $1", [cleanNpsn]);
  return existing.rows[0]?.id ?? null;
}
