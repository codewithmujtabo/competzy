-- Migration: add `heard_from` marketing-attribution column to waitlist_entry.
--
-- Per spec update in competzy-web/docs/arena-waitlist-spec.md (commit 73cbbfc):
-- captures "How did you hear about us?" as a closed-enum channel string,
-- nullable so legacy entries (and other comps that haven't added the field
-- to their form yet) keep working. EMC's form requires it; arena does not.

ALTER TABLE waitlist_entry
  ADD COLUMN IF NOT EXISTS heard_from TEXT;

CREATE INDEX IF NOT EXISTS idx_waitlist_heard_from ON waitlist_entry (heard_from);
