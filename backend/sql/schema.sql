-- E-class Analytics — MySQL schema
-- Run this once against your MySQL instance after creating the database.
--
-- Usage from MySQL CLI:
--   CREATE DATABASE eclass_analytics CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
--   USE eclass_analytics;
--   SOURCE /path/to/backend/sql/schema.sql;
--
-- Or from MySQL Workbench: open this file, set the default schema to eclass_analytics, run.
  
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS sync_state;
DROP TABLE IF EXISTS mcq_report;
DROP TABLE IF EXISTS video_usage;
DROP TABLE IF EXISTS login_history;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS institutes;
DROP TABLE IF EXISTS mediums;
DROP TABLE IF EXISTS schools;

-- Institutes, mediums and schools are discovered dynamically during ingest (any
-- new InstituteID/MediumID/SchoolID seen in the live API is upserted here). No FK
-- from users on purpose — keeping these FK-free avoids insert-ordering constraints
-- during a batch load. `users.school` (the name) is retained alongside school_id
-- for display and because upstream only started emitting SchoolID later.
-- Every table carries the same audit columns:
--   created_on  — when the row was first written (drives date-based deletes/rollbacks)
--   updated_on  — auto-bumped on every change
--
-- DATETIME, deliberately, not TIMESTAMP. This DB is hosted on a server whose
-- clock is Pacific time, and a TIMESTAMP renders in the READING session's zone —
-- so the same row showed a different day in the app than in MySQL Workbench.
-- DATETIME is a literal wall-clock value nothing converts, so with the pool
-- pinned to +05:30 (src/db.ts) every client sees the same Indian time.
-- See sql/migrations/004_audit_datetime_ist.sql.
--   is_deleted  — soft-delete flag (0 = live)
--   is_active   — enable/disable flag (1 = active)
CREATE TABLE institutes (
  id           BIGINT       NOT NULL AUTO_INCREMENT UNIQUE,
  institute_id INT          NOT NULL PRIMARY KEY,
  name         VARCHAR(255) NULL,
  created_on   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_on   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  is_deleted   TINYINT(1)   NOT NULL DEFAULT 0,
  is_active    TINYINT(1)   NOT NULL DEFAULT 1,
  KEY idx_institutes_created (created_on)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE mediums (
  id        BIGINT       NOT NULL AUTO_INCREMENT UNIQUE,
  medium_id INT          NOT NULL PRIMARY KEY,
  name      VARCHAR(255) NULL,
  created_on DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_on DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  is_deleted TINYINT(1)   NOT NULL DEFAULT 0,
  is_active  TINYINT(1)   NOT NULL DEFAULT 1,
  KEY idx_mediums_created (created_on)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE schools (
  id        BIGINT       NOT NULL AUTO_INCREMENT UNIQUE,
  school_id INT          NOT NULL PRIMARY KEY,
  name      VARCHAR(255) NULL,
  created_on DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_on DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  is_deleted TINYINT(1)   NOT NULL DEFAULT 0,
  is_active  TINYINT(1)   NOT NULL DEFAULT 1,
  KEY idx_schools_created (created_on)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE users (
  id             BIGINT       NOT NULL AUTO_INCREMENT UNIQUE,
  user_id        INT          NOT NULL PRIMARY KEY,
  enrollment_id  VARCHAR(64)  NULL,
  student_name   VARCHAR(255) NULL,
  email_id       VARCHAR(255) NULL,
  gender         VARCHAR(32)  NULL,
  user_kind      ENUM('Student','Teacher') NOT NULL DEFAULT 'Student',
  school         VARCHAR(255) NULL,
  school_id      INT          NULL,
  division       VARCHAR(64)  NULL,
  institute_id   INT          NULL,
  medium_id      INT          NULL,
  created_on     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_on     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  is_deleted     TINYINT(1)   NOT NULL DEFAULT 0,
  is_active      TINYINT(1)   NOT NULL DEFAULT 1,
  UNIQUE KEY uq_enrollment (enrollment_id),
  KEY idx_school    (school),
  KEY idx_school_id (school_id),
  KEY idx_division  (division),
  KEY idx_gender    (gender),
  KEY idx_institute (institute_id),
  KEY idx_medium    (medium_id),
  KEY idx_users_created (created_on)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE login_history (
  id              BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id         INT          NOT NULL,
  upstream_id     VARCHAR(64)  NULL,       -- API `ID` (numeric for Login) — dedupe key
  login_date      DATE         NULL,
  login_time      TIME         NULL,       -- wall-clock H:MM:SS, e.g. '12:23:04'
  logout_date     DATE         NULL,
  logout_time     TIME         NULL,       -- wall-clock H:MM:SS
  session_time    TIME         NULL,       -- duration H:MM:SS, e.g. '01:14:32'
  created_on      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_on      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  is_deleted      TINYINT(1)   NOT NULL DEFAULT 0,
  is_active       TINYINT(1)   NOT NULL DEFAULT 1,
  KEY idx_login_user (user_id),
  KEY idx_login_date (login_date),
  KEY idx_login_created (created_on),
  UNIQUE KEY uq_login_upstream (upstream_id),
  CONSTRAINT fk_login_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE video_usage (
  id                      BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id                 INT          NOT NULL,
  upstream_id             VARCHAR(64)  NULL,          -- API `ID` (GUID) — dedupe key
  course                  VARCHAR(512) NULL,
  subject                 VARCHAR(512) NULL,
  chapter                 VARCHAR(512) NULL,
  content_name            VARCHAR(1024) NULL,
  content_type            VARCHAR(64)  NULL,
  total_view_duration     TIME         NULL,          -- duration H:MM:SS, e.g. '00:04:19'
  total_view_count        INT          NULL DEFAULT 0,
  last_access_date        DATE         NULL,
  last_access_time        TIME         NULL,          -- wall-clock H:MM:SS
  created_on              DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_on              DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  is_deleted              TINYINT(1)   NOT NULL DEFAULT 0,
  is_active               TINYINT(1)   NOT NULL DEFAULT 1,
  KEY idx_video_user        (user_id),
  KEY idx_video_course      (course),
  KEY idx_video_subject     (subject),
  KEY idx_video_last_access (last_access_date),
  KEY idx_video_created     (created_on),
  UNIQUE KEY uq_video_upstream (upstream_id),
  CONSTRAINT fk_video_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE mcq_report (
  id                    BIGINT        NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id               INT           NOT NULL,
  upstream_id           VARCHAR(64)   NULL,           -- API `ID` (GUID) — dedupe key
  course                VARCHAR(512)  NULL,
  subject               VARCHAR(512)  NULL,
  -- Repaired chapter name: the upstream MCQ endpoint drops the first character
  -- (killing the serial number) and glues multi-chapter attempts together, so
  -- the ingest rebuilds this from the video_usage chapter catalogue.
  -- See src/ingest/chapterRepair.ts and sql/migrations/002_mcq_chapter_raw.sql.
  chapter               VARCHAR(1024) NULL,
  chapter_raw           VARCHAR(1024) NULL,   -- exactly what upstream sent
  total_question        INT          NULL DEFAULT 0,
  right_question_count  INT          NULL DEFAULT 0,
  total_marks           INT          NULL DEFAULT 0,
  marks_obtained        INT          NULL DEFAULT 0,
  percentage            DECIMAL(5,2) NULL DEFAULT 0,
  attempted_date        DATE         NULL,
  attempted_time        TIME         NULL,           -- wall-clock H:MM:SS
  time_spent            TIME         NULL,           -- duration H:MM:SS
  created_on            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_on            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  is_deleted            TINYINT(1)   NOT NULL DEFAULT 0,
  is_active             TINYINT(1)   NOT NULL DEFAULT 1,
  KEY idx_mcq_user      (user_id),
  KEY idx_mcq_course    (course),
  KEY idx_mcq_subject   (subject),
  KEY idx_mcq_attempted (attempted_date),
  KEY idx_mcq_created   (created_on),
  UNIQUE KEY uq_mcq_upstream (upstream_id),
  CONSTRAINT fk_mcq_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Cursor state for the incremental API sync. See sql/migrations/003_sync_state.sql
-- for the full rationale: the API's fromDate/toDate window filters on an upstream
-- sync timestamp rather than on the row's own date, so the ingest walks a cursor
-- (`NextStartDate`) per report instead of replacing a day at a time.
CREATE TABLE sync_state (
  report          VARCHAR(32)  NOT NULL PRIMARY KEY,   -- 'logins' | 'videos' | 'mcq'
  next_start_date DATETIME     NULL,                   -- cursor for the next run
  last_sync_at    DATETIME     NULL,
  last_status     VARCHAR(512) NULL,
  rows_last_sync  INT          NOT NULL DEFAULT 0,
  pages_last_sync INT          NOT NULL DEFAULT 0,
  created_on      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_on      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  is_deleted      TINYINT(1)   NOT NULL DEFAULT 0,
  is_active       TINYINT(1)   NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
