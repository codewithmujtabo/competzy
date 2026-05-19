-- Migration: komodo-round-model (Komodo Wave 2 — Phase A)
-- Komodo's full round model:
--   * round_category — online (a normal timed round), fast_track (a catch-up
--     exam for students not yet qualified), local (a per-country round, online
--     or offline), global (the Bali Grand Final, medal-gated).
--   * qualifying_score — the score at/above which a round attempt earns a medal.
--   * country / exam_mode / representative_user_id — for local rounds.
--   * registrations.score / is_medalist / medalist_locked — the per-round
--     result: the student's score and whether it medaled (auto from score vs
--     the round's qualifying_score; medalist_locked = an operator set it).
--   * the country_representative role + a country_representatives table.

ALTER TABLE competition_rounds
  ADD COLUMN IF NOT EXISTS round_category TEXT NOT NULL DEFAULT 'online'
    CHECK (round_category IN ('online','fast_track','local','global')),
  ADD COLUMN IF NOT EXISTS country TEXT,
  ADD COLUMN IF NOT EXISTS exam_mode TEXT NOT NULL DEFAULT 'online'
    CHECK (exam_mode IN ('online','offline')),
  ADD COLUMN IF NOT EXISTS qualifying_score NUMERIC,
  ADD COLUMN IF NOT EXISTS representative_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE registrations
  ADD COLUMN IF NOT EXISTS score NUMERIC,
  ADD COLUMN IF NOT EXISTS is_medalist BOOLEAN,
  ADD COLUMN IF NOT EXISTS medalist_locked BOOLEAN NOT NULL DEFAULT false;

-- The country-representative role — manages one country's students for a local
-- round (admin-created; mirrors school_admin).
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN (
    'student','parent','teacher','school_admin','admin','organizer',
    'country_representative'
  ));

CREATE TABLE IF NOT EXISTS country_representatives (
  id         UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  comp_id    TEXT REFERENCES competitions(id) ON DELETE CASCADE,
  country    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_competition_rounds_representative
  ON competition_rounds(representative_user_id);
CREATE INDEX IF NOT EXISTS idx_registrations_medalist
  ON registrations(comp_id, user_id) WHERE is_medalist = true AND deleted_at IS NULL;
