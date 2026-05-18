import { Router } from "express";
import { pool } from "../db.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { FilterQuerySchema, buildWhereClause } from "../lib/filters.js";

const router = Router();

/**
 * GET /api/mcq/results
 * Aggregated MCQ stats — overall summary + per-subject breakdown.
 * Feeds McqResultsCard.
 */
router.get(
  "/results",
  asyncHandler(async (req, res) => {
    const filter = FilterQuerySchema.parse(req.query);
    const limit = Math.min(Number(req.query.limit ?? 100) || 100, 500);

    const mcq = buildWhereClause(filter, {
      dateColumn: "mr.attempted_date",
      schoolColumn: "u.school",
      courseColumn: "mr.course",
      divisionColumn: "u.division",
      genderColumn: "u.gender",
    });

    const [summaryRows] = await pool.query<any[]>(
      `SELECT COUNT(*) AS attempts,
              COALESCE(AVG(mr.percentage), 0)           AS avgPercentage,
              COALESCE(SUM(mr.right_question_count), 0) AS rightAnswers,
              COALESCE(SUM(mr.total_question), 0)       AS totalQuestions,
              COALESCE(SUM(mr.marks_obtained), 0)       AS marksObtained,
              COALESCE(SUM(mr.total_marks), 0)          AS totalMarks,
              COUNT(DISTINCT mr.user_id)                AS uniqueStudents
       FROM mcq_report mr
       JOIN users u ON u.user_id = mr.user_id
       ${mcq.where}`,
      mcq.params,
    );

    const [subjectRows] = await pool.query<any[]>(
      `SELECT mr.subject AS subject,
              mr.course  AS course,
              COUNT(*)                                  AS attempts,
              COALESCE(AVG(mr.percentage), 0)           AS avgPercentage,
              COALESCE(SUM(mr.right_question_count), 0) AS rightAnswers,
              COALESCE(SUM(mr.total_question), 0)       AS totalQuestions,
              COUNT(DISTINCT mr.user_id)                AS uniqueStudents
       FROM mcq_report mr
       JOIN users u ON u.user_id = mr.user_id
       ${mcq.where}
       GROUP BY mr.subject, mr.course
       ORDER BY attempts DESC
       LIMIT ?`,
      [...mcq.params, limit],
    );

    res.json({
      summary: {
        attempts:       Number(summaryRows[0]?.attempts ?? 0),
        avgPercentage:  Number(summaryRows[0]?.avgPercentage ?? 0),
        rightAnswers:   Number(summaryRows[0]?.rightAnswers ?? 0),
        totalQuestions: Number(summaryRows[0]?.totalQuestions ?? 0),
        marksObtained:  Number(summaryRows[0]?.marksObtained ?? 0),
        totalMarks:     Number(summaryRows[0]?.totalMarks ?? 0),
        uniqueStudents: Number(summaryRows[0]?.uniqueStudents ?? 0),
      },
      items: subjectRows.map((r) => ({
        subject: r.subject,
        course: r.course,
        attempts: Number(r.attempts),
        avgPercentage: Number(r.avgPercentage),
        rightAnswers: Number(r.rightAnswers),
        totalQuestions: Number(r.totalQuestions),
        uniqueStudents: Number(r.uniqueStudents),
      })),
    });
  }),
);

export default router;
