-- Migration: backfill-schools-from-students
-- Students choose a school by NPSN at signup, but that choice was only ever
-- stored on the `students` row — it never created a row in the `schools`
-- directory, so the admin Schools page showed only manually-added schools.
--
-- This backfills the directory from every student who registered WITH an NPSN
-- (NPSN is the unique key on `schools`), de-duplicated by NPSN, and links those
-- students to the new rows. Students with no NPSN are skipped (NPSN is required
-- on `schools`). Going forward, signup + profile-update upsert the school
-- directly — see backend/src/db/upsert-school.ts.

INSERT INTO schools (npsn, name, address)
SELECT DISTINCT ON (TRIM(s.npsn))
       TRIM(s.npsn),
       -- some rows prefix the NPSN into the name ("20206227 - SMAN 1 …")
       TRIM(regexp_replace(s.school_name, '^\s*\d+\s*-\s*', '')),
       NULLIF(TRIM(COALESCE(s.school_address, '')), '')
  FROM students s
 WHERE s.npsn IS NOT NULL AND TRIM(s.npsn) <> ''
   AND s.school_name IS NOT NULL AND TRIM(s.school_name) <> ''
   AND s.deleted_at IS NULL
 ORDER BY TRIM(s.npsn), s.created_at ASC
ON CONFLICT (npsn) DO NOTHING;

-- Link students to their directory school now that the rows exist.
UPDATE students s
   SET school_id = sc.id,
       updated_at = now()
  FROM schools sc
 WHERE s.school_id IS NULL
   AND s.npsn IS NOT NULL
   AND TRIM(s.npsn) <> ''
   AND sc.npsn = TRIM(s.npsn);
