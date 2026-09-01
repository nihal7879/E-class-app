/**
 * Incremental API sync, from the command line.
 *
 *   npm run sync                                   # resume every report from its stored cursor
 *   npm run sync -- --from=2026-01-01 --to=2026-09-01   # backfill a window (the Jan→Sep load)
 *   npm run sync -- --report=logins                # one report only
 *   npm run sync -- --dry-run                      # read the API, write nothing
 *   npm run sync -- --status                       # just print where the cursors sit
 *   npm run sync -- --reset=2026-01-01             # rewind every cursor, then sync
 *
 * This is the same code path the hourly cron runs — a backfill is simply a sync
 * with an explicit `--from`. Nothing about it is special-cased, so if the
 * backfill works the cron works.
 *
 * `--from` overrides the stored cursor for THIS run only; the cursor still moves
 * forward as pages commit, so an interrupted backfill can be resumed by re-running
 * without `--from`.
 */
import "dotenv/config";
import { pool } from "../db.js";
import { runApiSync } from "../jobs/apiSync.js";
import { setCursor, readAllSyncState } from "../lib/syncState.js";
import { ALL_REPORTS, type ReportName } from "../ingest/types.js";
import { formatApiDateTime } from "../ingest/sources/api.js";

interface Args {
  from?: string;
  to?: string;
  reports?: ReportName[];
  maxPages?: number;
  dryRun: boolean;
  status: boolean;
  reset?: string;
}

function parseArgs(): Args {
  const out: Args = { dryRun: false, status: false };
  for (const arg of process.argv.slice(2)) {
    const eq = arg.indexOf("=");
    const key = eq >= 0 ? arg.slice(0, eq) : arg;
    const val = eq >= 0 ? arg.slice(eq + 1) : "";
    switch (key) {
      case "--from":
        out.from = val;
        break;
      case "--to":
        // A bare date means the whole of that day. `--to=2026-09-01` reading as
        // 2026-09-01 00:00:00 would silently drop that day's rows.
        out.to = /^\d{4}-\d{2}-\d{2}$/.test(val) ? `${val} 23:59:59` : val;
        break;
      case "--report": {
        const names = val.split(",").map((s) => s.trim()) as ReportName[];
        for (const n of names) {
          if (!ALL_REPORTS.includes(n)) {
            throw new Error(`--report must be one of ${ALL_REPORTS.join("|")}, got: ${n}`);
          }
        }
        out.reports = names;
        break;
      }
      case "--max-pages":
        out.maxPages = Number(val);
        if (!Number.isFinite(out.maxPages) || out.maxPages < 1) {
          throw new Error(`--max-pages must be a positive number, got: ${val}`);
        }
        break;
      case "--dry-run":
        out.dryRun = true;
        break;
      case "--status":
        out.status = true;
        break;
      case "--reset":
        out.reset = val;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return out;
}

async function printStatus(): Promise<void> {
  const rows = await readAllSyncState();
  if (rows.length === 0) {
    console.log("[sync] sync_state is empty — the next run starts from SYNC_START_DATE.");
    return;
  }
  console.table(
    rows.map((r) => ({
      report: r.report,
      "next cursor": r.nextStartDate ?? "-",
      "last run": r.lastSyncAt ?? "-",
      rows: r.rowsLastSync,
      pages: r.pagesLastSync,
      status: (r.lastStatus ?? "-").slice(0, 60),
    })),
  );
}

async function main(): Promise<void> {
  const args = parseArgs();

  if (args.status) {
    await printStatus();
    return;
  }

  if (args.reset !== undefined) {
    const cursor = args.reset ? formatApiDateTime(args.reset) : null;
    for (const r of args.reports ?? ALL_REPORTS) {
      await setCursor(r, cursor);
      console.log(`[sync] cursor for ${r} reset to ${cursor ?? "NULL (SYNC_START_DATE)"}`);
    }
  }

  const started = Date.now();
  const results = await runApiSync({
    from: args.from,
    to: args.to,
    reports: args.reports,
    maxPages: args.maxPages,
    persist: !args.dryRun,
  });

  console.table(
    results.map((r) => ({
      report: r.report,
      from: r.from,
      pages: r.pages,
      rows: r.rows,
      "next cursor": r.cursor ?? "(unchanged)",
      error: r.error ? r.error.slice(0, 60) : "",
    })),
  );
  console.log(`[sync] finished in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  await printStatus();
}

main()
  .then(() => pool.end())
  .catch(async (err) => {
    console.error("[sync] FAILED:", err instanceof Error ? err.message : err);
    await pool.end().catch(() => undefined);
    process.exit(1);
  });
