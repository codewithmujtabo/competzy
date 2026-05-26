-- Migration: site_maintenance — per-site maintenance toggle for the
-- competzy.com landing page + 12 competition subdomains.
--
-- Contract: docs/arena-maintenance-spec.md (in the competzy-web repo).
-- Public state lookup at GET /api/maintenance/state?host=<host>.
-- Admin CRUD at PATCH /api/admin/maintenance/{host} (admin role only).
--
-- Modes:
--   off       — normal operation
--   read-only — page visible, banner shown, form submits return 503
--   on        — full takeover; only admin-bypass-cookie holders see real page
--
-- Global override: the synthetic row `host = '*'` wins over per-host rows
-- when its `mode` is not 'off'. The resolver in the state route checks the
-- global row first; if it's `off`, falls back to the per-host row.
--
-- Audit: every PATCH also writes an `audit_log` row via the audit() middleware
-- in the route (no separate audit table here — reuse the existing one).

CREATE TABLE IF NOT EXISTS site_maintenance (
  host         TEXT PRIMARY KEY,
  mode         TEXT NOT NULL DEFAULT 'off',
  updated_by   TEXT NOT NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT site_maintenance_mode_check
    CHECK (mode IN ('off', 'read-only', 'on'))
);

-- Seed: global kill switch + 13 hosts (12 subdomains + the main landing).
-- All start at 'off' so the toggle is wired up without changing any
-- existing public behavior.
INSERT INTO site_maintenance (host, mode, updated_by) VALUES
  ('*',                          'off', 'system'),
  ('competzy.com',               'off', 'system'),
  ('emc.competzy.com',           'off', 'system'),
  ('ispo.competzy.com',          'off', 'system'),
  ('osebi.competzy.com',         'off', 'system'),
  ('komodo.competzy.com',        'off', 'system'),
  ('genius.competzy.com',        'off', 'system'),
  ('owlypia.competzy.com',       'off', 'system'),
  ('mathchallenge.competzy.com', 'off', 'system'),
  ('stemolympiad.competzy.com',  'off', 'system'),
  ('nextgen.competzy.com',       'off', 'system'),
  ('youngmaster.competzy.com',   'off', 'system'),
  ('angkor.competzy.com',        'off', 'system'),
  ('igo.competzy.com',           'off', 'system')
ON CONFLICT (host) DO NOTHING;
