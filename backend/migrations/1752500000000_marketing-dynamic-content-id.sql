-- Phase 4 — dynamic-content i18n, marketing slice. Mirrors
-- 1752300000000 (flows) + 1752400000000 (rounds): the existing column stays the
-- English/canonical source, the `*_id` column holds the optional Bahasa
-- Indonesia translation, and the client picks the `*_id` value when the locale
-- is ID and it's non-empty (see web/lib/i18n/pick-text.ts).
--
-- announcements + materials are operator-authored content students read in the
-- competition portal (the news feed + the study-materials library). Their
-- title + body get nullable Indonesian companion columns; every existing row
-- renders exactly as before until a translation is authored.

ALTER TABLE announcements
  ADD COLUMN IF NOT EXISTS title_id TEXT,
  ADD COLUMN IF NOT EXISTS body_id  TEXT;

ALTER TABLE materials
  ADD COLUMN IF NOT EXISTS title_id TEXT,
  ADD COLUMN IF NOT EXISTS body_id  TEXT;
