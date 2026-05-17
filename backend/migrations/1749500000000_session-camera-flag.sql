-- Migration: session-camera-flag (EMC Wave 8)
-- Best-effort webcam proctoring. Records whether the student's browser granted
-- camera access for an online exam attempt:
--   NULL  — unknown (the player never resolved it, or a pre-Wave-8 session)
--   true  — camera granted; snapshots were captured
--   false — camera denied / unavailable; the exam proceeded without proctoring

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS camera_available BOOLEAN;
