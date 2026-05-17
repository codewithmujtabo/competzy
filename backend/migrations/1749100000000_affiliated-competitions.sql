-- Migration: affiliated-competitions (Wave 5 Phase 1)
-- Adds the native/affiliated competition kind + per-registration external
-- credentials. Affiliated competitions: students register + pay on Competzy,
-- then an operator issues each student a login they carry to the affiliated
-- competition's external site. The external URL reuses the existing
-- competitions.post_payment_redirect_url column.

ALTER TABLE competitions
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'native'
    CHECK (kind IN ('native','affiliated'));

-- One credential per registration. `password` is plaintext on purpose — it is
-- a credential for an EXTERNAL partner platform that the student must read and
-- type in, not a Competzy auth password (a one-way hash would make it
-- unusable). The audit middleware already redacts the `password` key.
CREATE TABLE IF NOT EXISTS affiliated_credentials (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id TEXT NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
  comp_id         TEXT NOT NULL REFERENCES competitions(id)  ON DELETE CASCADE,
  username        TEXT NOT NULL,
  password        TEXT NOT NULL,
  issued_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  issued_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);

-- One live credential per registration; index the comp lookup.
CREATE UNIQUE INDEX IF NOT EXISTS idx_affiliated_credentials_reg
  ON affiliated_credentials(registration_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_affiliated_credentials_comp
  ON affiliated_credentials(comp_id) WHERE deleted_at IS NULL;
