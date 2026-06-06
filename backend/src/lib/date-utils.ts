/**
 * Calendar-date handling for TIMESTAMPTZ columns.
 *
 * Several "date only" fields (competition reg-open/close/event dates, round
 * start/deadline/exam/results dates) come from an `<input type="date">` as a
 * bare `YYYY-MM-DD` string and live in TIMESTAMPTZ columns. Binding the bare
 * string makes Postgres interpret it as MIDNIGHT in the DB session timezone —
 * east of UTC (e.g. Asia/Jakarta, +7) that midnight is the *previous* day in
 * UTC, so the value reads back one day early (the client renders the instant in
 * UTC via `toISOString()`). The symptom: a date saved as 2026-05-04 reloads as
 * 2026-05-03.
 *
 * Fix: store the calendar date at **noon UTC**. Noon UTC stays on the same
 * calendar day for every timezone in [-11, +11], so the day survives the
 * round-trip regardless of server or client timezone — whether the reader uses
 * `toISOString()` (admin edit forms) or `toLocaleDateString()` (the student
 * dashboard).
 */
export function dateOnlyToNoonUtc(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  // Pull the leading YYYY-MM-DD; works for bare dates and full ISO strings.
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return s; // not a date-only / ISO date — leave untouched
  return `${m[1]}-${m[2]}-${m[3]}T12:00:00.000Z`;
}
