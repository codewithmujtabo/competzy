-- Email verification at signup.
--
-- New accounts must prove they own the email address before the account is
-- created: POST /auth/signup/send-code issues a 6-digit code (stored in
-- otp_codes, scoped by purpose='email_verify'), and POST /auth/signup will only
-- create the account when a matching, unconsumed, unexpired code is presented.
--
-- 1. otp_codes.purpose — lets one table hold both login OTPs ('login', the
--    default) and signup verification codes ('email_verify') without cross-use.
-- 2. users.email_verified_at — mirrors the existing phone_verified_at column.
--    Every account created from now on is verified at insert time; pre-existing
--    accounts are grandfathered so the new column never makes an old user look
--    unverified (we never gate login on it — it's an audit/parity field).

ALTER TABLE otp_codes
  ADD COLUMN IF NOT EXISTS purpose TEXT NOT NULL DEFAULT 'login';

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;

-- Grandfather every existing account as already-verified.
UPDATE users
  SET email_verified_at = now()
  WHERE email_verified_at IS NULL;
