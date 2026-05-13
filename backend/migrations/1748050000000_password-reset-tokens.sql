-- Migration: password-reset-tokens
-- Backs the POST /api/auth/forgot-password + /api/auth/reset-password flow
-- introduced in Sprint 20 Phase B. We store only the SHA-256 hash of the
-- token — never the raw secret — so a DB leak can't be used to take over
-- accounts. TTL is 15 minutes, single-use (used_at gets stamped on success).

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id
  ON password_reset_tokens(user_id);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at
  ON password_reset_tokens(expires_at)
  WHERE used_at IS NULL;
