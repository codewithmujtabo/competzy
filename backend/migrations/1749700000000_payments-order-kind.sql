-- Migration: payments-order-kind (EMC Wave 9 Phase 4)
-- An order payment has no registration. Make payments.registration_id
-- nullable and add a `kind` discriminator so the settlement webhook can
-- branch registration-settlement vs order-settlement. A registration-kind
-- row must still carry a registration_id (the CHECK below).

ALTER TABLE payments ALTER COLUMN registration_id DROP NOT NULL;

ALTER TABLE payments ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'registration';

ALTER TABLE payments ADD CONSTRAINT payments_kind_check
  CHECK (kind IN ('registration', 'order'));

ALTER TABLE payments ADD CONSTRAINT payments_registration_kind_check
  CHECK (kind <> 'registration' OR registration_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_payments_kind ON payments(kind);
