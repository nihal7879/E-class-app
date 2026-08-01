/**
 * Fill in days the daily cron never stored.
 *
 *   npm run db:fill-gaps -- --from=2026-01-01 --to=2026-07-28 --dry-run
 *   npm run db:fill-gaps -- --from=2026-01-01 --to=2026-07-28
 *
 * WHY THERE ARE GAPS: the three reports used to be fetched with Promise.all, so
 * one failing discarded the whole day. On a Sunday nobody logs in, the Login
 * report answers HTTP 417 "no data found", and that took the VideoUsage and MCQ
 * rows down with it — every Sunday is missing as a result. Fixed in
 * ingest/sources/api.ts; this script repairs the days already lost.
 *
 * THE RULE (per date, per report — the three are independent):
 *   DB has rows for that date+report   -> leave it completely alone
 *   DB empty and API has rows          -> insert just that report for that date
 *   neither has rows                   -> nothing to do
 *
 * Nothing already stored is ever deleted or overwritten. A date where the DB has
 * FEWER rows than the API (late-arriving data) is deliberately skipped — "the DB
 * has data" means discard, so only a full reload would refresh those.
 *
 * The API is polled one MONTH at a time (21 requests, not 627) and the records
 * are grouped by their own date field locally.
 */
import "dotenv/config";
import { env } from "../config.js";
import { pool } from "../db.js";
import { buildBatch, fetchReport } from "../ingest/sources/api.js";
import { loadBatch } from "../ingest/loader.js";
import { parseDate } from "../ingest/transformers.js";
import { isISODate, monthlyWindows } from "../lib/dates.js";
import type { ReportName } from "../ingest/types.js";

type Rec = Record<string, unknown>;

interface ReportSpec {
  name: ReportName;
  api: "Login" | "VideoUsage" | "MCQ";
  dateField: string;   // field on the API record holding the row's own date
  table: string;
  dateColumn: string;
}

const REPORTS: ReportSpec[] = [
  { name: "logins", api: "Login",      dateField: "LoginDate",      table: "login_history", dateColumn: "login_date" },
  { name: "videos", api: "VideoUsage", dateField: "LastAccessDate", table: "video_usage",   dateColumn: "last_access_date" },
  { name: "mcq",    api: "MCQ",        dateField: "AttemptedDate",  table: "mcq_report",    dateColumn: "attempted_date" },
];

function parseArgs(): { from: string; to: string; dryRun: boolean } {
  let from = "";
  let to = "";
  let dryRun = false;
  for (const arg of process.argv.slice(2)) {
    const eq = arg.indexOf("=");
    const key = eq >= 0 ? arg.slice(0, eq) : arg;
    const val = eq >= 0 ? arg.slice(eq + 1) : "";
    if (key === "--from") from = val;
    else if (key === "--to") to = val;
    else if (key === "--dry-run") dryRun = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!isISODate(from) || !isISODate(to)) {
    throw new Error("--from and --to are required, as YYYY-MM-DD");
  }
  if (from > to) throw new Error(`--from (${from}) must be <= --to (${to})`);
  return { from, to, dryRun };
}

/** Dates (YYYY-MM-DD) that already have at least one row, per table. */
async function datesInDb(spec: ReportSpec, from: string, to: string): Promise<Set<string>> {
  const [rows] = await pool.query<any[]>(
    `SELECT DATE_FORMAT(${spec.dateColumn}, '%Y-%m-%d') AS d
       FROM ${spec.table}
      WHERE ${spec.dateColumn} BETWEEN ? AND ?
      GROUP BY ${spec.dateColumn}`,
    [from, to],
  );
  return new Set(rows.map((r) => r.d));
}

/** Pull a report month by month and bucket every record under its own date. */
async function recordsByDateFromApi(
  spec: ReportSpec,
  from: string,
  to: string,
): Promise<Map<string, Rec[]>> {
  const byDate = new Map<string, Rec[]>();
  for (const w of monthlyWindows(from, to)) {
    const recs = await fetchReport(env.ECLASS_API_BASE, spec.api, w.from, w.to);
    for (const r of recs) {
      // Bucket by the record's OWN date, not the window — a window can return
      // rows dated outside it, and those must land on the right day.
      const d = parseDate((r as Rec)[spec.dateField]);
      if (!d || d < from || d > to) continue;
      let list = byDate.get(d);
      if (!list) byDate.set(d, (list = []));
      list.push(r as Rec);
    }
    console.log(`[gaps]   ${spec.api} ${w.from}..${w.to}: ${recs.length} records`);
  }
  return byDate;
}

async function main(): Promise<void> {
  const { from, to, dryRun } = parseArgs();
  console.log(
    `[gaps] range ${from}..${to}  db=${env.DB_NAME}  base=${env.ECLASS_API_BASE}` +
      (dryRun ? "  (dry-run — nothing will be written)" : ""),
  );

  // 1. What the API holds, per report per date.
  const apiByReport = new Map<ReportName, Map<string, Rec[]>>();
  for (const spec of REPORTS) {
    console.log(`[gaps] scanning ${spec.api}…`);
    apiByReport.set(spec.name, await recordsByDateFromApi(spec, from, to));
  }

  // 2. What the DB already holds, per report per date.
  const dbByReport = new Map<ReportName, Set<string>>();
  for (const spec of REPORTS) {
    dbByReport.set(spec.name, await datesInDb(spec, from, to));
  }

  // 3. (date, report) pairs where the API has rows and the DB has none.
  const missing = new Map<string, ReportName[]>();
  let pairs = 0;
  for (const spec of REPORTS) {
    const apiDates = apiByReport.get(spec.name)!;
    const dbDates = dbByReport.get(spec.name)!;
    for (const [date, recs] of apiDates) {
      if (recs.length === 0 || dbDates.has(date)) continue;
      const list = missing.get(date) ?? [];
      list.push(spec.name);
      missing.set(date, list);
      pairs++;
    }
  }

  const dates = [...missing.keys()].sort();
  console.log(`\n[gaps] ${dates.length} date(s), ${pairs} report-gap(s) to fill:\n`);
  for (const date of dates) {
    const reports = missing.get(date)!;
    const counts = reports
      .map((r) => `${r}=${apiByReport.get(r)!.get(date)!.length}`)
      .join(" ");
    console.log(`   ${date}  ${counts}`);
  }
  if (dates.length === 0) {
    console.log("[gaps] nothing to fill — DB already covers every date the API has.");
    return;
  }
  if (dryRun) {
    console.log("\n[gaps] dry-run — no changes made.");
    return;
  }

  // 4. Load each date, carrying ONLY the reports that were missing. `daily` mode
  //    deletes just those reports' rows for that date (there are none, by
  //    definition), so nothing already stored is touched.
  console.log("");
  let inserted = 0;
  for (const date of dates) {
    const reports = missing.get(date)!;
    const pick = (name: ReportName): Rec[] =>
      reports.includes(name) ? (apiByReport.get(name)!.get(date) ?? []) : [];

    const batch = buildBatch(pick("logins"), pick("videos"), pick("mcq"));
    batch.reportsLoaded = reports;

    const result = await loadBatch(batch, { mode: "daily", date });
    inserted += result.logins + result.videos + result.mcq;
    console.log(
      `[gaps] ${date}  logins=${result.logins} videos=${result.videos} mcq=${result.mcq}` +
        `  (${reports.join(", ")})`,
    );
  }
  console.log(`\n[gaps] done — ${inserted} row(s) inserted across ${dates.length} date(s).`);
}

main()
  .then(() => pool.end())
  .catch(async (err) => {
    console.error("[gaps] FAILED:", err instanceof Error ? err.message : err);
    await pool.end().catch(() => undefined);
    process.exit(1);
  });
