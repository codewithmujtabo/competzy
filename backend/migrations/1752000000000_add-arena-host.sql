-- Migration: add `arena.competzy.com` to site_maintenance so the admin
-- can flag the portal itself (the host that runs THIS app, not the
-- public landing-page subdomains) alongside the existing competzy-web
-- hosts.
--
-- Enforcement: as of this commit the row is PERSISTED + visible in
-- /admin/maintenance, but arena's own Next.js web doesn't yet read it
-- to block traffic on itself. A follow-up will add a middleware to
-- web/ that polls /api/maintenance/state?host=arena.competzy.com and
-- gates non-bypass-cookie visitors when mode='on' (same shape as
-- competzy-web's middleware does for landing pages).
--
-- Idempotent — ON CONFLICT DO NOTHING.

INSERT INTO site_maintenance (host, mode, updated_by) VALUES
  ('arena.competzy.com', 'off', 'system')
ON CONFLICT (host) DO NOTHING;
