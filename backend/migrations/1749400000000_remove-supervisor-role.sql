-- Migration: remove-supervisor-role (EMC Wave 8)
-- The supervisor role (test-center proctors / area coordinators) is dropped.
-- Venue management + webcam proctoring are folded into the admin + organizer
-- surfaces — there is no proctor portal. Mirrors 1749300000000, which dropped
-- question_maker for the same reason.
--
-- Any seeded supervisor users were dev fixtures. Their area_user /
-- test_center_user rows cascade away (ON DELETE CASCADE on user_id);
-- dependent audit_log + accesses rows are cleared first so the user delete
-- never trips a foreign key.

DELETE FROM audit_log WHERE user_id IN (SELECT id FROM users WHERE role = 'supervisor');
DELETE FROM accesses  WHERE user_id IN (SELECT id FROM users WHERE role = 'supervisor');
DELETE FROM users     WHERE role = 'supervisor';

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN (
    'student', 'parent', 'teacher', 'school_admin',
    'admin', 'organizer'
  ));
