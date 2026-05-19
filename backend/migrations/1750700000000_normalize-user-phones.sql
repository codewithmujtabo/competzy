-- Migration: normalize-user-phones
-- Phone numbers were stored as-entered, in mixed formats (08xxx saved by the
-- mobile app, +62xxx by the web). This normalises every existing users.phone
-- to the canonical local 0-prefixed format (e.g. +62897654321 / 62897654321 /
-- 897654321  ->  0897654321) and strips any spacing/punctuation.
-- Going forward, signup and PUT /api/users/me normalise on write via
-- toLocalPhone(); login lookups remain format-agnostic via phoneVariants().
-- Idempotent — a row that is already 0-prefixed is left as its digits.

UPDATE users
   SET phone = CASE
     WHEN regexp_replace(phone, '\D', '', 'g') LIKE '62%'
       THEN '0' || substring(regexp_replace(phone, '\D', '', 'g') FROM 3)
     WHEN regexp_replace(phone, '\D', '', 'g') LIKE '8%'
       THEN '0' || regexp_replace(phone, '\D', '', 'g')
     ELSE regexp_replace(phone, '\D', '', 'g')
   END
 WHERE phone IS NOT NULL
   AND btrim(phone) <> '';
