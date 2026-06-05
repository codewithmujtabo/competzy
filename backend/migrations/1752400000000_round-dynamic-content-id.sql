-- Phase 4 — dynamic-content i18n, rounds slice. Mirrors
-- 1752300000000_dynamic-content-id.sql (which covered competition_flows): the
-- existing column stays the English/canonical source, the `*_id` column holds
-- the optional Bahasa Indonesia translation. At render time the client picks the
-- `*_id` value when the locale is ID and it's non-empty, else falls back to the
-- canonical column (see web/lib/i18n/pick-text.ts).
--
-- competition_rounds carries the multi-round names students read on the
-- dashboard (the mockup's "Babak Kompetisi" — e.g. "Online Round 1",
-- "Local Round — Malaysia") plus an optional long-form description. Both get a
-- nullable Indonesian companion column; every existing row renders exactly as
-- before until a translation is authored.

ALTER TABLE competition_rounds
  ADD COLUMN IF NOT EXISTS round_name_id  TEXT,
  ADD COLUMN IF NOT EXISTS description_id TEXT;
