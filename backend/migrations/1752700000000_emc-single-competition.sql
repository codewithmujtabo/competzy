-- EMC becomes a single-competition (activity-timeline flow), not a multi-round catalog.
--
-- Mentor directive: a newly-signed-up EMC participant should land on the
-- step-by-step Activity Timeline (like "EMC — Mathematics Competition Final"),
-- NOT the "Competition rounds" catalog. The catalog renders only because EMC
-- carries a single "Round 1". Hiding that round (is_active=false) makes the
-- dashboard see 0 rounds and fall through to the flow/Stepper timeline path
-- (web dashboard filters `r.isActive !== false`; checkRoundGating rejects it),
-- with zero hard deletes and full reversibility.
--
-- Decisions (confirmed with the user):
--   * EMC registration fee = Rp65.000 (the old Round 1 fee), now at the
--     competition level since registration is whole-competition.
--   * The round's existing registrations (none paid) are converted to
--     whole-competition: redundant round rows for users who already hold a
--     whole-competition registration are soft-deleted (dedup), the rest have
--     round_id cleared. uq_registrations_user_comp_round only constrains
--     round_id IS NOT NULL, so clearing round_id can never collide.
-- Idempotent: re-running is a no-op once the round is inactive / fee is set.

BEGIN;

-- 1. Competition-level fee = the former Round 1 fee.
UPDATE competitions SET fee = 65000 WHERE slug = 'emc';

-- 2. Dedup: soft-delete EMC round registrations whose user already holds a live
--    whole-competition (round_id IS NULL) registration for EMC.
UPDATE registrations r
   SET deleted_at = now()
 WHERE r.comp_id = (SELECT id FROM competitions WHERE slug = 'emc')
   AND r.round_id IS NOT NULL
   AND r.deleted_at IS NULL
   AND EXISTS (
     SELECT 1 FROM registrations w
      WHERE w.comp_id = r.comp_id
        AND w.user_id = r.user_id
        AND w.round_id IS NULL
        AND w.deleted_at IS NULL
   );

-- 3. Convert the remaining EMC round registrations to whole-competition.
UPDATE registrations r
   SET round_id = NULL
 WHERE r.comp_id = (SELECT id FROM competitions WHERE slug = 'emc')
   AND r.round_id IS NOT NULL
   AND r.deleted_at IS NULL;

-- 4. Hide every EMC round from students -> dashboard sees 0 rounds -> timeline.
UPDATE competition_rounds
   SET is_active = false
 WHERE comp_id = (SELECT id FROM competitions WHERE slug = 'emc');

COMMIT;
