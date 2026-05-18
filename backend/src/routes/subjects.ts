import { Router } from "express";
import { pool } from "../db.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { FilterQuerySchema, buildWhereClause } from "../lib/filters.js";

const router = Router();

/**
 * GET /api/subjects/:subject
 * Subject-level KPIs + per-chapter breakdown for the SubjectDetailPage.
 */
router.get(
  "/:subject",
  asyncHandler(async (req, res) => {
    const filter = FilterQuerySchema.parse(req.query);
    const subject = decodeURIComponent(req.params.subject);

    const video = buildWhereClause(filter, {
      dateColumn: "vu.last_access_date",
      schoolColumn: "u.school",
      courseColumn: "vu.course",
      divisionColumn: "u.division",
      genderColumn: "u.gender",
    });
    const [summaryRows] = await pool.query<any[]>(
      `SELECT COALESCE(SUM(vu.total_view_count), 0)                        AS videoViews,
              COALESCE(SUM(TIME_TO_SEC(vu.total_view_duration)), 0) * 1000 AS videoWatchMs,
              COUNT(DISTINCT vu.user_id)                                   AS uniqueStudents,
              COUNT(DISTINCT vu.chapter)                                   AS chapters
       FROM video_usage vu
       JOIN users u ON u.user_id = vu.user_id
       ${video.where ? video.where + " AND " : " WHERE "}vu.subject = ?`,
      [...video.params, subject],
    );

    const [chapterRows] = await pool.query<any[]>(
      `SELECT vu.chapter AS chapter,
              COALESCE(SUM(vu.total_view_count), 0)                        AS videoViews,
              COALESCE(SUM(TIME_TO_SEC(vu.total_view_duration)), 0) * 1000 AS videoWatchMs,
              COUNT(DISTINCT vu.content_name)                              AS contents
       FROM video_usage vu
       JOIN users u ON u.user_id = vu.user_id
       ${video.where ? video.where + " AND " : " WHERE "}vu.subject = ?
       GROUP BY vu.chapter
       ORDER BY videoViews DESC`,
      [...video.params, subject],
    );

    const mcq = buildWhereClause(filter, {
      dateColumn: "mr.attempted_date",
      schoolColumn: "u.school",
      courseColumn: "mr.course",
      divisionColumn: "u.division",
      genderColumn: "u.gender",
    });
    const [mcqRows] = await pool.query<any[]>(
      `SELECT COUNT(*) AS mcqAttempts,
              COALESCE(AVG(mr.percentage), 0) AS avgPercentage
       FROM mcq_report mr
       JOIN users u ON u.user_id = mr.user_id
       ${mcq.where ? mcq.where + " AND " : " WHERE "}mr.subject = ?`,
      [...mcq.params, subject],
    );

    res.json({
      subject,
      videoViews:     Number(summaryRows[0]?.videoViews ?? 0),
      videoWatchMs:   Number(summaryRows[0]?.videoWatchMs ?? 0),
      uniqueStudents: Number(summaryRows[0]?.uniqueStudents ?? 0),
      chapters:       Number(summaryRows[0]?.chapters ?? 0),
      mcqAttempts:    Number(mcqRows[0]?.mcqAttempts ?? 0),
      avgPercentage:  Number(mcqRows[0]?.avgPercentage ?? 0),
      chapterBreakdown: chapterRows.map((r) => ({
        chapter: r.chapter,
        videoViews: Number(r.videoViews),
        videoWatchMs: Number(r.videoWatchMs),
        contents: Number(r.contents),
      })),
    });
  }),
);

export default router;
