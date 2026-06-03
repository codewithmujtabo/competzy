-- SPRINT 37 — dated timeline. The student dashboard's "Rangkaian Kegiatan"
-- (activity timeline) shows each stage with a date range + a location/mode
-- (e.g. "25 May – 30 Sep 2026 · Online / Test Center"), matching the mentor
-- mockup, and the side panel's countdown targets a stage's date. competition_flows
-- only had title/description, so add the schedule fields. All nullable —
-- existing flows + comps with no scheduled dates render exactly as before.

ALTER TABLE competition_flows
  ADD COLUMN IF NOT EXISTS starts_on DATE,
  ADD COLUMN IF NOT EXISTS ends_on   DATE,
  ADD COLUMN IF NOT EXISTS location  TEXT;
