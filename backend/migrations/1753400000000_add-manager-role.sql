-- Migration: add the `manager` role.
--
-- A manager is Competzy administrative staff (panitia). They get the admin
-- portal's OPERATIONAL surface: competitions, registrations approve/reject,
-- users, schools, verification queue, venues, flow editor, notifications,
-- waitlist, and the email-broadcast composer. They are explicitly EXCLUDED
-- from financial data (revenue reports, KPI money figures, refunds), the
-- maintenance toggle, impersonation (super-admin only), and the
-- question-bank / commerce operator workspaces.
--
-- Enforcement lives in code: `adminOrManager` middleware + per-route strict
-- `adminOnly` on the financial endpoints (admin.routes.ts), plus role-aware
-- redaction inside /stats and /kpi.

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (
  role IN (
    'student',
    'parent',
    'teacher',
    'school_admin',
    'admin',
    'manager',
    'organizer',
    'country_representative',
    'question_maker'
  )
);
