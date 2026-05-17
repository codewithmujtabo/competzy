-- Migration: referral-commission-rate (EMC Wave 10 Phase 1)
-- The affiliate-referral funnel (the Wave-1 `referrals` table) accrues a
-- `commission` total but had no per-conversion rate. This adds the rate a
-- referral earns for each paid registration attributed to it; the payment
-- settlement path does `commission += commission_per_paid` on the first
-- settle (and `total = commission + bonus`).

ALTER TABLE referrals ADD COLUMN IF NOT EXISTS commission_per_paid NUMERIC(12,2) NOT NULL DEFAULT 0;
