-- Migration: debrand-existing-emc-row
-- One-off rename of any locally-seeded EMC competition row that landed in
-- the database with Eduversal-branded values before Sprint 20 de-brand.
-- New environments (which got the de-branded values from `1748000000000`)
-- will see this as a no-op — the WHERE clauses match zero rows.
--
-- Per Sprint 20: platform brand is "Competzy" only; competition names use
-- the local name minus the org prefix; seed organizer_name is generic.

-- Broad LIKE match catches both 'Eduversal Mathematics Competition' (no year)
-- and 'Eduversal Mathematics Competition 2026' variants that have appeared in
-- different seed scripts over time.
UPDATE competitions
   SET name = 'Mathematics Competition 2026'
 WHERE slug = 'emc-2026'
   AND name LIKE 'Eduversal Mathematics Competition%';

UPDATE competitions
   SET organizer_name = 'EMC Organizer'
 WHERE slug = 'emc-2026'
   AND organizer_name IN ('Eduversal', 'Eduversal Foundation');
