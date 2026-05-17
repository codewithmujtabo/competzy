-- Migration: certificates (EMC Wave 12 Phase 1)
-- A verifiable Certificate of Participation / Achievement, auto-issued the first
-- time a student finishes a competition exam (an online `sessions` attempt or
-- an operator-recorded `paper_exams` row). One live certificate per
-- (competition, student) — the partial-unique index is the idempotency key.
--
-- T1 strict multi-tenant: comp_id NOT NULL, soft-delete (`deleted_at`).
--
--   verification_code  — the PUBLIC capability: the random token in the QR code
--                        and the /verify/<code> URL. Unguessable.
--   certificate_number — human-readable, sequence-backed (CTZ-CERT-2026-NNNN);
--                        printed on the certificate + encoded in the barcode.
--   revoked_at         — the domain "no longer valid" flag. Distinct from the
--                        soft-delete `deleted_at`: a revoked certificate still
--                        verifies (showing "REVOKED"); a soft-deleted one 404s.
--   score_locked       — set true once an operator edits the score; the nightly
--                        backfill then stops auto-syncing it.

CREATE SEQUENCE IF NOT EXISTS certificate_number_seq START WITH 1;

CREATE TABLE IF NOT EXISTS certificates (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comp_id             TEXT NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  registration_id     TEXT NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
  session_id          UUID REFERENCES sessions(id) ON DELETE SET NULL,
  paper_exam_id       UUID REFERENCES paper_exams(id) ON DELETE SET NULL,
  certificate_number  TEXT NOT NULL UNIQUE,
  verification_code   TEXT NOT NULL UNIQUE,
  type                TEXT NOT NULL DEFAULT 'participation'
                        CHECK (type IN ('participation','achievement')),
  award_label         TEXT,
  student_name        TEXT NOT NULL,
  competition_name    TEXT NOT NULL,
  grade               TEXT,
  score               NUMERIC(12,2),
  score_max           NUMERIC(12,2),
  score_locked        BOOLEAN NOT NULL DEFAULT false,
  issued_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at          TIMESTAMPTZ
);

-- One live certificate per (competition, student) — the idempotency key.
CREATE UNIQUE INDEX IF NOT EXISTS idx_certificates_comp_user_live
  ON certificates(comp_id, user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_certificates_comp_id         ON certificates(comp_id);
CREATE INDEX IF NOT EXISTS idx_certificates_user_id         ON certificates(user_id);
CREATE INDEX IF NOT EXISTS idx_certificates_registration_id ON certificates(registration_id);
