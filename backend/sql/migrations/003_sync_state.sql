-- Migration 003 — cursor-based sync: upstream row ids + the sync watermark.
--
-- The reporting API (dashboard1.sundarameclass.com) changed shape. Every report
-- now answers with an envelope instead of a bare array:
--
--   { "Data": [ … ], "NextStartDate": "2026-06-13T15:21:23",
--     "ToDate": "2026-06-14T23:59:59", "NextSync": false }
--
-- Two consequences drive this migration:
--
-- 1. Every record now carries an `ID` — numeric for Login, a GUID for VideoUsage
--    and MCQ. `upstream_id` stores it as the natural key so re-ingesting the same
--    row updates instead of duplicating. This is not optional: consecutive pages
--    OVERLAP (measured: 7 rows repeated between page 1 and page 2 of Login), so
--    plain INSERTs would duplicate on every single sync.
--
--    VARCHAR(64) holds both forms. NULL is allowed and MySQL permits many NULLs
--    in a UNIQUE index, so rows loaded before this migration keep working — they
--    simply don't participate in dedupe.
--
-- 2. The fromDate/toDate window filters on an upstream sync timestamp, NOT on
--    LoginDate/LastAccessDate/AttemptedDate. A single call for 2026-04-14..06-14
--    returned 1803 rows of which 896 had a LoginDate outside that window, some
--    going back to 2014. So the ingest can no longer "replace one day"; it tracks
--    a cursor per report in `sync_state` and upserts whatever arrives against each
--    row's own date.
--
-- NOT idempotent on its own: MySQL has no portable "ADD COLUMN IF NOT EXISTS".
-- Run `npm run db:migrate-sync`, which applies all of this behind
-- information_schema guards and is safe to re-run.

ALTER TABLE login_history
  ADD COLUMN upstream_id VARCHAR(64) NULL AFTER user_id,
  ADD UNIQUE KEY uq_login_upstream (upstream_id);

ALTER TABLE video_usage
  ADD COLUMN upstream_id VARCHAR(64) NULL AFTER user_id,
  ADD UNIQUE KEY uq_video_upstream (upstream_id);

ALTER TABLE mcq_report
  ADD COLUMN upstream_id VARCHAR(64) NULL AFTER user_id,
  ADD UNIQUE KEY uq_mcq_upstream (upstream_id);

-- One row per report. `next_start_date` is the cursor handed back by the API as
-- `NextStartDate`; the next sync resumes from it. It is only advanced AFTER the
-- page's rows are committed, so a crash re-fetches that page rather than skipping
-- it — at-least-once delivery, made safe by the upstream_id dedupe above.
CREATE TABLE IF NOT EXISTS sync_state (
  report          VARCHAR(32)  NOT NULL PRIMARY KEY,   -- 'logins' | 'videos' | 'mcq'
  next_start_date DATETIME     NULL,                   -- cursor for the next run
  last_sync_at    DATETIME     NULL,                   -- when the last run finished
  last_status     VARCHAR(512) NULL,                   -- 'ok' or the error message
  rows_last_sync  INT          NOT NULL DEFAULT 0,
  pages_last_sync INT          NOT NULL DEFAULT 0,
  created_on      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_on      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  is_deleted      TINYINT(1)   NOT NULL DEFAULT 0,
  is_active       TINYINT(1)   NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
