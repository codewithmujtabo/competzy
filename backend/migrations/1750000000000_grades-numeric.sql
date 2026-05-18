-- Migration: grades-numeric
-- Replaces the SD/SMP/SMA school-level grade vocabulary with numeric grades
-- (1-12) platform-wide. competitions.grade_level (comma-joined TEXT),
-- exams.grades / questions.grades (JSONB string arrays) and the per-grade
-- exams.correct_score / wrong_score JSONB maps all carried level tokens.
-- A student's grade (students.grade, sessions.grade) is already numeric, so
-- after this migration gradeTokens() is just a "09" -> "9" normaliser.
--
--   SD -> 1..6    SMP -> 7..9    SMA -> 10..12    Umum -> 1..12
--
-- Idempotent: only the four level tokens are transformed (numeric values pass
-- through unchanged), so a re-run is a no-op.

-- Expand one grade token to its numeric grade(s); numeric input passes through,
-- an unrecognised token yields nothing.
CREATE OR REPLACE FUNCTION _grades_numeric_expand(tok text) RETURNS int[] AS $$
  SELECT CASE upper(btrim(tok))
    WHEN 'SD'   THEN ARRAY[1,2,3,4,5,6]
    WHEN 'SMP'  THEN ARRAY[7,8,9]
    WHEN 'SMA'  THEN ARRAY[10,11,12]
    WHEN 'UMUM' THEN ARRAY[1,2,3,4,5,6,7,8,9,10,11,12]
    ELSE CASE WHEN btrim(tok) ~ '^[0-9]+$'
              THEN ARRAY[btrim(tok)::int]
              ELSE ARRAY[]::int[] END
  END;
$$ LANGUAGE sql IMMUTABLE;

-- competitions.grade_level — comma-joined TEXT.
UPDATE competitions c SET grade_level = e.joined
FROM (
  SELECT id, string_agg(n::text, ',' ORDER BY n) AS joined
  FROM (
    SELECT DISTINCT comp.id AS id, n
    FROM competitions comp,
         LATERAL regexp_split_to_table(comp.grade_level, ',') AS tok,
         LATERAL unnest(_grades_numeric_expand(tok)) AS n
    WHERE comp.grade_level IS NOT NULL AND btrim(comp.grade_level) <> ''
  ) d
  GROUP BY id
) e
WHERE c.id = e.id AND c.grade_level IS DISTINCT FROM e.joined;

-- exams.grades — JSONB string array.
UPDATE exams ex SET grades = e.arr
FROM (
  SELECT id, jsonb_agg(n::text ORDER BY n) AS arr
  FROM (
    SELECT DISTINCT exams.id AS id, n
    FROM exams,
         LATERAL jsonb_array_elements_text(exams.grades) AS tok,
         LATERAL unnest(_grades_numeric_expand(tok)) AS n
    WHERE jsonb_typeof(exams.grades) = 'array'
  ) d
  GROUP BY id
) e
WHERE ex.id = e.id AND ex.grades IS DISTINCT FROM e.arr;

-- questions.grades — JSONB string array.
UPDATE questions q SET grades = e.arr
FROM (
  SELECT id, jsonb_agg(n::text ORDER BY n) AS arr
  FROM (
    SELECT DISTINCT questions.id AS id, n
    FROM questions,
         LATERAL jsonb_array_elements_text(questions.grades) AS tok,
         LATERAL unnest(_grades_numeric_expand(tok)) AS n
    WHERE jsonb_typeof(questions.grades) = 'array'
  ) d
  GROUP BY id
) e
WHERE q.id = e.id AND q.grades IS DISTINCT FROM e.arr;

-- exams.correct_score — JSONB map keyed by grade. Explode each level key into
-- its numeric keys, keeping the same value.
UPDATE exams ex SET correct_score = e.obj
FROM (
  SELECT id, jsonb_object_agg(k, v) AS obj
  FROM (
    SELECT DISTINCT ON (exams.id, n)
           exams.id AS id, n::text AS k, kv.value AS v
    FROM exams,
         LATERAL jsonb_each(exams.correct_score) AS kv,
         LATERAL unnest(_grades_numeric_expand(kv.key)) AS n
    WHERE jsonb_typeof(exams.correct_score) = 'object'
    ORDER BY exams.id, n
  ) d
  GROUP BY id
) e
WHERE ex.id = e.id AND ex.correct_score IS DISTINCT FROM e.obj;

-- exams.wrong_score — same transformation.
UPDATE exams ex SET wrong_score = e.obj
FROM (
  SELECT id, jsonb_object_agg(k, v) AS obj
  FROM (
    SELECT DISTINCT ON (exams.id, n)
           exams.id AS id, n::text AS k, kv.value AS v
    FROM exams,
         LATERAL jsonb_each(exams.wrong_score) AS kv,
         LATERAL unnest(_grades_numeric_expand(kv.key)) AS n
    WHERE jsonb_typeof(exams.wrong_score) = 'object'
    ORDER BY exams.id, n
  ) d
  GROUP BY id
) e
WHERE ex.id = e.id AND ex.wrong_score IS DISTINCT FROM e.obj;

DROP FUNCTION _grades_numeric_expand(text);
