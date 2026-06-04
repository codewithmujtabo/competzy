-- Phase 4 — dynamic-content i18n. The web app is bilingual (EN/ID), but
-- operator-AUTHORED text (flow-step titles/descriptions, locations) lived in a
-- single column and always rendered as typed. Add parallel Indonesian columns:
-- the existing column stays the English/canonical source, the `*_id` column
-- holds the Bahasa Indonesia translation. At render time the client picks the
-- `*_id` value when the locale is ID and it's non-empty, else falls back to the
-- canonical column (see web/lib/i18n/pick-text.ts). All nullable — every
-- existing row renders exactly as before until a translation is authored.
--
-- This slice covers competition_flows (the dashboard "Rangkaian Kegiatan"
-- timeline — the most visible operator-authored content). Rounds, competition
-- descriptions, announcements + materials follow the same `*_id` pattern.

ALTER TABLE competition_flows
  ADD COLUMN IF NOT EXISTS title_id       TEXT,
  ADD COLUMN IF NOT EXISTS description_id TEXT,
  ADD COLUMN IF NOT EXISTS location_id    TEXT;
