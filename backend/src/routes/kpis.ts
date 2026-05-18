import { Router } from "express";
import { pool } from "../db.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { FilterQuerySchema, buildWhereClause } from "../lib/filters.js";

const router = Router();

/**
 * GET /api/kpis
 * Headline numbers for the KPI strip:
 *   - total logins, total session ms, avg session ms, unique users
 *   - total video views, total video watch ms
 *   - total mcq attempts, avg mcq percentage
 */
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const filter = FilterQuerySchema.parse(req.query);

    const login = buildWhereClause(filter, {
      dateColumn: "lh.login_date",
      schoolColumn: "u.school",
      divisionColumn: "u.division",
      genderColumn: "u.gender",
    });
    const [loginRows] = await pool.query<any[]>(
      `SELECT
         COUNT(*)                                                   AS totalLogins,
         COALESCE(SUM(TIME_TO_SEC(lh.session_time)), 0) * 1000       AS totalSessionMs,
         COALESCE(AVG(TIME_TO_SEC(lh.session_time)), 0) * 1000       AS avgSessionMs,
         COUNT(DISTINCT lh.user_id)                                  AS uniqueUsers
       FROM login_history lh
       JOIN users u ON u.user_id = lh.user_id
       ${login.where}`,
      login.params,
    );

    const video = buildWhereClause(filter, {
      dateColumn: "vu.last_access_date",
      schoolColumn: "u.school",
      courseColumn: "vu.course",
      divisionColumn: "u.division",
      genderColumn: "u.gender",
    });
    const [videoRows] = await pool.query<any[]>(
      `SELECT
         COALESCE(SUM(vu.total_view_count), 0)                          AS videoViews,
         COALESCE(SUM(TIME_TO_SEC(vu.total_view_duration)), 0) * 1000   AS videoWatchMs
       FROM video_usage vu
       JOIN users u ON u.user_id = vu.user_id
       ${video.where}`,
      video.params,
    );

    const mcq = buildWhereClause(filter, {
      dateColumn: "mr.attempted_date",
      schoolColumn: "u.school",
      courseColumn: "mr.course",
      divisionColumn: "u.division",
      genderColumn: "u.gender",
    });
    const [mcqRows] = await pool.query<any[]>(
      `SELECT
         COUNT(*)                          AS mcqAttempts,
         COALESCE(AVG(mr.percentage), 0)   AS avgPercentage
       FROM mcq_report mr
       JOIN users u ON u.user_id = mr.user_id
       ${mcq.where}`,
      mcq.params,
    );

    res.json({
      totalLogins:    Number(loginRows[0]?.totalLogins ?? 0),
      totalSessionMs: Number(loginRows[0]?.totalSessionMs ?? 0),
      avgSessionMs:   Number(loginRows[0]?.avgSessionMs ?? 0),
      uniqueUsers:    Number(loginRows[0]?.uniqueUsers ?? 0),
      videoViews:     Number(videoRows[0]?.videoViews ?? 0),
      videoWatchMs:   Number(videoRows[0]?.videoWatchMs ?? 0),
      mcqAttempts:    Number(mcqRows[0]?.mcqAttempts ?? 0),
      avgPercentage:  Number(mcqRows[0]?.avgPercentage ?? 0),
    });
  }),
);

export default router;
