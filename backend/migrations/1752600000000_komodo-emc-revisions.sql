-- Komodo + EMC registration-flow revisions (mentor doc, June 2026).
-- Applied by slug — the competitions' TEXT ids are environment-specific. Safe
-- on a fresh DB (seeds run after migrations, so these affect 0 rows then; the
-- updated seeds create the rows in the same shape). On an existing DB it fixes
-- the live rows without a destructive re-seed.

-- 1) Komodo qualification-round fees → Rp250.000 / USD20. The Bali Global Round
--    (round_category='global') is a separate finals fee and is left untouched.
UPDATE competition_rounds
   SET fee = 250000, fee_international = 20
 WHERE comp_id = (SELECT id FROM competitions WHERE slug = 'komodo')
   AND round_category IN ('online', 'fast_track', 'local');

-- 2) Required-before-payment profile fields — the core 7 — for Komodo (adds the
--    previously-missing "city") and EMC (was empty, so EMC now routes the
--    student to complete/confirm data before payment).
UPDATE competitions
   SET required_profile_fields =
     '["fullName","email","phone","dateOfBirth","country","city","schoolName"]'::jsonb
 WHERE slug IN ('komodo', 'emc');

-- 3) EMC activity timeline — rebuild to the mentor's full stage list:
--    Registration -> Exam Simulation -> City-Level -> Provincial-Level ->
--    National Finalist Re-registration -> National-Level. Hard-delete the
--    existing EMC steps first (avoids the (comp_id, step_order) live-unique
--    collision), then re-insert. starts_on/ends_on are DATE columns so no
--    timezone shift; dates are relative to deploy time.
DELETE FROM competition_flows
 WHERE comp_id = (SELECT id FROM competitions WHERE slug = 'emc');

INSERT INTO competition_flows
  (comp_id, step_order, step_key, title, title_id, description, description_id,
   check_type, starts_on, ends_on, location)
SELECT c.id, v.step_order, v.step_key, v.title, v.title_id, v.description,
       v.description_id, v.check_type, v.starts_on, v.ends_on, v.location
  FROM competitions c
  CROSS JOIN (VALUES
    (1, 'registration', 'Registration', 'Pendaftaran',
        'Complete your registration form and pay the fee to activate your participant card.',
        'Lengkapi formulir pendaftaran dan bayar biayanya untuk mengaktifkan kartu pesertamu.',
        'payment', (now() - interval '5 days')::date, (now() + interval '55 days')::date,
        'Online / Test Center'),
    (2, 'simulation', 'Exam Simulation', 'Simulasi Ujian',
        'A practice run to learn the exam interface. Your simulation score does not affect any round.',
        'Latihan untuk mengenal antarmuka ujian. Nilai simulasi tidak memengaruhi babak mana pun.',
        'none', (now() + interval '63 days')::date, NULL, 'Online'),
    (3, 'city', 'City-Level Exam', 'Ujian Tingkat Kota',
        'The city/regency qualifying round, held online.',
        'Babak penyisihan tingkat kota/kabupaten, daring.',
        'none', (now() + interval '70 days')::date, NULL, 'Online'),
    (4, 'provincial', 'Provincial-Level Exam', 'Ujian Tingkat Provinsi',
        'The provincial round, for participants who pass the city level.',
        'Babak provinsi, untuk peserta yang lolos tingkat kota.',
        'none', (now() + interval '84 days')::date, NULL, 'Online'),
    (5, 'national_reregistration', 'National Finalist Re-registration',
        'Daftar Ulang Finalist Nasional',
        'National finalists confirm attendance and re-register for the national exam.',
        'Finalis nasional mengonfirmasi kehadiran dan mendaftar ulang untuk ujian nasional.',
        'none', (now() + interval '100 days')::date, (now() + interval '107 days')::date,
        'Online'),
    (6, 'national', 'National-Level Exam', 'Ujian Tingkat Nasional',
        'The offline national final at a Test Center, for national finalists.',
        'Final nasional luring di Test Center, untuk finalis nasional.',
        'none', (now() + interval '112 days')::date, NULL, 'Offline · Test Center')
  ) AS v(step_order, step_key, title, title_id, description, description_id,
         check_type, starts_on, ends_on, location)
 WHERE c.slug = 'emc';
