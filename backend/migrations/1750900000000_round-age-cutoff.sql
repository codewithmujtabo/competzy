-- Migration: per-round age cutoff date
--
-- Komodo (and any future age-grouped competition) classifies students into
-- creatures by their age **as of a per-round cutoff date**, not by grade.
-- Round 1's cutoff for the 2026/2027 season is 19/09/2026; later rounds get
-- their own cutoff so a student's bracket can shift across rounds as they
-- have a birthday in between.
--
-- The column is nullable: non-Komodo competitions ignore it. The Komodo seed
-- (npm run db:seed:komodo) doesn't set it — we backfill Round 1 here and let
-- an operator fill the later rounds via the admin / organizer UI.

ALTER TABLE competition_rounds
  ADD COLUMN IF NOT EXISTS age_cutoff_date DATE;

-- Backfill Komodo Round 1 → 2026-09-19. Idempotent.
UPDATE competition_rounds AS cr
   SET age_cutoff_date = DATE '2026-09-19'
  FROM competitions AS c
 WHERE cr.comp_id = c.id
   AND c.slug = 'komodo'
   AND cr.round_order = 1
   AND cr.age_cutoff_date IS NULL;
