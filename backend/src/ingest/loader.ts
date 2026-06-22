import type { PoolConnection } from "mysql2/promise";
import { pool } from "../db.js";
import type { IngestBatch } from "./types.js";

export type IngestMode = "replace" | "append" | "daily";

export interface LoadOptions {
  mode: IngestMode;
  date?: string; // required for 'daily' — YYYY-MM-DD; the day whose rows are replaced
}

export interface LoadResult {
  users: number;
  logins: number;
  videos: number;
  mcq: number;
  institutes: number;
  mediums: number;
  schools: number;
  mode: IngestMode;
}

/**
 * Writes a normalized IngestBatch to MySQL inside one transaction.
 *
 *  - 'append' (default): keep existing rows. UPSERT users on user_id (latest non-null
 *                        values win). INSERT logins/videos/mcq with no dedupe. Right
 *                        for monthly increments — Jan stays when you load Feb.
 *                        WARNING: re-ingesting the same xlsx duplicates login/video/mcq
 *                        rows. Each export should contain only new data.
 *  - 'replace':          TRUNCATE users / login_history / video_usage / mcq_report,
 *                        then INSERT everything fresh from the batch. Use when
 *                        re-bootstrapping the DB from a single full export.
 *                        (institutes / mediums are a slowly-accumulating dimension
 *                        and are NOT truncated — only upserted.)
 *  - 'daily':            idempotent single-day load (the cron's mode). DELETE the
 *                        given date's rows from login_history / video_usage /
 *                        mcq_report, then INSERT — so re-running the same day never
 *                        duplicates. Users / institutes / mediums are upserted.
 */
export async function loadBatch(
  batch: IngestBatch,
  opts: LoadOptions = { mode: "append" },
): Promise<LoadResult> {
  const { mode } = opts;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    if (mode === "replace") {
      await conn.query("SET FOREIGN_KEY_CHECKS = 0");
      await conn.query("TRUNCATE TABLE login_history");
      await conn.query("TRUNCATE TABLE video_usage");
      await conn.query("TRUNCATE TABLE mcq_report");
      await conn.query("TRUNCATE TABLE users");
      await conn.query("SET FOREIGN_KEY_CHECKS = 1");
    } else if (mode === "daily") {
      if (!opts.date) throw new Error("daily mode requires opts.date (YYYY-MM-DD)");
      // Re-loading a day: delete that day's rows then re-insert. AUTO_INCREMENT
      // is intentionally NOT reset — ids keep climbing as new data arrives.
      await conn.query("DELETE FROM login_history WHERE login_date = ?", [opts.date]);
      await conn.query("DELETE FROM video_usage   WHERE last_access_date = ?", [opts.date]);
      await conn.query("DELETE FROM mcq_report     WHERE attempted_date = ?", [opts.date]);
    }

    if (batch.institutes.length > 0) await upsertInstitutes(conn, batch);
    if (batch.mediums.length > 0)    await upsertMediums(conn, batch);
    if (batch.schools.length > 0)    await upsertSchools(conn, batch);
    if (batch.users.length > 0)      await upsertUsers(conn, batch);

    if (batch.logins.length > 0) await insertLogins(conn, batch);
    if (batch.videos.length > 0) await insertVideos(conn, batch);
    if (batch.mcq.length > 0)    await insertMcq(conn, batch);

    await conn.commit();
    return {
      users:      batch.users.length,
      logins:     batch.logins.length,
      videos:     batch.videos.length,
      mcq:        batch.mcq.length,
      institutes: batch.institutes.length,
      mediums:    batch.mediums.length,
      schools:    batch.schools.length,
      mode,
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function upsertInstitutes(conn: PoolConnection, batch: IngestBatch): Promise<void> {
  const sql =
    `INSERT INTO institutes (institute_id, name) VALUES ?
     ON DUPLICATE KEY UPDATE name = COALESCE(VALUES(name), name)`;
  for (const chunk of chunked(batch.institutes, 500)) {
    await conn.query(sql, [chunk.map((i) => [i.id, i.name])]);
  }
}

async function upsertMediums(conn: PoolConnection, batch: IngestBatch): Promise<void> {
  const sql =
    `INSERT INTO mediums (medium_id, name) VALUES ?
     ON DUPLICATE KEY UPDATE name = COALESCE(VALUES(name), name)`;
  for (const chunk of chunked(batch.mediums, 500)) {
    await conn.query(sql, [chunk.map((m) => [m.id, m.name])]);
  }
}

async function upsertSchools(conn: PoolConnection, batch: IngestBatch): Promise<void> {
  const sql =
    `INSERT INTO schools (school_id, name) VALUES ?
     ON DUPLICATE KEY UPDATE name = COALESCE(VALUES(name), name)`;
  for (const chunk of chunked(batch.schools, 500)) {
    await conn.query(sql, [chunk.map((s) => [s.id, s.name])]);
  }
}

async function upsertUsers(conn: PoolConnection, batch: IngestBatch): Promise<void> {
  const sql =
    `INSERT INTO users
       (user_id, enrollment_id, student_name, email_id, gender, user_kind, school, school_id, division,
        institute_id, medium_id)
     VALUES ?
     ON DUPLICATE KEY UPDATE
       enrollment_id = COALESCE(VALUES(enrollment_id), enrollment_id),
       student_name  = COALESCE(VALUES(student_name),  student_name),
       email_id      = COALESCE(VALUES(email_id),      email_id),
       gender        = COALESCE(VALUES(gender),        gender),
       user_kind     = COALESCE(VALUES(user_kind),     user_kind),
       school        = COALESCE(VALUES(school),        school),
       school_id     = COALESCE(VALUES(school_id),     school_id),
       division      = COALESCE(VALUES(division),      division),
       institute_id  = COALESCE(VALUES(institute_id),  institute_id),
       medium_id     = COALESCE(VALUES(medium_id),     medium_id)`;

  for (const chunk of chunked(batch.users, 500)) {
    const values = chunk.map((u) => [
      u.userId,
      u.enrollmentId,
      u.studentName,
      u.emailId,
      u.gender,
      u.userKind ?? "Student",
      u.school,
      u.schoolId,
      u.division,
      u.instituteId,
      u.mediumId,
    ]);
    await conn.query(sql, [values]);
  }
}

async function insertLogins(conn: PoolConnection, batch: IngestBatch): Promise<void> {
  const sql =
    `INSERT INTO login_history
       (user_id, login_date, login_time, logout_date, logout_time, session_time)
     VALUES ?`;
  for (const chunk of chunked(batch.logins, 1000)) {
    const values = chunk.map((r) => [
      r.userId, r.loginDate, r.loginTime, r.logoutDate, r.logoutTime, r.sessionTime,
    ]);
    await conn.query(sql, [values]);
  }
}

async function insertVideos(conn: PoolConnection, batch: IngestBatch): Promise<void> {
  const sql =
    `INSERT INTO video_usage
       (user_id, course, subject, chapter, content_name, content_type,
        total_view_duration, total_view_count, last_access_date, last_access_time)
     VALUES ?`;
  for (const chunk of chunked(batch.videos, 1000)) {
    const values = chunk.map((r) => [
      r.userId, r.course, r.subject, r.chapter, r.contentName, r.contentType,
      r.totalViewDuration, r.totalViewCount, r.lastAccessDate, r.lastAccessTime,
    ]);
    await conn.query(sql, [values]);
  }
}

async function insertMcq(conn: PoolConnection, batch: IngestBatch): Promise<void> {
  const sql =
    `INSERT INTO mcq_report
       (user_id, course, subject, chapter,
        total_question, right_question_count, total_marks, marks_obtained, percentage,
        attempted_date, attempted_time, time_spent)
     VALUES ?`;
  for (const chunk of chunked(batch.mcq, 1000)) {
    const values = chunk.map((r) => [
      r.userId, r.course, r.subject, r.chapter,
      r.totalQuestion, r.rightQuestionCount, r.totalMarks, r.marksObtained, r.percentage,
      r.attemptedDate, r.attemptedTime, r.timeSpent,
    ]);
    await conn.query(sql, [values]);
  }
}

function chunked<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
