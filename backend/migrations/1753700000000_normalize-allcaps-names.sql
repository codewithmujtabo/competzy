-- Migration: normalize ALL-CAPS / all-lowercase user names to Capitalized Case.
--
-- "BRUNO CARLES DELGADILLO ALVAREZ" → "Bruno Carles Delgadillo Alvarez".
-- Only rows whose full_name is ENTIRELY upper- or lowercase are touched;
-- mixed-case names (intentional casing like "McDonald") are left alone.
-- INITCAP capitalizes after any non-letter, so hyphens/apostrophes behave
-- ("O'BRIEN" → "O'Brien"). Write paths now normalize on save (lib/names.ts),
-- so this is a one-time backfill. Idempotent.

UPDATE users
   SET full_name = INITCAP(full_name)
 WHERE full_name IS NOT NULL
   AND full_name <> ''
   AND full_name ~ '[a-zA-Z]'
   AND (full_name = UPPER(full_name) OR full_name = LOWER(full_name));
