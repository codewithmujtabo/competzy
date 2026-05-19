-- Migration: competition-rounds-gating (multi-round Phase 2)
-- Multi-round competitions: each `competition_rounds` row gains a configurable
-- round-to-round gating rule + per-round required documents, and `exams` gains
-- a `round_id` so an exam can belong to a specific round.
--
--   requires_round_id — the prerequisite round (self-FK, NULL = none).
--   gating            — the rule, JSONB. NULL or {"mode":"open"} = open entry;
--                       {"mode":"prerequisite","requiresRoundId":"<id>",
--                        "rule":"registered|paid|completed"} = gated.
--   required_docs     — JSONB string array of per-round document requirements.
--   exams.round_id    — the round an exam belongs to (NULL = whole competition).

ALTER TABLE competition_rounds
  ADD COLUMN IF NOT EXISTS requires_round_id TEXT
    REFERENCES competition_rounds(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS gating JSONB,
  ADD COLUMN IF NOT EXISTS required_docs JSONB NOT NULL DEFAULT '[]';

ALTER TABLE exams
  ADD COLUMN IF NOT EXISTS round_id TEXT
    REFERENCES competition_rounds(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_exams_round_id ON exams(round_id);
CREATE INDEX IF NOT EXISTS idx_competition_rounds_requires
  ON competition_rounds(requires_round_id);
