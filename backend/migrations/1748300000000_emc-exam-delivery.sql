-- Migration: emc-exam-delivery (Wave 1 Phase D, 3 of 6)
-- Online + paper exam delivery: exams blueprint, the M:M to questions,
-- per-user session state for online attempts (sessions/periods), and the
-- parallel offline path (paper_exams/paper_answers/answer_keys) for
-- pencil-and-paper takers. Webcams are proctor snapshots from the
-- browser webcam during online sessions.
--
-- Tiers:
--   T1 strict — exams, sessions, periods, answer_keys, paper_exams,
--               paper_answers, webcams
--   T3 pivot  — exam_question (comp_id derivable from exam)

-- ── exams ─────────────────────────────────────────────────────────────────
-- Multi-language `choice_count` / `short_count` / `correct_score` /
-- `wrong_score` are JSONB to support per-grade scoring matrices.
CREATE TABLE IF NOT EXISTS exams (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comp_id         TEXT NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  code            TEXT NOT NULL,
  year            INT,
  date            DATE,
  grades          JSONB,
  choice          BOOLEAN NOT NULL DEFAULT true,
  short           BOOLEAN NOT NULL DEFAULT false,
  choice_count    JSONB,
  short_count     JSONB,
  start_time      TIME,
  end_time        TIME,
  minutes         INT,
  correct_score   JSONB,
  wrong_score     JSONB,
  description     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_exams_comp_code_live
  ON exams(comp_id, code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_exams_comp_id ON exams(comp_id);
CREATE INDEX IF NOT EXISTS idx_exams_date_live
  ON exams(date) WHERE deleted_at IS NULL;

-- ── exam_question (T3 pivot — comp_id derivable from exam) ────────────────
CREATE TABLE IF NOT EXISTS exam_question (
  exam_id      UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  question_id  UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  PRIMARY KEY (exam_id, question_id)
);
CREATE INDEX IF NOT EXISTS idx_exam_question_question_id ON exam_question(question_id);

-- ── sessions ──────────────────────────────────────────────────────────────
-- A single user's attempt at an online exam. `corrects` / `wrongs` /
-- `blanks` / `points` are JSONB so per-section breakdowns survive.
CREATE TABLE IF NOT EXISTS sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comp_id       TEXT NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exam_id       UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  grade         TEXT,
  language      TEXT,
  started_at    TIMESTAMPTZ,
  finished_at   TIMESTAMPTZ,
  corrects      JSONB,
  wrongs        JSONB,
  blanks        JSONB,
  points        JSONB,
  total_point   NUMERIC(12,2),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_sessions_comp_id ON sessions(comp_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_exam_id ON sessions(exam_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_live
  ON sessions(user_id, exam_id) WHERE deleted_at IS NULL;

-- ── periods (per-question attempt detail) ────────────────────────────────
CREATE TABLE IF NOT EXISTS periods (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comp_id        TEXT NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  session_id     UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  question_id    UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  answer_id      UUID REFERENCES answers(id) ON DELETE SET NULL,
  type           TEXT,                          -- choice | short
  short_answer   TEXT,
  number         INT,
  is_correct     BOOLEAN,
  point          NUMERIC(12,2),
  started_at     TIMESTAMPTZ,
  finished_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_periods_session_id  ON periods(session_id);
CREATE INDEX IF NOT EXISTS idx_periods_question_id ON periods(question_id);
CREATE INDEX IF NOT EXISTS idx_periods_session_live
  ON periods(session_id, number) WHERE deleted_at IS NULL;

-- ── answer_keys (used only for paper exam grading) ───────────────────────
CREATE TABLE IF NOT EXISTS answer_keys (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comp_id     TEXT NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  session_id  UUID REFERENCES sessions(id) ON DELETE CASCADE,
  period_id   UUID REFERENCES periods(id) ON DELETE CASCADE,
  number      INT,
  key         TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_answer_keys_session_id ON answer_keys(session_id);
CREATE INDEX IF NOT EXISTS idx_answer_keys_period_id  ON answer_keys(period_id);

-- ── paper_exams (offline attempt envelope) ───────────────────────────────
CREATE TABLE IF NOT EXISTS paper_exams (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comp_id         TEXT NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exam_id         UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  session_id      UUID REFERENCES sessions(id) ON DELETE SET NULL,
  test_center_id  UUID REFERENCES test_centers(id) ON DELETE SET NULL,
  name            TEXT,
  code            TEXT,
  grade           TEXT,
  corrects        JSONB,
  wrongs          JSONB,
  blanks          JSONB,
  points          JSONB,
  total_point     NUMERIC(12,2),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_paper_exams_comp_id        ON paper_exams(comp_id);
CREATE INDEX IF NOT EXISTS idx_paper_exams_user_id        ON paper_exams(user_id);
CREATE INDEX IF NOT EXISTS idx_paper_exams_exam_id        ON paper_exams(exam_id);
CREATE INDEX IF NOT EXISTS idx_paper_exams_test_center_id ON paper_exams(test_center_id);

-- ── paper_answers (per-question paper response) ──────────────────────────
CREATE TABLE IF NOT EXISTS paper_answers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comp_id         TEXT NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id      UUID REFERENCES sessions(id) ON DELETE SET NULL,
  period_id       UUID REFERENCES periods(id) ON DELETE SET NULL,
  paper_exam_id   UUID NOT NULL REFERENCES paper_exams(id) ON DELETE CASCADE,
  number          INT,
  answer          TEXT,
  is_correct      BOOLEAN,
  point           NUMERIC(12,2),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_paper_answers_paper_exam_id ON paper_answers(paper_exam_id);
CREATE INDEX IF NOT EXISTS idx_paper_answers_user_id       ON paper_answers(user_id);

-- ── webcams (browser webcam proctor snapshots) ───────────────────────────
-- `image_path` resolves via the existing storage.service.ts (S3-presigned
-- in prod, JWT-token path in local dev).
CREATE TABLE IF NOT EXISTS webcams (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comp_id     TEXT NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  session_id  UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  image_path  TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_webcams_session_id ON webcams(session_id);
CREATE INDEX IF NOT EXISTS idx_webcams_comp_id    ON webcams(comp_id);
