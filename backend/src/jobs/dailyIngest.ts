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
import { cronConfigPath, env, loadCronConfig } from "../config.js";
import { readFromApi } from "../ingest/sources/api.js";
import { loadBatch } from "../ingest/loader.js";
import { yesterdayISO } from "../lib/dates.js";

export async function runDailyIngest(): Promise<void> {
  const date = yesterdayISO();
  console.log(`[cron] ${new Date().toISOString()} — daily ingest for ${date} …`);
  try {
    const batch = await readFromApi({
      base: env.ECLASS_API_BASE,
      fromDate: date,
      toDate: date,
    });
    const result = await loadBatch(batch, { mode: "daily", date });
    console.log("[cron] done:", result);
  } catch (err) {
    console.error("[cron] FAILED:", err instanceof Error ? err.message : err);
  }
}

let task: cron.ScheduledTask | null = null;
let current = ""; // "schedule|timezone" currently registered — skip no-op reloads
let watching = false;

/** (Re)register the cron task from the current config/cron.json. */
function register(): void {
  const { schedule, timezone } = loadCronConfig();
  const signature = `${schedule}|${timezone}`;
  if (signature === current) return; // unchanged — nothing to do

  if (!cron.validate(schedule)) {
    console.error(
      `[cron] invalid schedule "${schedule}" (config/cron.json) — keeping previous schedule`,
    );
    return;
  }

  task?.stop();
  task = cron.schedule(schedule, () => void runDailyIngest(), { timezone });
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
