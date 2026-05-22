-- Phase 2 of the Komodo-parity rollout: close the schema gaps that block
-- the multi-language question editor + tags UI.
--
-- The questions table already inherited content2..content6 from the EMC
-- port. The answers table only carries content + content2 + content3 —
-- adding content4/5/6 brings answers to the same 6-language footprint so
-- a question's stem and its options can both be authored in all six
-- supported languages (English / Bahasa / Russian / Spanish / French /
-- Kazakh) via the new shared LANG_TO_COL convention in
-- web/lib/question-bank/languages.ts.
--
-- Tags: a JSONB string-array on the questions table (mirrors the existing
-- JSONB `grades` pattern — no normalised tags table needed, supports the
-- `?` / `?|` operators if we ever filter by tag, no FK overhead). Default
-- '[]' so existing rows backfill cleanly; partial GIN index on live rows
-- keeps the index small.

ALTER TABLE answers
  ADD COLUMN content4 TEXT,
  ADD COLUMN content5 TEXT,
  ADD COLUMN content6 TEXT;

ALTER TABLE questions
  ADD COLUMN tags JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX questions_tags_gin
  ON questions USING GIN (tags)
  WHERE deleted_at IS NULL;
