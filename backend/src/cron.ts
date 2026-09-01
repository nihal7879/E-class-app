/**
 * Standalone cron runner (optional).
 *
 * The hourly sync scheduler is already started by the API server (see index.ts),
 * so normally you don't need this. Use it only if you want to run the scheduler
 * on its own, or trigger a one-off sync:
 *
 *   npm run cron            # start just the scheduler (stays running)
 *   npm run cron -- --now   # run one incremental sync immediately
 */
import "dotenv/config";
import { runApiSync, scheduleApiSync } from "./jobs/apiSync.js";

scheduleApiSync();

if (process.argv.includes("--now")) {
  void runApiSync();
}
