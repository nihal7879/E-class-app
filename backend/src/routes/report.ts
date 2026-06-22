import { Router } from "express";
import xlsx from "xlsx";
import { pool } from "../db.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { FilterQuerySchema, buildWhereClause } from "../lib/filters.js";

const router = Router();

/**
 * GET /api/report/export
 * Streams a single .xlsx workbook with three sheets — "Login History",
 * "Video Usage" and "MCQ Report" — mirroring the ingest sheet names. Every
 * sheet respects the active dashboard filters (institute, medium, school,
 * course, division, gender, date range) via the shared buildWhereClause.
 *
 * Columns are aliased to human-friendly headers in SQL; json_to_sheet uses the
 * object keys (in SELECT order) as the header row, so the ordering below is the
 * column ordering in Excel.
 */
router.get(
  "/export",
  asyncHandler(async (req, res) => {
    const filter = FilterQuerySchema.parse(req.query);

    // Login History — no course column on this dataset.
    const login = buildWhereClause(filter, {
      dateColumn: "lh.login_date",
      instituteColumn: "u.institute_id",
      mediumColumn: "u.medium_id",
      schoolColumn: "u.school",
      divisionColumn: "u.division",
      genderColumn: "u.gender",
    });
    const [loginRows] = await pool.query<any[]>(
      `SELECT
         u.enrollment_id  AS \`Enrollment ID\`,
         u.student_name   AS \`Student Name\`,
         u.user_kind      AS \`User Type\`,
         u.school         AS \`School\`,
         u.division       AS \`Division\`,
         u.gender         AS \`Gender\`,
         med.name         AS \`Medium\`,
         lh.login_date    AS \`Login Date\`,
         lh.login_time    AS \`Login Time\`,
         lh.logout_date   AS \`Logout Date\`,
         lh.logout_time   AS \`Logout Time\`,
         lh.session_time  AS \`Session Time\`
       FROM login_history lh
       JOIN users u ON u.user_id = lh.user_id
       LEFT JOIN mediums med ON med.medium_id = u.medium_id
       ${login.where}
       ORDER BY lh.login_date DESC, lh.login_time DESC`,
      login.params,
    );

    // Video Usage.
    const video = buildWhereClause(filter, {
      dateColumn: "vu.last_access_date",
      instituteColumn: "u.institute_id",
      mediumColumn: "u.medium_id",
      schoolColumn: "u.school",
      courseColumn: "vu.course",
      divisionColumn: "u.division",
      genderColumn: "u.gender",
    });
    const [videoRows] = await pool.query<any[]>(
      `SELECT
         u.enrollment_id        AS \`Enrollment ID\`,
         u.student_name         AS \`Student Name\`,
         u.user_kind            AS \`User Type\`,
         u.school               AS \`School\`,
         u.division             AS \`Division\`,
         u.gender               AS \`Gender\`,
         med.name               AS \`Medium\`,
         vu.course              AS \`Course\`,
         vu.subject             AS \`Subject\`,
         vu.chapter             AS \`Chapter\`,
         vu.content_name        AS \`Content Name\`,
         vu.content_type        AS \`Content Type\`,
         vu.total_view_duration AS \`Total View Duration\`,
         vu.total_view_count    AS \`Total View Count\`,
         vu.last_access_date    AS \`Last Access Date\`,
         vu.last_access_time    AS \`Last Access Time\`
       FROM video_usage vu
       JOIN users u ON u.user_id = vu.user_id
       LEFT JOIN mediums med ON med.medium_id = u.medium_id
       ${video.where}
       ORDER BY vu.last_access_date DESC, vu.last_access_time DESC`,
      video.params,
    );

    // MCQ Report.
    const mcq = buildWhereClause(filter, {
      dateColumn: "mr.attempted_date",
      instituteColumn: "u.institute_id",
      mediumColumn: "u.medium_id",
      schoolColumn: "u.school",
      courseColumn: "mr.course",
      divisionColumn: "u.division",
      genderColumn: "u.gender",
    });
    const [mcqRows] = await pool.query<any[]>(
      `SELECT
         u.enrollment_id       AS \`Enrollment ID\`,
         u.student_name        AS \`Student Name\`,
         u.user_kind           AS \`User Type\`,
         u.school              AS \`School\`,
         u.division            AS \`Division\`,
         u.gender              AS \`Gender\`,
         med.name              AS \`Medium\`,
         mr.course             AS \`Course\`,
         mr.subject            AS \`Subject\`,
         mr.chapter            AS \`Chapter\`,
         mr.total_question     AS \`Total Questions\`,
         mr.right_question_count AS \`Right Answers\`,
         mr.total_marks        AS \`Total Marks\`,
         mr.marks_obtained     AS \`Marks Obtained\`,
         mr.percentage         AS \`Percentage\`,
         mr.attempted_date     AS \`Attempted Date\`,
         mr.attempted_time     AS \`Attempted Time\`,
         mr.time_spent         AS \`Time Spent\`
       FROM mcq_report mr
       JOIN users u ON u.user_id = mr.user_id
       LEFT JOIN mediums med ON med.medium_id = u.medium_id
       ${mcq.where}
       ORDER BY mr.attempted_date DESC, mr.attempted_time DESC`,
      mcq.params,
    );

    // json_to_sheet on an empty array produces a blank sheet (no header row).
    // Seed a single empty-valued row off the known headers so an empty result
    // still shows the column titles instead of a blank tab.
    const sheet = (rows: any[], headers: string[]) =>
      rows.length > 0
        ? xlsx.utils.json_to_sheet(rows)
        : xlsx.utils.json_to_sheet([], { header: headers });

    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(
      wb,
      sheet(loginRows, [
        "Enrollment ID", "Student Name", "User Type", "School", "Division",
        "Gender", "Medium", "Login Date", "Login Time", "Logout Date",
        "Logout Time", "Session Time",
      ]),
      "Login History",
    );
    xlsx.utils.book_append_sheet(
      wb,
      sheet(videoRows, [
        "Enrollment ID", "Student Name", "User Type", "School", "Division",
        "Gender", "Medium", "Course", "Subject", "Chapter", "Content Name",
        "Content Type", "Total View Duration", "Total View Count",
        "Last Access Date", "Last Access Time",
      ]),
      "Video Usage",
    );
    xlsx.utils.book_append_sheet(
      wb,
      sheet(mcqRows, [
        "Enrollment ID", "Student Name", "User Type", "School", "Division",
        "Gender", "Medium", "Course", "Subject", "Chapter", "Total Questions",
        "Right Answers", "Total Marks", "Marks Obtained", "Percentage",
        "Attempted Date", "Attempted Time", "Time Spent",
      ]),
      "MCQ Report",
    );

    const buf = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="eclass-report.xlsx"',
    );
    res.send(buf);
  }),
);

export default router;
