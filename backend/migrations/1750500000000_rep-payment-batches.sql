-- Migration: rep-payment-batches (Komodo Wave 2 — Phase C follow-up)
-- A country representative pays the local-round fee for many of their students
-- in one Midtrans transaction. The batch records the covered registrations so
-- both the payment webhook and the verify poll can settle them all at once.

CREATE TABLE IF NOT EXISTS rep_payment_batches (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comp_id          TEXT NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  round_id         TEXT REFERENCES competition_rounds(id) ON DELETE SET NULL,
  created_by       UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  registration_ids TEXT[] NOT NULL,
  total_amount     INTEGER NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'paid', 'expired', 'cancelled')),
  order_id         TEXT,
  snap_token       TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rep_payment_batches_order ON rep_payment_batches(order_id);
CREATE INDEX IF NOT EXISTS idx_rep_payment_batches_creator ON rep_payment_batches(created_by);
