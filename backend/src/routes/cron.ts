import { Router, type Request, type Response } from "express";
import { env } from "../config.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { runApiSyncStrict } from "../jobs/apiSync.js";
import { readAllSyncState } from "../lib/syncState.js";

const router = Router();

/**
 * GET /api/cron/daily-ingest
 *
 * HTTP trigger for the incremental API sync, used when the backend runs on
 * Vercel (serverless), where the in-process node-cron scheduler can't run.
 * Vercel Cron (schedule in vercel.json) hits this path and attaches
 * `Authorization: Bearer <CRON_SECRET>`; we reject anything that doesn't match so
 * the public can't trigger ingests.
 *
 * It runs the SAME work the local node-cron runs: resume each report from its
 * stored cursor, page through everything upstream has synced since, upsert it.
 * The sync is awaited before responding — on serverless, any work still pending
 * after the response is sent gets killed.
 *
 * The path keeps its original name so the existing Vercel cron entry and any
 * external monitor keep working; `/api/cron/sync` is an alias.
 */
const handler = asyncHandler(async (req: Request, res: Response) => {
  if (!env.CRON_SECRET) {
    res.status(503).json({ error: "CRON_SECRET is not configured on the server." });
    return;
  }
  if (req.headers.authorization !== `Bearer ${env.CRON_SECRET}`) {
    res.status(401).json({ error: "Unauthorized." });
    return;
  }

  // runApiSyncStrict() throws on ANY report failing (API fetch error, DB refused,
  // timeout). Report the real outcome so a failed or partial run is a non-2xx in
  // Vercel's cron logs instead of a silent HTTP 200 that ingested nothing.
  try {
    const results = await runApiSyncStrict();
    res.json({ ok: true, ranAt: new Date().toISOString(), results });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cron] sync endpoint FAILED:", message);
    res.status(500).json({ ok: false, ranAt: new Date().toISOString(), error: message });
  }
});

router.get("/daily-ingest", handler);
router.get("/sync", handler);

/**
 * GET /api/cron/status
 *
 * Where each report's cursor currently sits, when it last ran and how it went.
 * Unauthenticated on purpose — it exposes no student data, only timestamps and
 * row counts, and it is the fastest way to answer "is the sync alive?".
 */
router.get(
  "/status",
  asyncHandler(async (_req, res) => {
    res.json({ now: new Date().toISOString(), reports: await readAllSyncState() });
  }),
);

export default router;
