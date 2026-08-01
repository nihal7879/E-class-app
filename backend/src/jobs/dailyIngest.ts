/**
 * Daily ingest job + in-process scheduler (node-cron).
 *
 * `scheduleDailyIngest()` registers a cron that fires at the schedule from
 * config/cron.json (default 8 AM IST) and ingests YESTERDAY via the idempotent
 * 'daily' loader mode. It runs inside the Node process — no OS crontab needed.
 * The API server calls this on startup, so simply running the backend means
 * the 8 AM job is live. A failed run is logged but never crashes the process.
 *
 * The schedule/timezone come from a runtime JSON file (config/cron.json), so
 * changing them needs only an edit + restart — no rebuild.
 */
import { watch } from "node:fs";
import cron from "node-cron";
import {
  cronConfigPath,
  DEFAULT_CRON_SCHEDULE,
  DEFAULT_CRON_TIMEZONE,
  env,
  loadCronConfig,
} from "../config.js";
import { readFromApi } from "../ingest/sources/api.js";
import { loadBatch, type LoadResult } from "../ingest/loader.js";
import { yesterdayISO } from "../lib/dates.js";

/**
 * Runs the idempotent daily ingest for yesterday and RETURNS the load result.
 *
 * Errors are intentionally NOT swallowed here — they propagate to the caller so
 * that the HTTP cron endpoint (Vercel) responds with a non-2xx status. A swallowed
 * error made every Vercel cron run report HTTP 200 "success" while ingesting
 * nothing (e.g. when the DB refused the serverless egress IP), which is exactly
 * how a broken cron went unnoticed. The in-process node-cron caller catches this
 * itself so a failed run still never crashes the long-lived process.
 */
export async function runDailyIngest(): Promise<LoadResult> {
  const date = yesterdayISO();
  console.log(`[cron] ${new Date().toISOString()} — daily ingest for ${date} …`);
  const batch = await readFromApi({
    base: env.ECLASS_API_BASE,
    fromDate: date,
    toDate: date,
  });
  const result = await loadBatch(batch, { mode: "daily", date });
  console.log("[cron] done:", result);

  // A report that failed to fetch no longer takes the other two down with it —
  // whatever came back is already committed above. But the run is still not a
  // clean success, so raise it AFTER the commit: the HTTP cron endpoint answers
  // non-2xx and the failure is visible instead of passing as a green run that
  // quietly skipped a report.
  if (result.failures.length > 0) {
    throw new Error(
      `Partial ingest for ${date}: loaded [${result.reportsLoaded.join(", ")}], ` +
        `failed ${result.failures.map((f) => `${f.report} (${f.error})`).join("; ")}`,
    );
  }
  return result;
}

let task: cron.ScheduledTask | null = null;
let current = ""; // "schedule|timezone" currently registered — skip no-op reloads
let watching = false;

/** (Re)register the cron task from the hardcoded default (optionally overridden). */
function register(): void {
  let { schedule, timezone } = loadCronConfig();

  // Never leave the job unscheduled: if an override produced an invalid cron
  // string, fall back to the hardcoded default rather than skipping (skipping on
  // first run would mean NO daily ingest at all — the failure we're fixing).
  if (!cron.validate(schedule)) {
    console.error(
      `[cron] invalid schedule "${schedule}" (override) — falling back to default "${DEFAULT_CRON_SCHEDULE}"`,
    );
    schedule = DEFAULT_CRON_SCHEDULE;
    timezone = DEFAULT_CRON_TIMEZONE;
  }

  const signature = `${schedule}|${timezone}`;
  if (signature === current) return; // unchanged — nothing to do

  task?.stop();
  task = cron.schedule(
    schedule,
    () => {
      // node-cron is fire-and-forget; runDailyIngest() now throws on failure, so
      // catch here to keep a failed run from becoming an unhandled rejection that
      // could crash the long-lived process.
      void runDailyIngest().catch((err) =>
        console.error("[cron] FAILED:", err instanceof Error ? err.message : err),
      );
    },
    { timezone },
  );
  current = signature;
  console.log(`[cron] scheduled "${schedule}" (${timezone}) — auto-ingests yesterday.`);
}

/**
 * Registers the daily cron and starts watching config/cron.json so edits to the
 * schedule/timezone take effect live — no rebuild and no restart. Safe to call
 * once per process (guards re-entry).
 */
export function scheduleDailyIngest(): void {
  register();

  if (watching) return;
  try {
    // Debounce: editors often fire several change events for one save.
    let timer: NodeJS.Timeout | null = null;
    watch(cronConfigPath, () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        console.log("[cron] config/cron.json changed — reloading schedule…");
        register();
      }, 300);
    });
    watching = true;
  } catch (err) {
    // No watch (e.g. file missing) — the job still runs on the loaded schedule.
    console.warn(
      `[cron] could not watch config/cron.json (${err instanceof Error ? err.message : err}); ` +
        "live reload disabled.",
    );
  }
}
