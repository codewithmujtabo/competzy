-- Migration: broadcast unsubscribe suppression list (RFC 8058 one-click).
--
-- Any address here is excluded from every future broadcast audience.
-- Rows are written by the public unsubscribe endpoint (HMAC-token verified,
-- no auth) reached from the email footer link and the List-Unsubscribe
-- one-click header. Transactional email (verification, reset, OTP) is NOT
-- affected — this suppresses campaigns only.

CREATE TABLE email_unsubscribes (
  email TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- 'link' (footer click) | 'one-click' (mail-client header POST)
  source TEXT NOT NULL DEFAULT 'link'
);
