-- Migration: email broadcast system (kirim.email-style campaigns on Resend).
--
-- email_broadcasts is the campaign envelope; email_broadcast_recipients is
-- the per-recipient send ledger, snapshotted from the audience at send time
-- so progress/failures are resumable across restarts and countable exactly.
-- The background processor (broadcast.service.ts) drains pending recipients
-- in batches via the Resend batch API (SMTP fallback).

CREATE TABLE email_broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  html TEXT NOT NULL,
  -- {kind: 'all_students'|'all_parents'|'all_teachers'|'all_users'|'competition'|'lapsed',
  --  compId?: text, paidOnly?: boolean}
  audience JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sending', 'sent', 'failed', 'cancelled')),
  total_recipients INT NOT NULL DEFAULT 0,
  sent_count INT NOT NULL DEFAULT 0,
  failed_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ
);

CREATE TABLE email_broadcast_recipients (
  id BIGSERIAL PRIMARY KEY,
  broadcast_id UUID NOT NULL REFERENCES email_broadcasts(id) ON DELETE CASCADE,
  user_id UUID,
  email TEXT NOT NULL,
  full_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  error TEXT,
  sent_at TIMESTAMPTZ
);

-- The processor's hot path: "next batch of pending recipients for a broadcast".
CREATE INDEX idx_ebr_pending ON email_broadcast_recipients (broadcast_id, id)
  WHERE status = 'pending';

CREATE INDEX idx_eb_status ON email_broadcasts (status);
