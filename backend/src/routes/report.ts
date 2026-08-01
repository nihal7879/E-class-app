import { Router } from "express";
// xlsx-js-style is a drop-in, API-compatible fork of SheetJS that actually
// honours cell styles (`cell.s`) on write — the community `xlsx` build ignores
// them, so bold headers would have no effect there.
import xlsx from "xlsx-js-style";
import { pool } from "../db.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { FilterQuerySchema, buildWhereClause } from "../lib/filters.js";

// Shared header style: bold white text on a slate-blue fill.
const HEADER_STYLE = {
  font: { bold: true, color: { rgb: "FFFFFF" } },
  fill: { patternType: "solid", fgColor: { rgb: "1E3A5F" } },
  alignment: { vertical: "center" },
} as const;

// Column width bounds for the auto-fit below. Chapter and content names in the
// video sheet are long Marathi/Hindi titles, so the ceiling stops one column
// from pushing every other column off screen.
const MIN_COL_WIDTH = 10;
const MAX_COL_WIDTH = 42;

/**
 * Finish a worksheet before it goes into the workbook: styled header row,
 * AutoFilter on the header, and auto-fitted column widths.
 *
 * The AutoFilter is not just cosmetic. Without it the only way to sort a
 * downloaded sheet is to select a bare column and sort that — and Google Sheets
 * (unlike Excel, which prompts to expand the selection) reorders that column
 * ALONE with no warning. That silently shears "Enrollment ID" away from the rest
 * of its row, so rows appear to belong to the wrong student while every other
 * value stays put. Sorting through the header dropdown always moves whole rows.
 */
function finishSheet(ws: xlsx.WorkSheet): void {
  const ref = ws["!ref"] ?? "A1";
  const range = xlsx.utils.decode_range(ref);

  for (let c = range.s.c; c <= range.e.c; c++) {
    const addr = xlsx.utils.encode_cell({ r: range.s.r, c });
    const cell = ws[addr];
    if (cell) cell.s = { ...(cell.s ?? {}), ...HEADER_STYLE };
  }

  ws["!autofilter"] = { ref };

  // Width from the widest rendered value per column — `w` is the formatted text
  // when SheetJS produced one, otherwise fall back to the raw value.
  const cols: Array<{ wch: number }> = [];
  for (let c = range.s.c; c <= range.e.c; c++) {
    let widest = 0;
    for (let r = range.s.r; r <= range.e.r; r++) {
      const cell = ws[xlsx.utils.encode_cell({ r, c })];
      if (!cell) continue;
      const text = cell.w ?? String(cell.v ?? "");
      if (text.length > widest) widest = text.length;
    }
    cols.push({
      wch: Math.min(MAX_COL_WIDTH, Math.max(MIN_COL_WIDTH, widest + 2)),
    });
  }
  ws["!cols"] = cols;
}

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

    // Login History — no course/subject column on this dataset, so a course or
    // subject filter is applied via student membership (keep only logins of users
    // active in the selected course/subject) so this sheet also reflects the
    // current drill-down instead of dumping every student's logins.
    const login = buildWhereClause(filter, {
      dateColumn: "lh.login_date",
      instituteColumn: "u.institute_id",
      mediumColumn: "u.medium_id",
      schoolColumn: "u.school",
      courseUserColumn: "lh.user_id",
      subjectUserColumn: "lh.user_id",
      divisionColumn: "u.division",
      genderColumn: "u.gender",
    });
    const loginQ = pool.query<any[]>(
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
      subjectColumn: "vu.subject",
      divisionColumn: "u.division",
      genderColumn: "u.gender",
    });
    const videoQ = pool.query<any[]>(
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
      subjectColumn: "mr.subject",
      divisionColumn: "u.division",
      genderColumn: "u.gender",
    });
    const mcqQ = pool.query<any[]>(
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

    // The three sheet queries are independent — run them concurrently so the
    // export waits on the slowest query, not the sum of all three.
    const [[loginRows], [videoRows], [mcqRows]] = await Promise.all([
      loginQ,
      videoQ,
      mcqQ,
    ]);

    // json_to_sheet on an empty array produces a blank sheet (no header row).
    // Seed a single empty-valued row off the known headers so an empty result
    // still shows the column titles instead of a blank tab.
    const sheet = (rows: any[], headers: string[]) =>
      rows.length > 0
        ? xlsx.utils.json_to_sheet(rows)
        : xlsx.utils.json_to_sheet([], { header: headers });

    const wb = xlsx.utils.book_new();

    const loginWs = sheet(loginRows, [
      "Enrollment ID", "Student Name", "User Type", "School", "Division",
      "Gender", "Medium", "Login Date", "Login Time", "Logout Date",
      "Logout Time", "Session Time",
    ]);
    finishSheet(loginWs);
    xlsx.utils.book_append_sheet(wb, loginWs, "Login History");

    const videoWs = sheet(videoRows, [
      "Enrollment ID", "Student Name", "User Type", "School", "Division",
      "Gender", "Medium", "Course", "Subject", "Chapter", "Content Name",
      "Content Type", "Total View Duration", "Total View Count",
      "Last Access Date", "Last Access Time",
    ]);
    finishSheet(videoWs);
    xlsx.utils.book_append_sheet(wb, videoWs, "Video Usage");

    const mcqWs = sheet(mcqRows, [
      "Enrollment ID", "Student Name", "User Type", "School", "Division",
      "Gender", "Medium", "Course", "Subject", "Chapter", "Total Questions",
      "Right Answers", "Total Marks", "Marks Obtained", "Percentage",
      "Attempted Date", "Attempted Time", "Time Spent",
    ]);
    finishSheet(mcqWs);
    xlsx.utils.book_append_sheet(wb, mcqWs, "MCQ Report");

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
