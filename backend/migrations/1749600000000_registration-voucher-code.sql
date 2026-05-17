-- Migration: registration-voucher-code (EMC Wave 9 Phase 3)
-- A student may apply a registration-fee voucher before paying. The chosen
-- code is persisted on the registration so POST /payments/snap and the
-- settlement webhook can resolve the discounted fee and redeem the voucher
-- (the voucher's `used` counter is incremented + linked to the payment on
-- settlement, not at snap time, so an abandoned checkout never burns a code).

ALTER TABLE registrations ADD COLUMN IF NOT EXISTS voucher_code TEXT;
