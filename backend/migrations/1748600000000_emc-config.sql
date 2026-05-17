-- Migration: emc-config (Wave 1 Phase D, 6 of 6)
-- Global key-value settings + per-comp question-maker grade scoping.

-- ── settings (T3 — global k/v) ───────────────────────────────────────────
-- Platform-wide config. If a setting needs comp scoping later, encode it
-- in the key (e.g. `emc-2026.exam_minutes`).
CREATE TABLE IF NOT EXISTS settings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT NOT NULL UNIQUE,
  value       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_settings_live ON settings(key) WHERE deleted_at IS NULL;

-- ── accesses (T1 — per-comp grade scoping for question makers) ───────────
-- A question-maker's grade access can differ per competition (e.g. SD+SMP
-- on EMC but only SMA on ISPO).
CREATE TABLE IF NOT EXISTS accesses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comp_id     TEXT NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  grades      JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_accesses_comp_user
  ON accesses(comp_id, user_id);
