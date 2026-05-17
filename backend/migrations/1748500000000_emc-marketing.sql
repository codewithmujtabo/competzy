-- Migration: emc-marketing (Wave 1 Phase D, 5 of 6)
-- Affiliate referrals + click attribution + content broadcasts
-- (announcements + materials) + student suggestions. Most are T1
-- comp-scoped; announcements + materials are T2 (nullable comp_id) so a
-- platform-wide post can have comp_id IS NULL.

-- ── referrals ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS referrals (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comp_id      TEXT NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  email        TEXT,
  phone        TEXT,
  code         TEXT NOT NULL,
  year         INT,
  click         INT NOT NULL DEFAULT 0,
  account       INT NOT NULL DEFAULT 0,
  registration  INT NOT NULL DEFAULT 0,
  paid          INT NOT NULL DEFAULT 0,
  commission    NUMERIC(12,2) NOT NULL DEFAULT 0,
  bonus         NUMERIC(12,2) NOT NULL DEFAULT 0,
  total         NUMERIC(12,2) NOT NULL DEFAULT 0,
  early_paid    NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at    TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_referrals_comp_code_live
  ON referrals(comp_id, code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_referrals_comp_id ON referrals(comp_id);
CREATE INDEX IF NOT EXISTS idx_referrals_email   ON referrals(email);

-- ── clicks ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clicks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comp_id       TEXT NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  referral_id   UUID NOT NULL REFERENCES referrals(id) ON DELETE CASCADE,
  ip            TEXT,
  user_agent    TEXT,
  http_referer  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_clicks_referral_id ON clicks(referral_id);
CREATE INDEX IF NOT EXISTS idx_clicks_comp_id     ON clicks(comp_id);

-- ── announcements (T2 — nullable comp_id, NULL = platform broadcast) ──────
CREATE TABLE IF NOT EXISTS announcements (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comp_id      TEXT REFERENCES competitions(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  body         TEXT,
  type         TEXT,
  target       TEXT,
  image        TEXT,
  file         TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  is_featured  BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_announcements_comp_id      ON announcements(comp_id);
CREATE INDEX IF NOT EXISTS idx_announcements_published_at ON announcements(published_at);
CREATE INDEX IF NOT EXISTS idx_announcements_live
  ON announcements(comp_id, published_at) WHERE deleted_at IS NULL AND is_active = true;

-- ── materials (T2 — nullable comp_id, NULL = platform library) ────────────
CREATE TABLE IF NOT EXISTS materials (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comp_id      TEXT REFERENCES competitions(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  body         TEXT,
  type         TEXT,
  category     TEXT,
  grades       JSONB,
  image        TEXT,
  file         TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  published_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_materials_comp_id      ON materials(comp_id);
CREATE INDEX IF NOT EXISTS idx_materials_published_at ON materials(published_at);
CREATE INDEX IF NOT EXISTS idx_materials_live
  ON materials(comp_id, category) WHERE deleted_at IS NULL AND is_active = true;

-- ── suggestions (student feedback) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS suggestions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comp_id     TEXT NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exam_id     UUID REFERENCES exams(id) ON DELETE SET NULL,
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_suggestions_comp_id ON suggestions(comp_id);
CREATE INDEX IF NOT EXISTS idx_suggestions_user_id ON suggestions(user_id);
CREATE INDEX IF NOT EXISTS idx_suggestions_exam_id ON suggestions(exam_id);
