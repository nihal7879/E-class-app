/** Date helpers for the daily ingest (server-local time). */

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Yesterday as YYYY-MM-DD — what the morning cron ingests (today 16th → 15th). */
export function yesterdayISO(now: Date = new Date()): string {
  const d = new Date(now);
  d.setDate(d.getDate() - 1);
  return toISODate(d);
}

export function isISODate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

/**
 * Split an inclusive [from, to] date range into calendar-month windows, e.g.
 * 2026-01-01..2026-06-20 → [01-01..01-31, 02-01..02-28, …, 06-01..06-20].
 *
 * Used by the range backfill: the VideoUsage report for a full 6-month span is
 * ~38 MB and node's fetch drops it, so we ingest one month at a time instead.
 */
export function monthlyWindows(from: string, to: string): Array<{ from: string; to: string }> {
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  const windows: Array<{ from: string; to: string }> = [];
  let cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cursor <= end) {
    const monthStart = cursor > start ? cursor : start;
    const lastOfMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    const monthEnd = lastOfMonth < end ? lastOfMonth : end;
    windows.push({ from: toISODate(monthStart), to: toISODate(monthEnd) });
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }
  return windows;
}
