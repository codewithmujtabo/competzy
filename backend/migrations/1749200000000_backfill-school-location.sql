-- Migration: backfill-school-location (Session 11 — admin-table polish)
-- The 1748900000000 backfill seeded schools with only NPSN + name, so the
-- admin Schools directory shows '—' for City/Province on almost every row.
-- This fills city + province from the location of the students linked to
-- each school (their own city/province on the users row) — the most common
-- value per school. Only schools with no city set are touched; any
-- manually-entered location is left as-is.

UPDATE schools sc
   SET city = loc.city,
       province = loc.province,
       updated_at = now()
  FROM (
    SELECT DISTINCT ON (s.school_id)
           s.school_id,
           NULLIF(TRIM(u.city), '')     AS city,
           NULLIF(TRIM(u.province), '') AS province
      FROM students s
      JOIN users u ON u.id = s.id
     WHERE s.school_id IS NOT NULL
       AND s.deleted_at IS NULL
       AND u.deleted_at IS NULL
       AND NULLIF(TRIM(u.city), '') IS NOT NULL
     GROUP BY s.school_id, NULLIF(TRIM(u.city), ''), NULLIF(TRIM(u.province), '')
     ORDER BY s.school_id, COUNT(*) DESC
  ) loc
 WHERE sc.id = loc.school_id
   AND (sc.city IS NULL OR TRIM(sc.city) = '');
