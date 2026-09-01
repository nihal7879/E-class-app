/**
 * Incremental API sync — the job the hourly cron runs.
 *
 * Replaces the old "ingest yesterday" daily job, which cannot work against the
 * current API. Two facts force this design:
 *
 *  1. The fromDate/toDate window filters on an UPSTREAM SYNC TIMESTAMP, not on
 *     the row's own date. A single call for 2026-04-14..2026-06-14 returned 1803
 *     login rows of which 896 had a LoginDate outside that window — some from
 *     2014. So "today's sync" legitimately delivers rows belonging to March, to
 *     last November, to two years ago, and each must land on its OWN date. A
 *     date-scoped DELETE-then-INSERT would wipe days it never replaces.
 *
 *  2. A response is capped at 10,000 rows and carries `NextSync` + a
 *     `NextStartDate` cursor. The cursor is persisted per report in `sync_state`,
 *     so each run picks up exactly where the last one stopped.
 *
 * Each page is committed on its own and the cursor advanced only afterwards. A
 * run that dies halfway keeps everything it already wrote and resumes from the
 * last committed page — at-least-once delivery, made harmless by the
 * `upstream_id` upsert in the loader.
 *
 * Reports are synced in the order logins → videos → mcq. Videos before MCQ is
 * deliberate: the MCQ chapter repair builds its catalogue from video_usage, so
 * the videos from this same run must already be in the table.
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
import { buildBatch, formatApiDateTime, iterateReportPages } from "../ingest/sources/api.js";
import { loadBatch } from "../ingest/loader.js";
import { ALL_REPORTS, type IngestBatch, type ReportName } from "../ingest/types.js";
import { advanceCursor, readSyncState, recordSyncRun } from "../lib/syncState.js";

export interface ReportSyncResult {
  report: ReportName;
  pages: number;
  rows: number;
  users: number;
  /** Where this run started reading from. */
  from: string;
  /** Where the next run will start from (null = cursor unchanged). */
  cursor: string | null;
  error?: string;
}

export interface SyncOptions {
  /** Override the stored cursor. 'YYYY-MM-DD' or 'YYYY-MM-DD HH:mm:ss'. */
  from?: string;
  /** Window end; defaults to the end of today. */
  to?: string;
  /** Which reports to sync. Defaults to all three. */
  reports?: ReportName[];
  /** Runaway guard passed through to the page iterator. */
  maxPages?: number;
  /** Set false for a dry run that reads the API but writes nothing. */
  persist?: boolean;
}

/** End of today, in the format the API demands. */
function endOfToday(): string {
  const now = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())} 23:59:59`;
}

/** Wrap one report's records in the batch shape the loader expects. */
function batchFor(report: ReportName, records: Record<string, unknown>[]): IngestBatch {
  const batch =
    report === "logins" ? buildBatch(records, [], [])
    : report === "videos" ? buildBatch([], records, [])
    : buildBatch([], [], records);
  batch.reportsLoaded = [report];
  batch.failures = [];
  return batch;
}

/**
 * Sync one report from its stored cursor (or `opts.from`) up to `opts.to`.
 *
 * Never throws for a report-level failure — the error is returned on the result
 * so the other two reports still run. The cursor is left where the failure
 * happened, so the next hourly run retries exactly that page.
 */
export async function syncReport(
  report: ReportName,
  opts: SyncOptions = {},
): Promise<ReportSyncResult> {
  const persist = opts.persist ?? true;
  const to = formatApiDateTime(opts.to ?? endOfToday());

  const stored = await readSyncState(report);
  const from = formatApiDateTime(opts.from ?? stored?.nextStartDate ?? env.SYNC_START_DATE);

  const result: ReportSyncResult = { report, pages: 0, rows: 0, users: 0, from, cursor: null };
  console.log(`[sync] ${report}: ${from} → ${to}`);

  try {
    for await (const page of iterateReportPages(env.ECLASS_API_BASE, report, from, to, {
      maxPages: opts.maxPages,
    })) {
      result.pages = page.page;
      result.rows += page.records.length;

      if (page.records.length > 0) {
        const batch = batchFor(report, page.records);
        result.users += batch.users.length;
        if (persist) await loadBatch(batch, { mode: "sync" });
        console.log(
          `[sync]   ${report} page ${page.page}: ${page.records.length} rows, ` +
            `${batch.users.length} users${persist ? " — committed" : " — DRY RUN"}`,
        );
      }

      // Only after the page is committed. A crash before this point re-fetches
      // the page rather than skipping it; the upstream_id upsert makes that free.
      //
      // Clamped to the window end. The API can return a NextStartDate LATER than
      // the toDate it was given (measured: asked for ..2026-09-01 00:00:00, got
      // back 2026-09-01 10:50:44). Storing that raw would permanently skip every
      // row upstream synced between the window end and that timestamp, because
      // this run never asked for them. `to` is the furthest point we can honestly
      // claim to have read.
      const next = page.nextStartDate;
      if (next) {
        const cursor = next > to ? to : next;
        if (persist) await advanceCursor(report, cursor);
        result.cursor = cursor;
      }
    }
    if (persist) await recordSyncRun(report, "ok", result.rows, result.pages);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    result.error = message;
    console.error(`[sync] ${report} FAILED after ${result.pages} page(s): ${message}`);
    if (persist) await recordSyncRun(report, `error: ${message}`, result.rows, result.pages);
  }

  return result;
}

/**
 * Sync every report. Returns one result per report.
 *
 * Throws only if EVERY report failed — a single bad endpoint must not stop the
 * other two from landing, which is the same rule the old daily job followed.
 */
export async function runApiSync(opts: SyncOptions = {}): Promise<ReportSyncResult[]> {
  const reports = opts.reports ?? ALL_REPORTS;
  const results: ReportSyncResult[] = [];

  // Sequential, not Promise.all: videos must be committed before the MCQ chapter
  // repair reads the chapter catalogue, and three concurrent 10k-row pages would
  // fight over the same connection pool for no gain.
  for (const report of reports) {
    results.push(await syncReport(report, opts));
  }

  const failed = results.filter((r) => r.error);
  if (failed.length === results.length && results.length > 0) {
    throw new Error(
      "All reports failed: " + failed.map((f) => `${f.report}: ${f.error}`).join(" | "),
    );
  }
  if (failed.length > 0) {
    console.warn(`[sync] partial run — failed: ${failed.map((f) => f.report).join(", ")}`);
  }
  console.log(
    "[sync] done: " +
      results.map((r) => `${r.report}=${r.rows} rows/${r.pages}p`).join("  "),
  );
  return results;
}

/**
 * Same work as the cron, but surfaces a partial run as a thrown error so the
 * HTTP cron endpoint answers non-2xx instead of a green 200 that ingested half
 * of what it should have.
 */
export async function runApiSyncStrict(opts: SyncOptions = {}): Promise<ReportSyncResult[]> {
  const results = await runApiSync(opts);
  const failed = results.filter((r) => r.error);
  if (failed.length > 0) {
    throw new Error(
      `Partial sync: ${failed.map((f) => `${f.report} (${f.error})`).join("; ")}`,
    );
  }
  return results;
}

let task: cron.ScheduledTask | null = null;
let current = ""; // "schedule|timezone" currently registered — skip no-op reloads
let watching = false;
let running = false;

/** (Re)register the cron task from config (hourly by default). */
function register(): void {
  let { schedule, timezone } = loadCronConfig();

  // Never leave the job unscheduled: if an override produced an invalid cron
  // string, fall back to the hardcoded default rather than skipping (skipping on
  // first run would mean NO sync at all — the failure we're guarding against).
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
      // An hourly schedule can fire again while the previous run is still
      // walking pages (a long backfill, a slow upstream). Overlapping runs would
      // both advance the same cursor and duplicate work, so skip instead.
      if (running) {
        console.warn("[cron] previous sync still running — skipping this tick.");
        return;
      }
      running = true;
      void runApiSync()
        .catch((err) => console.error("[cron] FAILED:", err instanceof Error ? err.message : err))
        .finally(() => {
          running = false;
        });
    },
    { timezone },
  );
  current = signature;
  console.log(`[cron] scheduled "${schedule}" (${timezone}) — incremental API sync.`);
}

/**
 * Registers the sync cron and watches config/cron.json so edits to the
 * schedule/timezone take effect live — no rebuild and no restart. Safe to call
 * once per process (guards re-entry).
 */
export function scheduleApiSync(): void {
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
