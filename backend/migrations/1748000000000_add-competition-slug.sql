-- Migration: add-competition-slug
-- Adds a unique slug column to competitions so per-competition portals
-- (/competitions/[slug]/…) can resolve "the canonical competition row"
-- by a stable string instead of guessing by name.
--
-- Also seeds an EMC 2026 row (de-branded — "Mathematics Competition 2026"
-- per Sprint 20) so dev environments without seeds can still exercise the
-- EMC flow end-to-end. Idempotent: either tags an existing EMC row with
-- slug='emc-2026', or inserts a minimal placeholder.
--
-- NOTE: a follow-up migration `1748010000000_debrand-existing-emc-row.sql`
-- exists for environments that previously applied an Eduversal-branded
-- version of this migration. New environments don't need it (the values
-- inserted here are already de-branded).

ALTER TABLE competitions ADD COLUMN IF NOT EXISTS slug TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS competitions_slug_unique
  ON competitions(slug)
  WHERE slug IS NOT NULL;

WITH existing AS (
  SELECT id FROM competitions
  WHERE (name ILIKE 'Eduversal Mathematics Competition%'
         OR name ILIKE 'Mathematics Competition%'
         OR name ILIKE 'EMC%')
    AND slug IS NULL
  ORDER BY competition_date DESC NULLS LAST, created_at DESC NULLS LAST
  LIMIT 1
),
updated AS (
  UPDATE competitions
     SET slug = 'emc-2026'
   WHERE id IN (SELECT id FROM existing)
  RETURNING id
)
INSERT INTO competitions (id, name, organizer_name, category, grade_level, fee, slug, created_at)
SELECT 'comp_emc_2026_main',
       'Mathematics Competition 2026',
       'EMC Organizer',
       'Mathematics',
       'SD,SMP,SMA',
       0,
       'emc-2026',
       now()
WHERE NOT EXISTS (SELECT 1 FROM updated)
  AND NOT EXISTS (SELECT 1 FROM competitions WHERE slug = 'emc-2026');
