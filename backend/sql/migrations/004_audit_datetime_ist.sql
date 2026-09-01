-- Migration 004 — audit timestamps read as Indian time in EVERY client.
--
-- Run it with `npm run db:audit-ist`, not by hand. The script pins the session
-- to +05:30 first, and that session zone is what decides the converted values —
-- running these statements in the server's own (Pacific) session would store
-- Pacific wall-clock text and bake the bug in permanently.
--
-- ── Why ─────────────────────────────────────────────────────────────────────
-- This database is on shared hosting whose clock is Pacific time
-- (`@@system_time_zone = 'Pacific Daylight Time'`). A TIMESTAMP column stores an
-- instant as UTC and renders it in the READING session's zone, so one row read
-- 2026-09-01 11:33 through the app (which sets +05:30 per connection) and
-- 2026-08-31 23:03 in MySQL Workbench — a day earlier, same row, same value.
--
-- The server itself cannot be corrected: `SET GLOBAL time_zone` is denied here
-- (no SUPER / SYSTEM_VARIABLES_ADMIN on shared hosting), and named zones are
-- rejected too ("Unknown or incorrect time zone: 'Asia/Kolkata'") because the
-- mysql.time_zone tables aren't populated.
--
-- DATETIME is a literal wall-clock value that MySQL never converts on read. Once
-- the stored text is IST, every client agrees: the app, Workbench, phpMyAdmin,
-- exports. That is the same OUTCOME the employee-app database gets for free by
-- happening to sit on a server whose clock is already IST.
--
-- ── Safety ──────────────────────────────────────────────────────────────────
-- No arithmetic and no data rewrite: MySQL renders each TIMESTAMP through the
-- session zone as it converts, so pinning +05:30 does the shift in one pass.
-- Exactly reversible — `npm run db:audit-ist -- --revert` converts back in the
-- same session zone and restores the originals. DATETIME's range (1000–9999) is
-- wider than TIMESTAMP's (1970–2038), so nothing can overflow.
--
-- The `*_bak_YYYYMMDD` snapshot tables are deliberately NOT converted; a backup
-- should stay as it was taken. `--include-backups` converts them if one is ever
-- restored into the live schema.

SET time_zone = '+05:30';   -- MUST come first: this zone defines the result

ALTER TABLE institutes
  MODIFY COLUMN created_on DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  MODIFY COLUMN updated_on DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

ALTER TABLE mediums
  MODIFY COLUMN created_on DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  MODIFY COLUMN updated_on DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

ALTER TABLE schools
  MODIFY COLUMN created_on DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  MODIFY COLUMN updated_on DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

ALTER TABLE users
  MODIFY COLUMN created_on DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  MODIFY COLUMN updated_on DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

ALTER TABLE login_history
  MODIFY COLUMN created_on DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  MODIFY COLUMN updated_on DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

ALTER TABLE video_usage
  MODIFY COLUMN created_on DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  MODIFY COLUMN updated_on DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

ALTER TABLE mcq_report
  MODIFY COLUMN created_on DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  MODIFY COLUMN updated_on DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

ALTER TABLE sync_state
  MODIFY COLUMN created_on DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  MODIFY COLUMN updated_on DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;
