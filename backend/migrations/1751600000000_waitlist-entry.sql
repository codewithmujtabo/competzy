-- Migration: waitlist_entry table — receives signups from the public
-- competzy-web landing-page subdomains (emc.competzy.com, komodo., …).
--
-- Contract: docs/arena-waitlist-spec.md (in the competzy-web repo).
-- Receiver lives at POST /api/waitlist. Optional shared-secret auth
-- (ARENA_WAITLIST_TOKEN). Admin UI at /admin/waitlist.
--
-- The UNIQUE(comp, email) constraint dedupes repeat signups per
-- competition. The receiver uses ON CONFLICT DO NOTHING so the
-- sender never sees a 409 — it just gets {ok: true} either way.

CREATE TABLE IF NOT EXISTS waitlist_entry (
  id                  SERIAL PRIMARY KEY,
  comp                TEXT NOT NULL,
  lang                TEXT,
  nama                TEXT NOT NULL,
  kelas               TEXT NOT NULL,
  kota                TEXT NOT NULL,
  email               TEXT NOT NULL,
  whatsapp            TEXT NOT NULL,
  submitted_at        TIMESTAMPTZ NOT NULL,
  source              TEXT NOT NULL,
  user_agent          TEXT,
  ip_hint             TEXT,
  is_voucher_winner   BOOLEAN NOT NULL DEFAULT false,
  voucher_code        TEXT,
  voucher_drawn_at    TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT waitlist_entry_comp_email_key UNIQUE (comp, email)
);

CREATE INDEX IF NOT EXISTS idx_waitlist_comp ON waitlist_entry (comp);
CREATE INDEX IF NOT EXISTS idx_waitlist_created ON waitlist_entry (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_waitlist_voucher ON waitlist_entry (is_voucher_winner) WHERE is_voucher_winner = true;
