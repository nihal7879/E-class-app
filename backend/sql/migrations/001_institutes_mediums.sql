-- Migration 001 — institutes, mediums, and the user columns that reference them.
--
-- Idempotent: the CREATE TABLE statements use IF NOT EXISTS. The
-- `users.institute_id` / `users.medium_id` columns are added by the bootstrap
-- script (src/scripts/bootstrap-dev-db.ts) with an information_schema guard,
-- because MySQL has no portable "ALTER TABLE ... ADD COLUMN IF NOT EXISTS".

CREATE TABLE IF NOT EXISTS institutes (
  institute_id INT          NOT NULL PRIMARY KEY,
  name         VARCHAR(255) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS mediums (
  medium_id INT          NOT NULL PRIMARY KEY,
  name      VARCHAR(255) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
