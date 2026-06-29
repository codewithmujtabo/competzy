-- Standardize competitions.registration_status onto the three canonical values
-- used by the admin + organizer edit forms and rendered on the student catalog:
--   'Coming Soon' · 'Registration Opened' · 'Registration Closed'
--
-- The column was created (migration 1745200000000) with a CHECK constraint
-- allowing only 'On Going' / 'Closed' / 'Coming Soon'. We widen it to the new
-- canonical set and normalize legacy / inconsistent values accumulated from the
-- old organizer options, the publish/close shortcuts ('Open'/'Closed'), a
-- 'Draft' state, and NULLs left by the admin-edit wipe bug. Idempotent.

-- 1. Drop the old constraint so the data can be rewritten.
ALTER TABLE competitions DROP CONSTRAINT IF EXISTS competitions_registration_status_check;

-- 2. Normalize every existing value to one of the three canonical values.
UPDATE competitions
   SET registration_status = 'Registration Opened'
 WHERE registration_status IN ('Open', 'On Going', 'Ongoing', 'On-going', 'open');

UPDATE competitions
   SET registration_status = 'Registration Closed'
 WHERE registration_status IN ('Closed', 'closed');

UPDATE competitions
   SET registration_status = 'Coming Soon'
 WHERE registration_status IS NULL
    OR btrim(registration_status) = ''
    OR registration_status IN ('Draft', 'draft', 'Coming soon', 'coming soon');

-- 3. Re-add the CHECK with the new canonical set (NULL still allowed, matching
--    the original column semantics; new rows default to 'Coming Soon' in code).
ALTER TABLE competitions
  ADD CONSTRAINT competitions_registration_status_check
  CHECK (registration_status IN ('Coming Soon', 'Registration Opened', 'Registration Closed'));
