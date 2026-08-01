-- Migration 002 — keep the upstream chapter string alongside the repaired one.
--
-- The senior's MCQ endpoint (/api/v1/Report/MCQ) returns `Chapter` with its first
-- character missing, so the chapter serial number never reaches the downloaded
-- report ("1. Real Numbers" arrives as ". Real Numbers", "15. एक होती समई" as
-- "5. एक होती समई"). The ingest now repairs `chapter` from the video_usage
-- chapter catalogue and stores what upstream actually sent in `chapter_raw` —
-- nothing is lost, and the repair can be re-run from the original at any time.
--
-- `chapter` is widened because a multi-chapter attempt arrives as several names
-- glued together and is re-emitted as "1. A, 2. B, 3. C".
--
-- NOT idempotent on its own: MySQL has no portable "ADD COLUMN IF NOT EXISTS".
-- Prefer `npm run db:repair-chapters`, which applies this behind an
-- information_schema guard and then backfills existing rows.

ALTER TABLE mcq_report
  MODIFY COLUMN chapter VARCHAR(1024) NULL,
  ADD COLUMN chapter_raw VARCHAR(1024) NULL AFTER chapter;
