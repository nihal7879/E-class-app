/**
 * Standalone cron runner (optional).
 *
 * The daily 8 AM scheduler is already started by the API server (see index.ts),
 * so normally you don't need this. Use it only if you want to run the scheduler
 * on its own, or trigger a one-off ingest:
 *
 *   npm run cron            # start just the scheduler (stays running)
 *   npm run cron -- --now   # run one ingest of yesterday immediately
 */
import "dotenv/config";
import { runDailyIngest, scheduleDailyIngest } from "./jobs/dailyIngest.js";

scheduleDailyIngest();

if (process.argv.includes("--now")) {
  void runDailyIngest();
}
