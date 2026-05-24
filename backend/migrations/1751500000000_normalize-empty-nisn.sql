-- Migration: normalise empty-string NISN to NULL.
--
-- Background: `idx_students_nisn` is a partial unique index defined as
-- `WHERE nisn IS NOT NULL`, so it treats empty string as a real value.
-- Multiple legacy rows have `nisn = ''` (the old profile editor wrote
-- raw input without coercion), so any subsequent UPDATE that touches
-- those rows trips constraint 23505.
--
-- Code now coerces '' → NULL in `PUT /api/users/me`. This migration
-- cleans the dirty data so the constraint isn't tripped on the next
-- save for any student whose `nisn` is currently ''.
--
-- Idempotent — rows already NULL are untouched. Safe to re-run.

UPDATE students SET nisn = NULL WHERE nisn = '';
