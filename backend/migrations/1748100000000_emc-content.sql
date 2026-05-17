-- Migration: emc-content (Wave 1 Phase D, 1 of 6)
-- Question-bank schema ported from the legacy eduversal-team/emc Laravel
-- app. Multi-tenant from day one — content tables carry `comp_id` so a
-- single table set serves EMC, ISPO, OSEBI, etc.
--
-- Tiers:
--   T1 strict  — comp_id NOT NULL: subjects, topics, subtopics, questions, answers, proofreads
--   T3 pivot   — no comp_id (derivable from parent): question_topics
--
-- Soft-delete on every non-pivot table matching Sprint 14 pattern
-- (1747000000000_soft-delete.sql). Each gets a partial "live" index on
-- the hottest filter column where deleted_at IS NULL.

-- ── subjects ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subjects (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comp_id     TEXT NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_subjects_comp_name_live
  ON subjects(comp_id, name) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_subjects_comp_id ON subjects(comp_id);

-- ── topics ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS topics (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comp_id     TEXT NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  subject_id  UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_topics_subject_id ON topics(subject_id);
CREATE INDEX IF NOT EXISTS idx_topics_comp_id    ON topics(comp_id);
CREATE INDEX IF NOT EXISTS idx_topics_live       ON topics(subject_id) WHERE deleted_at IS NULL;

-- ── subtopics ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subtopics (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comp_id     TEXT NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  topic_id    UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_subtopics_topic_id ON subtopics(topic_id);
CREATE INDEX IF NOT EXISTS idx_subtopics_comp_id  ON subtopics(comp_id);
CREATE INDEX IF NOT EXISTS idx_subtopics_live     ON subtopics(topic_id) WHERE deleted_at IS NULL;

-- ── questions ─────────────────────────────────────────────────────────────
-- Multi-language content/content2..6 inline matches the legacy Laravel
-- schema 1:1 so Wave-9 import can map straight across. `grades` is JSONB
-- (legacy used TEXT-encoded JSON).
CREATE TABLE IF NOT EXISTS questions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comp_id      TEXT NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  code         TEXT NOT NULL,
  writer_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  approver_id  UUID REFERENCES users(id) ON DELETE SET NULL,
  level        TEXT,
  grades       JSONB,
  type         TEXT,
  cognitive    TEXT,
  approved_at  TIMESTAMPTZ,
  content      TEXT,
  content2     TEXT,
  content3     TEXT,
  content4     TEXT,
  content5     TEXT,
  content6     TEXT,
  explanation  TEXT,
  status       TEXT,
  is_bonus     BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at   TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_questions_comp_code_live
  ON questions(comp_id, code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_questions_comp_id     ON questions(comp_id);
CREATE INDEX IF NOT EXISTS idx_questions_writer_id   ON questions(writer_id);
CREATE INDEX IF NOT EXISTS idx_questions_approver_id ON questions(approver_id);
CREATE INDEX IF NOT EXISTS idx_questions_status_live
  ON questions(status) WHERE deleted_at IS NULL;

-- ── answers ───────────────────────────────────────────────────────────────
-- comp_id duplicated from the parent question for fast comp-scoped queries
-- without a join. Backfill on insert in the service layer.
CREATE TABLE IF NOT EXISTS answers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comp_id     TEXT NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  content     TEXT,
  content2    TEXT,
  content3    TEXT,
  is_correct  BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_answers_question_id ON answers(question_id);
CREATE INDEX IF NOT EXISTS idx_answers_comp_id     ON answers(comp_id);
CREATE INDEX IF NOT EXISTS idx_answers_live        ON answers(question_id) WHERE deleted_at IS NULL;

-- ── question_topics (T3 pivot — no comp_id, derivable from question) ─────
CREATE TABLE IF NOT EXISTS question_topics (
  id           BIGSERIAL PRIMARY KEY,
  question_id  UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  topic_id     UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  subtopic_id  UUID REFERENCES subtopics(id) ON DELETE SET NULL,
  UNIQUE (question_id, topic_id)
);
CREATE INDEX IF NOT EXISTS idx_question_topics_topic_id    ON question_topics(topic_id);
CREATE INDEX IF NOT EXISTS idx_question_topics_subtopic_id ON question_topics(subtopic_id);

-- ── proofreads ────────────────────────────────────────────────────────────
-- Editorial state machine for question review. Multiple proofreads per
-- question are allowed (one per reviewer pass).
CREATE TABLE IF NOT EXISTS proofreads (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comp_id       TEXT NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  question_id   UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  level         TEXT,
  cognitive     TEXT,
  answer_id     UUID REFERENCES answers(id) ON DELETE SET NULL,
  short_answer  TEXT,
  explanation   TEXT,
  comment       TEXT,
  done_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_proofreads_comp_id     ON proofreads(comp_id);
CREATE INDEX IF NOT EXISTS idx_proofreads_question_id ON proofreads(question_id);
CREATE INDEX IF NOT EXISTS idx_proofreads_user_id     ON proofreads(user_id);
CREATE INDEX IF NOT EXISTS idx_proofreads_live
  ON proofreads(question_id) WHERE deleted_at IS NULL;
