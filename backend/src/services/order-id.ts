// Midtrans order_id construction.
//
// The order_id's primary job is to be a unique, idempotent key for a charge —
// NOT an analytics record (that lives in the DB: comp_id, round_id, payer_kind,
// order_items, etc.). We only fold in a short, human-readable competition tag so
// Competzy's transactions are recognisable at a glance in the SHARED Midtrans
// dashboard (this merchant account is also used by the legacy EMC site).

/**
 * Short uppercase tag identifying a competition for the Midtrans dashboard.
 * Derived from the slug's first segment, so both `emc` and the operator-created
 * `emc-mathematics-competition-final-euef7` collapse to `EMC`. Falls back to the
 * competition name, then to `COMP`. Recognition aid only — never parsed back.
 */
export function compTag(slug?: string | null, name?: string | null): string {
  // First slug segment, else first word of the name — so we truncate at a word
  // boundary instead of mid-word ("Owlypia Online" → OWLYPIA, not OWLYPIAO).
  const fromSlug = (slug ?? "").split("-")[0];
  const fromName = (name ?? "").trim().split(/\s+/)[0];
  const base = (fromSlug || fromName || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return base.slice(0, 8) || "COMP";
}

/**
 * Hybrid order_id for a single (personal) registration payment:
 *   CTZ-<TAG>-<ref>-<ts>     e.g. CTZ-EMC-10156-1719765432123
 *
 * - `CTZ-`  namespaces Competzy charges apart from the legacy EMC site sharing
 *           this merchant account (collision-safe).
 * - `<TAG>` makes the competition recognisable in the dashboard.
 * - `<ref>` the registration_number's last segment (e.g. 10156); falls back to
 *           the raw ref when it has no segments.
 * - `<ts>`  guarantees a fresh id per re-payment attempt — Midtrans only frees a
 *           used order_id after expiry, so each attempt needs a distinct one.
 *
 * Capped at Midtrans's 50-char limit. With TAG ≤ 8 + ref ≤ 12 + ts ≈ 13 the
 * result is ~35 chars, so the cap is a safety net, never a real truncation.
 */
export function buildPaymentOrderId(opts: { tag: string; ref: string; ts: number }): string {
  const seg = opts.ref.split("-").pop() || opts.ref;
  const ref = seg.replace(/[^A-Za-z0-9]/g, "").slice(-12) || "0";
  return `CTZ-${opts.tag}-${ref}-${opts.ts}`.slice(0, 50);
}
