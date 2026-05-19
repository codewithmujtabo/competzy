-- Migration: normalize-user-phones
-- Normalises users.phone to the canonical local 0-prefixed format
-- (+62897654321 / 62897654321 / 897654321 -> 0897654321), stripping any
-- spacing and punctuation. Going forward, signup + PUT /api/users/me
-- normalise on write via toLocalPhone(); login lookups stay format-agnostic
-- via phoneVariants().
--
-- COLLISION SAFETY: users.phone carries a unique index. Some rows hold the
-- SAME number in different raw formats (e.g. +62812... and 0812...) — distinct
-- strings today, but identical once normalised. So this rewrites only ONE row
-- per normalised value (preferring a row already in the target format) and
-- leaves the rest of a colliding group at their current, still-distinct
-- string. Those stragglers still log in fine (phoneVariants is format-
-- agnostic); a shared-phone account pair is a data issue to review separately
-- (see the diagnostic query at the bottom of this file). Idempotent.

WITH normalized AS (
  SELECT
    id,
    phone AS current_phone,
    CASE
      WHEN regexp_replace(phone, '\D', '', 'g') LIKE '62%'
        THEN '0' || substring(regexp_replace(phone, '\D', '', 'g') FROM 3)
      WHEN regexp_replace(phone, '\D', '', 'g') LIKE '8%'
        THEN '0' || regexp_replace(phone, '\D', '', 'g')
      ELSE regexp_replace(phone, '\D', '', 'g')
    END AS norm
  FROM users
  WHERE phone IS NOT NULL AND btrim(phone) <> ''
),
ranked AS (
  SELECT
    id,
    current_phone,
    norm,
    row_number() OVER (
      PARTITION BY norm
      ORDER BY (current_phone = norm) DESC, id
    ) AS rn
  FROM normalized
)
UPDATE users u
   SET phone = r.norm
  FROM ranked r
 WHERE u.id = r.id
   AND r.rn = 1
   AND u.phone <> r.norm;

-- Diagnostic — accounts that share a phone number (normalised). Run manually
-- to review; this migration intentionally does not merge or delete them:
--
--   SELECT
--     CASE
--       WHEN regexp_replace(phone, '\D', '', 'g') LIKE '62%'
--         THEN '0' || substring(regexp_replace(phone, '\D', '', 'g') FROM 3)
--       WHEN regexp_replace(phone, '\D', '', 'g') LIKE '8%'
--         THEN '0' || regexp_replace(phone, '\D', '', 'g')
--       ELSE regexp_replace(phone, '\D', '', 'g')
--     END AS normalized_phone,
--     count(*), array_agg(email), array_agg(id)
--   FROM users
--   WHERE phone IS NOT NULL AND btrim(phone) <> ''
--   GROUP BY 1 HAVING count(*) > 1;
