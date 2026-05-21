-- Multi-currency round pricing.
-- `competition_rounds.fee` (INTEGER, IDR) is the local price an Indonesian
-- student pays via Midtrans. Adds `fee_international` (NUMERIC, USD) — the
-- price a non-Indonesian student sees. For now USD is display-only: there's
-- no Midtrans path for non-IDR, so international students contact the
-- organizer to settle. Nullable means "no international price configured" —
-- the round is then implicitly local-only.

ALTER TABLE competition_rounds
  ADD COLUMN IF NOT EXISTS fee_international NUMERIC(10, 2);
