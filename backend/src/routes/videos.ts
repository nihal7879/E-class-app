import { Router } from "express";
import { pool } from "../db.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { FilterQuerySchema, buildWhereClause } from "../lib/filters.js";

const router = Router();

/**
 * GET /api/videos/usage
 * Aggregated video usage grouped by content_name. Feeds VideoUsageCard.
 * Query params:
 *   limit  — max items to return (default 50)
 */
router.get(
  "/usage",
  asyncHandler(async (req, res) => {
    const filter = FilterQuerySchema.parse(req.query);
    const limit = Math.min(Number(req.query.limit ?? 50) || 50, 500);

    const video = buildWhereClause(filter, {
      dateColumn: "vu.last_access_date",
      schoolColumn: "u.school",
      courseColumn: "vu.course",
      divisionColumn: "u.division",
      genderColumn: "u.gender",
    });

    const [summaryRows] = await pool.query<any[]>(
      `SELECT COALESCE(SUM(vu.total_view_count), 0)                        AS totalViews,
              COALESCE(SUM(TIME_TO_SEC(vu.total_view_duration)), 0) * 1000 AS totalWatchMs,
              COUNT(DISTINCT vu.content_name)                              AS uniqueVideos,
              COUNT(DISTINCT vu.user_id)                                   AS uniqueViewers
       FROM video_usage vu
       JOIN users u ON u.user_id = vu.user_id
       ${video.where}`,
      video.params,
    );

    const [itemRows] = await pool.query<any[]>(
      `SELECT vu.content_name AS contentName,
              vu.content_type AS contentType,
              vu.subject      AS subject,
              vu.chapter      AS chapter,
              vu.course       AS course,
              COALESCE(SUM(vu.total_view_count), 0)                        AS totalViews,
              COALESCE(SUM(TIME_TO_SEC(vu.total_view_duration)), 0) * 1000 AS totalWatchMs,
              COUNT(DISTINCT vu.user_id)                                   AS uniqueViewers
       FROM video_usage vu
       JOIN users u ON u.user_id = vu.user_id
       ${video.where}
       GROUP BY vu.content_name, vu.content_type, vu.subject, vu.chapter, vu.course
       ORDER BY totalViews DESC
       LIMIT ?`,
      [...video.params, limit],
    );

    res.json({
      summary: {
        totalViews:    Number(summaryRows[0]?.totalViews ?? 0),
        totalWatchMs:  Number(summaryRows[0]?.totalWatchMs ?? 0),
        uniqueVideos:  Number(summaryRows[0]?.uniqueVideos ?? 0),
        uniqueViewers: Number(summaryRows[0]?.uniqueViewers ?? 0),
      },
      items: itemRows.map((r) => ({
        contentName: r.contentName,
        contentType: r.contentType,
        subject: r.subject,
        chapter: r.chapter,
        course: r.course,
        totalViews: Number(r.totalViews),
        totalWatchMs: Number(r.totalWatchMs),
        uniqueViewers: Number(r.uniqueViewers),
      })),
    });
  }),
);

export default router;
