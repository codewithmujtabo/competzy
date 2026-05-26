-- Migration: drop arena_settings (and its sole flag `registration_enabled`).
--
-- The flag is being removed because arena.competzy.com keeps registration
-- always open by design — students sign up freely to gain access to the
-- portal. Closing happens per-competition via `competitions.registration_*`
-- columns, not at the platform level.
--
-- The 3-mode `Main Arena Page` toggle in site_maintenance already covers
-- the "pause all auth" case (read-only + on), so the boolean flag had no
-- distinct surviving use case after that conversation.
--
-- Idempotent — IF EXISTS so re-runs and partial migrations are safe.

DROP TABLE IF EXISTS arena_settings;
