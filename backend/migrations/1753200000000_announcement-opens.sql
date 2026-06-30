-- Announcement open tracking — one row per (announcement, student) the first
-- time they view it in a feed. Powers the operator "opens + open rate" metric
-- (unique opens ÷ reach). Mirrors the referral `clicks` funnel pattern, but the
-- composite PK makes opens unique per student (re-opening is a no-op).

CREATE TABLE IF NOT EXISTS announcement_opens (
  announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  opened_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (announcement_id, user_id)
);

-- Count opens per announcement (operator analytics query).
CREATE INDEX IF NOT EXISTS idx_announcement_opens_ann ON announcement_opens(announcement_id);
