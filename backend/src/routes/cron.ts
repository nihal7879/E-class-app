import { Router } from "express";
import { env } from "../config.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { runDailyIngest } from "../jobs/dailyIngest.js";

const router = Router();

/**
 * GET /api/cron/daily-ingest
 *
 * HTTP trigger for the daily ingest, used when the backend runs on Vercel
 * (serverless), where the in-process node-cron scheduler can't run. Vercel Cron
 * (schedule in vercel.json) hits this path once a day and attaches
 * `Authorization: Bearer <CRON_SECRET>`; we reject anything that doesn't match so
 * the public can't trigger ingests.
 *
 * It runs the SAME work the local node-cron runs (ingest YESTERDAY, idempotent
 * 'daily' mode). The ingest is awaited before responding — on serverless, any
 * work still pending after the response is sent gets killed.
 */
router.get(
  "/daily-ingest",
  asyncHandler(async (req, res) => {
    if (!env.CRON_SECRET) {
      res.status(503).json({ error: "CRON_SECRET is not configured on the server." });
      return;
    }
    if (req.headers.authorization !== `Bearer ${env.CRON_SECRET}`) {
      res.status(401).json({ error: "Unauthorized." });
      return;
    }

    await runDailyIngest();
    res.json({ ok: true, ranAt: new Date().toISOString() });
  }),
);

export default router;
