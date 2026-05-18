-- Migration: registrations-round-id (multi-round Phase 3)
-- Per-round registration — a registration may belong to a specific round.
-- round_id NULL = a whole-competition registration, so every single-round
-- competition (EMC / ISPO / OSEBI) keeps working untouched. One live
-- registration per (user, comp, round) — the partial-unique index blocks a
-- double sign-up for the same round; NULL-round rows are excluded (they keep
-- today's behaviour where re-registering throws the primary-key violation).

ALTER TABLE registrations
  ADD COLUMN IF NOT EXISTS round_id TEXT
    REFERENCES competition_rounds(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_registrations_round_id ON registrations(round_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_registrations_user_comp_round
  ON registrations (user_id, comp_id, round_id)
  WHERE deleted_at IS NULL AND round_id IS NOT NULL;
