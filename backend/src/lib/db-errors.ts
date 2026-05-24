/**
 * Map a node-pg error to an HTTP-shaped response. Returns `null` when the
 * error isn't a recognised Postgres constraint/format violation, so callers
 * can fall through to their generic 500.
 *
 * PG error codes:
 *   23505 — unique violation        → 409 Conflict
 *   23503 — foreign key violation   → 400 Bad Request (referenced row gone)
 *   23502 — not-null violation      → 400 Bad Request (required field missing)
 *   23514 — check constraint        → 400 Bad Request
 *   22001 — string too long         → 400 Bad Request
 *   22P02 — invalid text format     → 400 Bad Request (e.g. bad UUID)
 *   42703 — undefined column        → 500 (real server bug, schema drift)
 *
 * Callers may pass `constraints` to provide friendlier messages for known
 * named unique indexes:
 *   dbErrorResponse(err, { 'users_email_key': 'Email is already registered' })
 */
export function dbErrorResponse(
  err: unknown,
  constraints?: Record<string, string>,
): { status: number; message: string } | null {
  if (!err || typeof err !== "object") return null;
  const e = err as { code?: unknown; constraint?: unknown; detail?: unknown };
  if (typeof e.code !== "string") return null;

  const constraintName = typeof e.constraint === "string" ? e.constraint : undefined;
  const friendly = constraintName && constraints?.[constraintName];

  switch (e.code) {
    case "23505":
      return {
        status: 409,
        message: friendly || "A record with these values already exists.",
      };
    case "23503":
      return { status: 400, message: "Referenced record does not exist." };
    case "23502":
      return { status: 400, message: "Required field is missing." };
    case "23514":
      return { status: 400, message: "Value violates a constraint." };
    case "22001":
      return { status: 400, message: "Value is too long." };
    case "22P02":
      return { status: 400, message: "Value has an invalid format." };
    default:
      return null;
  }
}
