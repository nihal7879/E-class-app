/**
 * Ingest CLI — drives both flows.
 *
 * NOTE: for the live API, prefer `npm run sync` (src/scripts/sync.ts). This CLI's
 * API path predates the cursor feed: it asks for a date window and assumes the
 * response is that window's rows. It isn't — the window filters on an upstream
 * sync timestamp, so a single call returns rows spanning years, and `--mode=daily`
 * then DELETEs one date while inserting all of them. Kept for Excel ingest and for
 * one-off manual re-fetches; see docs/INGEST.md → Flow 1.
 *
 *   Flow 1 (legacy, live API):
 *     npm run ingest:api                       # ingests YESTERDAY (daily mode)
 *     npm run ingest:api -- --date=2026-06-15  # backfill a specific day
 *     npm run ingest:api -- --from=2026-01-01 --to=2026-06-20   # backfill a range
 *                                              # (range defaults to --mode=replace:
 *                                              #  a clean,
 * 
 *  idempotent re-bootstrap)
 *
 *   Flow 2 (fallback, manual Excel upload):
 *     npm run ingest:excel -- --file="path/to/report.xlsx"
 *
 * Modes:
 *     --mode=daily     (default for api) DELETE the date's rows then INSERT — idempotent re-runs.
 *     --mode=append    keep existing rows; UPSERT users, INSERT logins/videos/mcq.
 *     --mode=replace   wipe login/video/mcq/users, then INSERT fresh from this batch.
 */

import "dotenv/config";
import { env } from "../config.js";
import { readExcel } from "./sources/excel.js";
import { readFromApi } from "./sources/api.js";
import { loadBatch, type IngestMode } from "./loader.js";
import { pool } from "../db.js";
import { isISODate, monthlyWindows, yesterdayISO } from "../lib/dates.js";

interface Args {
  source: "excel" | "api";
  file?: string;
  mode?: IngestMode;     // undefined = pick a sensible default per source
  date?: string;         // YYYY-MM-DD (api only); default yesterday
  from?: string;         // YYYY-MM-DD (api only); start of a range backfill
  to?: string;           // YYYY-MM-DD (api only); end of a range backfill
}

function parseArgs(): Args {
  const out: Args = { source: "excel" };
  for (const arg of process.argv.slice(2)) {
    const eq = arg.indexOf("=");
    const key = eq >= 0 ? arg.slice(0, eq) : arg;
    const val = eq >= 0 ? arg.slice(eq + 1) : "";
    switch (key) {
      case "--source":
        if (val !== "excel" && val !== "api") {
          throw new Error(`--source must be 'excel' or 'api', got: ${val}`);
        }
        out.source = val;
        break;
      case "--file":
        out.file = val;
        break;
      case "--mode":
        if (val !== "replace" && val !== "append" && val !== "daily") {
          throw new Error(`--mode must be 'replace', 'append' or 'daily', got: ${val}`);
        }
        out.mode = val;
        break;
      case "--date":
        if (!isISODate(val)) throw new Error(`--date must be YYYY-MM-DD, got: ${val}`);
        out.date = val;
        break;
      case "--from":
        if (!isISODate(val)) throw new Error(`--from must be YYYY-MM-DD, got: ${val}`);
        out.from = val;
        break;
      case "--to":
        if (!isISODate(val)) throw new Error(`--to must be YYYY-MM-DD, got: ${val}`);
        out.to = val;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return out;
}

/**
 * Range backfill. The VideoUsage report for a full multi-month span is tens of
 * MB and node's fetch drops the connection, so we ingest one calendar month at a
 * time. The first window uses the requested mode (default 'replace' — wipes the
 * fact tables for a clean rebuild); every later window switches to 'append' so it
 * adds to, rather than wipes, what the earlier windows just loaded.
 */
async function runRange(args: Args): Promise<void> {
  const fromDate = args.from ?? args.to!;
  const toDate = args.to ?? args.from!;
  if (fromDate > toDate) throw new Error(`--from (${fromDate}) must be <= --to (${toDate})`);

  const firstMode: IngestMode = args.mode ?? "replace";
  const windows = monthlyWindows(fromDate, toDate);
  console.log(
    `[ingest] source=api range=${fromDate}..${toDate} firstMode=${firstMode} ` +
      `windows=${windows.length} base=${env.ECLASS_API_BASE}`,
  );

  const totals = { users: 0, logins: 0, videos: 0, mcq: 0, institutes: 0, mediums: 0, schools: 0 };
  for (let i = 0; i < windows.length; i++) {
    const w = windows[i];
    const mode: IngestMode = i === 0 ? firstMode : "append";
    console.log(`[ingest] window ${i + 1}/${windows.length} ${w.from}..${w.to} mode=${mode} — fetching...`);
    const batch = await readFromApi({ base: env.ECLASS_API_BASE, fromDate: w.from, toDate: w.to });
    console.log(
      `[ingest]   parsed: ${batch.users.length} users, ${batch.logins.length} logins, ` +
        `${batch.videos.length} videos, ${batch.mcq.length} mcq, ${batch.schools.length} schools`,
    );
    const r = await loadBatch(batch, { mode });
    totals.users += r.users; totals.logins += r.logins; totals.videos += r.videos;
    totals.mcq += r.mcq; totals.institutes += r.institutes; totals.mediums += r.mediums;
    totals.schools += r.schools;
  }
  console.log("[ingest] done (range totals):", totals);
}

async function main(): Promise<void> {
  const args = parseArgs();

  let batch;
  let mode: IngestMode;
  let date: string | undefined;

  if (args.source === "excel") {
    if (!args.file) throw new Error("--source=excel requires --file=<path-to-xlsx>");
    mode = args.mode ?? "append";
    console.log(`[ingest] source=excel mode=${mode} file=${args.file}`);
    console.log("[ingest] reading Excel...");
    batch = readExcel(args.file);
  } else if (args.from || args.to) {
    await runRange(args);
    return;
  } else {
    date = args.date ?? yesterdayISO();
    mode = args.mode ?? "daily";
    console.log(`[ingest] source=api mode=${mode} date=${date} base=${env.ECLASS_API_BASE}`);
    console.log("[ingest] fetching API...");
    batch = await readFromApi({ base: env.ECLASS_API_BASE, fromDate: date, toDate: date });
  }

  console.log(
    `[ingest] parsed: ${batch.users.length} users, ${batch.logins.length} logins, ` +
      `${batch.videos.length} videos, ${batch.mcq.length} mcq, ` +
      `${batch.institutes.length} institutes, ${batch.mediums.length} mediums, ` +
      `${batch.schools.length} schools`,
  );

  const empty =
    batch.users.length === 0 && batch.logins.length === 0 &&
    batch.videos.length === 0 && batch.mcq.length === 0;
  // In daily mode an empty batch still matters: it must clear that day's stale
  // rows (e.g. a re-fetch after a correction). Only skip the no-op append/replace.
  if (empty && mode !== "daily") {
    console.log("[ingest] nothing to load — exiting without touching DB");
    return;
  }

  console.log("[ingest] writing to MySQL...");
  const result = await loadBatch(batch, { mode, date });
  console.log("[ingest] done:", result);
}

main()
  .then(() => pool.end())
  .catch(async (err) => {
    console.error("[ingest] FAILED:", err instanceof Error ? err.message : err);
    await pool.end().catch(() => undefined);
    process.exit(1);
  });
