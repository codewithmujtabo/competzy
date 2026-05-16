-- Migration: competition-flows (Wave 4 Phase 2)
-- Per-competition ordered step-flow — the config behind the student
-- dashboard's guided progression. One row per step; `check_type` maps the
-- step to a readiness check, or `none` for an info-only milestone.
-- Multi-tenant (comp_id) + soft-delete, matching the Wave 1 EMC pattern.

CREATE TABLE IF NOT EXISTS competition_flows (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comp_id     TEXT NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  step_order  INTEGER NOT NULL,
  step_key    TEXT NOT NULL,
  title       TEXT NOT NULL,
  description TEXT,
  check_type  TEXT NOT NULL DEFAULT 'none'
              CHECK (check_type IN ('profile','documents','payment','approval','none')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);

-- One live step per (comp, order); index the comp lookup.
CREATE UNIQUE INDEX IF NOT EXISTS idx_competition_flows_comp_order
  ON competition_flows(comp_id, step_order) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_competition_flows_comp_live
  ON competition_flows(comp_id) WHERE deleted_at IS NULL;

-- Seed the default 6-step flow for the EMC 2026 competition. Keyed on the
-- stable `slug` (the competition's TEXT id differs per environment). Ordered
-- to the real registration lifecycle: register → review → pay → exam → results.
-- Idempotent: skips if the competition is absent or already has a flow.
INSERT INTO competition_flows (comp_id, step_order, step_key, title, description, check_type)
SELECT c.id, v.step_order, v.step_key, v.title, v.description, v.check_type
  FROM competitions c
 CROSS JOIN (VALUES
    (1, 'profile',   'Complete your profile',     'Fill in your name, contact details, school and grade.',   'profile'),
    (2, 'documents', 'Upload required documents', 'Upload every document the competition asks for.',         'documents'),
    (3, 'review',    'Registration review',       'An organizer reviews and confirms your registration.',    'approval'),
    (4, 'payment',   'Pay the registration fee',  'Complete payment to lock in your seat.',                  'payment'),
    (5, 'exam',      'Sit the exam',              'Take the exam on the scheduled date.',                    'none'),
    (6, 'results',   'View your results',         'Results and your certificate arrive after grading.',      'none')
  ) AS v(step_order, step_key, title, description, check_type)
 WHERE c.slug = 'emc-2026'
   AND NOT EXISTS (SELECT 1 FROM competition_flows f WHERE f.comp_id = c.id);
