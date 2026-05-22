-- Migration: re-add question_maker role.
-- Wave 6 (1749300000000) dropped this role because the original question-bank
-- workspace was folded into admin + organizer. The role is now restored as a
-- narrow author-only role: a question_maker can only author questions +
-- manage taxonomy (subjects / topics / subtopics) under /question-bank, and
-- submit their drafts for review. The approve / send-back / proofread-write
-- flows + every other question-bank surface (review, exams, grading,
-- results, proctoring, medalists, paper exams, certificates) stay
-- admin+organizer-only.

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN (
    'student', 'parent', 'teacher', 'school_admin',
    'admin', 'organizer',
    'country_representative',
    'question_maker'
  ));
