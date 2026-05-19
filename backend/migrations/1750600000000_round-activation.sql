-- Migration: round-activation (multi-round — operator round visibility toggle)
-- A competition round gains an `is_active` flag the admin/organizer controls.
-- An inactive round is hidden from students (the rounds panel filters it out)
-- and registration for it is rejected — so an operator can stage a round:
--   * Fast Track stays off while the online rounds are still open, then on.
--   * the Global Round stays off until every earlier round has finished.
-- New rounds default to active; existing fast-track / global rounds are
-- backfilled to inactive so they no longer show until an operator turns them on.

ALTER TABLE competition_rounds
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

UPDATE competition_rounds
   SET is_active = false
 WHERE round_category IN ('fast_track', 'global');
