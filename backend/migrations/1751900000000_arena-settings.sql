-- Migration: arena_settings — small key/value store for arena-side
-- feature flags that an admin toggles from /admin/maintenance.
--
-- Distinct from site_maintenance (which gates the 13 competzy-web
-- landing-page subdomains): this table covers arena.competzy.com itself.
-- Reading code lives in backend/src/routes/arena-settings.routes.ts.
--
-- Why JSONB instead of a fixed schema: every new flag we want to add
-- (exam_paused, payments_paused, …) drops in as a new row without a
-- migration. The first flag is the boolean `registration_enabled`.

CREATE TABLE IF NOT EXISTS arena_settings (
  key          TEXT PRIMARY KEY,
  value        JSONB NOT NULL,
  description  TEXT,
  updated_by   TEXT NOT NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed the registration toggle. Default `true` so the migration is a
-- no-op behaviour-wise — admins must explicitly turn it off.
INSERT INTO arena_settings (key, value, description, updated_by) VALUES
  (
    'registration_enabled',
    'true'::jsonb,
    'When false, POST /api/auth/signup returns 503 and the register form on web is disabled. Login + every other flow is unaffected.',
    'system'
  )
ON CONFLICT (key) DO NOTHING;
