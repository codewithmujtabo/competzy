-- Migration: remove-question-maker-role (EMC Wave 6 re-scope)
-- The question bank is no longer a standalone role. It is folded into the
-- admin + organizer portals: an admin manages every native competition's
-- bank, an organizer manages the banks of the competitions they created.
-- Affiliated competitions have no question bank.
--
-- Any seeded question_maker users were dev fixtures only — remove them. Their
-- authored questions cascade-delete (questions.writer_id ON DELETE CASCADE);
-- dependent audit_log + accesses rows are cleared first so the user delete
-- never trips a foreign key.

DELETE FROM audit_log WHERE user_id IN (SELECT id FROM users WHERE role = 'question_maker');
DELETE FROM accesses  WHERE user_id IN (SELECT id FROM users WHERE role = 'question_maker');
DELETE FROM users     WHERE role = 'question_maker';

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN (
    'student', 'parent', 'teacher', 'school_admin',
    'admin', 'organizer', 'supervisor'
  ));
