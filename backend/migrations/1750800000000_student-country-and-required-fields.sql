-- Migration: student country + per-competition required profile fields
--
-- Two pieces:
--   1. `users.country` — ISO 3166-1 alpha-2 (e.g. 'ID', 'MY'). Nullable so existing
--      rows are preserved; the pre-payment dialog (Komodo) prompts the student
--      to fill it on their next registration.
--   2. `competitions.required_profile_fields` — JSONB array of profile field keys
--      that MUST be present before a student can register for the competition.
--      Empty array (the default) means no pre-payment gate, so EMC / ISPO / OSEBI
--      keep their existing straight-to-pay behaviour. Komodo is seeded with the
--      nine mandatory fields the operator confirmed: Name, Email, WhatsApp, DOB,
--      City, Country, Teacher Name, Teacher Email, School Name.
--
-- Field key vocabulary (mirrors the JSON keys returned by GET /api/users/me):
--   fullName, email, phone (= WhatsApp), city, country,
--   dateOfBirth, supervisorName, supervisorEmail, schoolName,
--   schoolEmail, schoolAddress (optional — not seeded as mandatory).

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS country TEXT;

ALTER TABLE competitions
  ADD COLUMN IF NOT EXISTS required_profile_fields JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Seed Komodo's mandatory fields. The slug 'komodo' is the stable key — the
-- competition's TEXT id is env-specific (`comp-komodo` locally, may differ
-- in seeded prod data) so we update by slug.
UPDATE competitions
   SET required_profile_fields = '[
        "fullName",
        "email",
        "phone",
        "dateOfBirth",
        "city",
        "country",
        "supervisorName",
        "supervisorEmail",
        "schoolName"
      ]'::jsonb
 WHERE slug = 'komodo';
