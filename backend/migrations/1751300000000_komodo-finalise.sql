-- Migration: Komodo finalisation — round description, multi-provider payments,
--            country-scoped vouchers, and a Komodo required-fields tweak.
--
-- Bundles every schema change the Komodo end-to-end push needs so production
-- rollout is one `npm run db:migrate`. Each piece is additive — existing
-- Midtrans + NPSN-scoped voucher rows keep working untouched.

-- 1. Round description (rendered in the new RoundsPanel list layout).
ALTER TABLE competition_rounds
  ADD COLUMN IF NOT EXISTS description TEXT;

-- 2. Multi-provider payments — Stripe lands alongside Midtrans.
--    Defaults preserve every existing row as ('midtrans', 'IDR').
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'midtrans';
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'IDR';

-- Use DO block so the CHECK is only added once even if migration re-runs.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payments_provider_check'
  ) THEN
    ALTER TABLE payments
      ADD CONSTRAINT payments_provider_check
      CHECK (provider IN ('midtrans','stripe'));
  END IF;
END $$;

-- 3. Voucher country scope — Komodo's "10 codes for Malaysia" use case.
--    NULL = no country lock (existing global + NPSN-scoped vouchers unchanged).
ALTER TABLE voucher_groups
  ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE vouchers
  ADD COLUMN IF NOT EXISTS country TEXT;

-- 4. Komodo required-fields tweak — drop city, province, supervisorName,
--    supervisorEmail from the mandatory list. The user wants those to render
--    as OPTIONAL inputs in the profile-completion dialog rather than blocking
--    registration. Country stays required (it's the catalog-visibility key);
--    schoolName, dateOfBirth, phone, email, fullName all stay required.
UPDATE competitions
   SET required_profile_fields = '[
        "fullName",
        "email",
        "phone",
        "dateOfBirth",
        "country",
        "schoolName"
      ]'::jsonb
 WHERE slug = 'komodo';
