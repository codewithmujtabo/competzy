-- Migration: emc-venues (Wave 1 Phase D, 2 of 6)
-- Geographic regions, physical exam venues, and the M:M links from each
-- to the users who coordinate / proctor them. These tables are global
-- (T3) — venues + regions are shared across competitions. A single
-- Jakarta venue can host both EMC and ISPO without duplication.

-- ── areas (T3 — global) ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS areas (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  province    TEXT NOT NULL,
  part        TEXT,
  group_name  TEXT,                    -- renamed from legacy `group` (reserved word)
  code        TEXT UNIQUE,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_areas_province_live
  ON areas(province) WHERE deleted_at IS NULL;

-- ── test_centers (T3 — global) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS test_centers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id     UUID REFERENCES areas(id) ON DELETE SET NULL,
  code        TEXT UNIQUE,
  name        TEXT NOT NULL,
  address     TEXT,
  city        TEXT,
  phone       TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_test_centers_area_id   ON test_centers(area_id);
CREATE INDEX IF NOT EXISTS idx_test_centers_city_live
  ON test_centers(city) WHERE deleted_at IS NULL;

-- ── area_user (T3 pivot — regional coordinators) ─────────────────────────
CREATE TABLE IF NOT EXISTS area_user (
  area_id  UUID NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
  user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (area_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_area_user_user_id ON area_user(user_id);

-- ── test_center_user (T3 pivot — venue proctors) ─────────────────────────
CREATE TABLE IF NOT EXISTS test_center_user (
  test_center_id  UUID NOT NULL REFERENCES test_centers(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (test_center_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_test_center_user_user_id ON test_center_user(user_id);
