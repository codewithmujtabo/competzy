-- Migration: forcibly mark Komodo as `is_international = true`.
--
-- Background: `seed-komodo.ts` was extended in 1751300000000's PR to set
-- `is_international = true` via an UPDATE, but the production deploy ran the
-- OLD compiled seed (which only INSERT'ed a fresh row without the flag) on
-- an existing Komodo row created during SPRINT 33. After the new code
-- deployed, the seed wasn't re-run, so `is_international` stayed NULL.
--
-- The catalog filter `WHERE is_international = true` drops Komodo for
-- international students, so `usePortalComp` returns an empty array and the
-- dashboard hangs on "Loading your registration…" forever.
--
-- Idempotent — runs once via the pgmigrations tracker. Safe to ship to any
-- environment; if Komodo is already true, the UPDATE is a no-op.
-- competitions has no updated_at column; just flip the flag.
UPDATE competitions
   SET is_international = true
 WHERE slug = 'komodo' AND (is_international IS NULL OR is_international = false);
