-- Promote the handful of legacy `approved` registrations (predating the
-- pending_approval flow introduced in T28) to the current scheme so the
-- admin /registrations page can act on them and the status filter tabs
-- (All/Pending/Approved/Rejected) stop showing a dead column.
--
-- Mapping:
--   * Free comp (fee = 0)                          → 'paid'
--   * Paid comp with at least one settled payment  → 'paid'
--   * Paid comp with no settled payment            → 'registered'

-- Column-name fixes (2026-05-12):
--   r.competition_id  →  r.comp_id           (registrations.comp_id is the actual column)
--   p.status='settled' → p.payment_status='settlement'   (Midtrans's success label)

UPDATE registrations r
SET status = 'paid'
FROM competitions c
WHERE r.status = 'approved'
  AND r.comp_id = c.id
  AND COALESCE(c.fee, 0) = 0;

UPDATE registrations r
SET status = 'paid'
WHERE r.status = 'approved'
  AND EXISTS (
    SELECT 1 FROM payments p
    WHERE p.registration_id = r.id
      AND p.payment_status = 'settlement'
  );

UPDATE registrations r
SET status = 'registered'
WHERE r.status = 'approved';
