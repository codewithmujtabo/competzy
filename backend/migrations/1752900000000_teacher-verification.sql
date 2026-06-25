-- Teacher verification at signup — mirrors the school verification model
-- (Sprint 16, migration 1747500000000).
--
-- A teacher who self-registers from the competition register page must be
-- approved by an admin/organizer before they can enter the teacher portal,
-- so a student can't simply pick "Teacher" and gain teacher tooling. The
-- columns mirror schools.* so the gating + admin review flow is symmetric.
--
-- DEFAULT 'verified' grandfathers every existing teacher (they signed up
-- before this gate existed). Only NEW signups explicitly set
-- 'pending_verification', so this migration never locks anyone out.
--
-- npsn captures the school the teacher claims at signup (the teachers table
-- only had a free-text `school` before) so the verifier can match it to a
-- real school directory entry.

ALTER TABLE teachers
  ADD COLUMN IF NOT EXISTS npsn TEXT,
  ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'verified'
    CHECK (verification_status IN ('pending_verification', 'verified', 'rejected')),
  ADD COLUMN IF NOT EXISTS applied_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verified_by_user_id UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Partial index for the admin "pending teachers" review queue.
CREATE INDEX IF NOT EXISTS idx_teachers_verification_status
  ON teachers (verification_status)
  WHERE verification_status <> 'verified';
