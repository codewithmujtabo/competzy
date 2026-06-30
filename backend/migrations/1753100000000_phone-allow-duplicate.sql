-- Migration: phone-allow-duplicate
-- Phone numbers may be shared across accounts. In K-12 registration a single
-- WhatsApp number (a parent's) is commonly used for several children, so the
-- phone is contact info, not an identity key. Only the EMAIL must be unique.
--
-- Before this, a duplicate phone at signup raised a 23505 on
-- idx_users_phone_unique; the signup error handler then mis-surfaced that as
-- "email already registered" (the frontend treated any 409 as email-taken),
-- which was misleading.
--
-- Drop the unique index and replace it with a plain lookup index so phone-OTP
-- login (WHERE phone = ANY(...)) stays fast. Email stays unique via
-- users_email_key. Idempotent.

DROP INDEX IF EXISTS idx_users_phone_unique;

CREATE INDEX IF NOT EXISTS idx_users_phone
  ON users(phone) WHERE phone IS NOT NULL;
