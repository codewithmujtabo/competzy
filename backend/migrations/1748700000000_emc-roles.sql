-- Migration: emc-roles (EMC Wave 2, Phase 1)
-- Adds the two legacy-EMC operator roles to the users.role CHECK constraint:
--   supervisor     — runs test centers / proctoring (web UI lands in Wave 4)
--   question_maker — authors exam questions in the question bank (web UI in Wave 2 Phase 4)
--
-- Mirrors 1745800000000_add-organizer-role.sql. No profile tables are created:
-- a question_maker is identified via questions.writer_id and the accesses table
-- (per-comp grade scoping); a supervisor via the area_user / test_center_user
-- pivots (both from Wave 1 Phase D).

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN (
    'student', 'parent', 'teacher', 'school_admin',
    'admin', 'organizer', 'supervisor', 'question_maker'
  ));
