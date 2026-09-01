/**
 * Per-report sync cursor, persisted in the `sync_state` table.
 *
 * The reporting API's fromDate/toDate window filters on an upstream sync
 * timestamp, not on the row's own date, and hands back a `NextStartDate` cursor
 * to resume from. Storing that cursor is what makes the hourly job incremental:
 * each run asks only for "everything upstream has synced since I last looked".
 *
 * The cursor is written only AFTER the rows it covers are committed, so an
 * interrupted run re-fetches its last page instead of skipping it. That makes
 * delivery at-least-once, which is safe because every row upserts on
 * `upstream_id` (see sql/migrations/003_sync_state.sql).
 */
import { pool } from "../db.js";
import type { ReportName } from "../ingest/types.js";

export interface SyncState {
  report: ReportName;
  nextStartDate: string | null; // 'YYYY-MM-DD HH:mm:ss'
  lastSyncAt: string | null;
  lastStatus: string | null;
  rowsLastSync: number;
  pagesLastSync: number;
}

/** MySQL DATETIME → the 'YYYY-MM-DD HH:mm:ss' string the API wants. */
function toDateTimeString(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) {
    const p = (n: number) => String(n).padStart(2, "0");
    return (
      `${v.getFullYear()}-${p(v.getMonth() + 1)}-${p(v.getDate())} ` +
      `${p(v.getHours())}:${p(v.getMinutes())}:${p(v.getSeconds())}`
    );
  }
  return String(v).replace("T", " ").slice(0, 19);
}

export async function readSyncState(report: ReportName): Promise<SyncState | null> {
  const [rows] = await pool.query<any[]>(
    `SELECT report, next_start_date, last_sync_at, last_status, rows_last_sync, pages_last_sync
       FROM sync_state WHERE report = ?`,
    [report],
  );
  const r = rows[0];
  if (!r) return null;
  return {
    report,
    nextStartDate: toDateTimeString(r.next_start_date),
    lastSyncAt: toDateTimeString(r.last_sync_at),
    lastStatus: r.last_status ?? null,
    rowsLastSync: Number(r.rows_last_sync ?? 0),
    pagesLastSync: Number(r.pages_last_sync ?? 0),
  };
}

export async function readAllSyncState(): Promise<SyncState[]> {
  const [rows] = await pool.query<any[]>(
    `SELECT report, next_start_date, last_sync_at, last_status, rows_last_sync, pages_last_sync
       FROM sync_state ORDER BY report`,
  );
  return rows.map((r) => ({
    report: r.report as ReportName,
    nextStartDate: toDateTimeString(r.next_start_date),
    lastSyncAt: toDateTimeString(r.last_sync_at),
    lastStatus: r.last_status ?? null,
    rowsLastSync: Number(r.rows_last_sync ?? 0),
    pagesLastSync: Number(r.pages_last_sync ?? 0),
  }));
}

/**
 * Move the cursor forward. Never moves it BACKWARDS: a page that returns an
 * older NextStartDate than the one already stored (upstream glitch, or a manual
 * backfill run over an old window finishing after the hourly job) must not undo
 * the progress the hourly job has made.
 */
export async function advanceCursor(report: ReportName, nextStartDate: string): Promise<void> {
  await pool.query(
    `INSERT INTO sync_state (report, next_start_date)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE
       next_start_date = GREATEST(COALESCE(next_start_date, '1000-01-01'), VALUES(next_start_date))`,
    [report, nextStartDate],
  );
}

/**
 * Record the outcome of a run (does not touch the cursor).
 *
 * The timestamp is taken from THIS process, not from MySQL's NOW(). The database
 * server runs on Pacific time while `next_start_date` is upstream's wall clock
 * (IST), so NOW() wrote a `last_sync_at` 12.5 hours adrift of the cursor sitting
 * next to it in the same row — the two looked like different moments when they
 * were the same one. Both columns now read in the app's local time.
 */
export async function recordSyncRun(
  report: ReportName,
  status: string,
  rows: number,
  pages: number,
): Promise<void> {
  const now = toDateTimeString(new Date());
  await pool.query(
    `INSERT INTO sync_state (report, last_sync_at, last_status, rows_last_sync, pages_last_sync)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       last_sync_at   = VALUES(last_sync_at),
       last_status    = VALUES(last_status),
       rows_last_sync = VALUES(rows_last_sync),
       pages_last_sync= VALUES(pages_last_sync)`,
    [report, now, status.slice(0, 512), rows, pages],
  );
}

/** Force the cursor to a specific value — used by the backfill CLI's --reset. */
export async function setCursor(report: ReportName, nextStartDate: string | null): Promise<void> {
  await pool.query(
    `INSERT INTO sync_state (report, next_start_date)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE next_start_date = VALUES(next_start_date)`,
    [report, nextStartDate],
  );
}
