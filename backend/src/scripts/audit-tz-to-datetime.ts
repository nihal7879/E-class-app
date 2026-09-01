/**
 * Convert every `created_on` / `updated_on` column from TIMESTAMP to DATETIME so
 * the audit times read as Indian wall-clock in EVERY client, not just this app.
 *
 *   npm run db:audit-ist -- --dry-run   # show the plan, touch nothing
 *   npm run db:audit-ist                # apply
 *
 * ── Why ──────────────────────────────────────────────────────────────────────
 * This database lives on shared hosting whose clock is Pacific time
 * (`@@system_time_zone = Pacific Daylight Time`). A TIMESTAMP column stores an
 * instant as UTC and renders it in the READING session's time zone, so the same
 * row showed 2026-09-01 11:33 IST through this app and 2026-08-31 23:03 in
 * MySQL Workbench — a day earlier. `SET GLOBAL time_zone` is denied here (no
 * SUPER privilege on shared hosting), so the server cannot be corrected.
 *
 * The reference app (employee app, 195.250.20.169) has the identical column type
 * and no timezone handling at all; it reads correctly only because that server's
 * clock happens to be IST. We cannot copy the server, so we copy the outcome:
 * DATETIME is a literal wall-clock value that MySQL never converts, so once the
 * stored text is IST, every client — Workbench, phpMyAdmin, exports, this app —
 * shows the same Indian time.
 *
 * ── Why this is safe and reversible ──────────────────────────────────────────
 * MySQL renders the TIMESTAMP through the SESSION time zone when converting to
 * DATETIME. This script pins the session to +05:30 first, so the stored literal
 * becomes Indian wall-clock in one pass — no arithmetic, no shifting by hand.
 * The reverse (`MODIFY … TIMESTAMP` in a +05:30 session) restores the originals
 * exactly; the revert statements are printed at the end. DATETIME's range
 * (1000–9999) is wider than TIMESTAMP's (1970–2038), so nothing can overflow.
 */
import "dotenv/config";
import { pool } from "../db.js";
import { env } from "../config.js";

interface Col {
  table: string;
  column: string;
  nullable: boolean;
  columnDefault: string | null;
  extra: string; // e.g. 'on update CURRENT_TIMESTAMP'
}

/** Rebuild the column definition, swapping only the type. */
function definition(c: Col, type: "DATETIME" | "TIMESTAMP"): string {
  const parts = [type, c.nullable ? "NULL" : "NOT NULL"];
  if (c.columnDefault !== null) {
    // CURRENT_TIMESTAMP is a keyword, not a literal — never quote it.
    const isKeyword = /^CURRENT_TIMESTAMP(\(\d*\))?$/i.test(c.columnDefault);
    parts.push(`DEFAULT ${isKeyword ? c.columnDefault : pool.escape(c.columnDefault)}`);
  }
  if (/on update/i.test(c.extra)) parts.push("ON UPDATE CURRENT_TIMESTAMP");
  return parts.join(" ");
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const revert = process.argv.includes("--revert");
  const target = revert ? "TIMESTAMP" : "DATETIME";
  const source = revert ? "timestamp" : "datetime";

  const conn = await pool.getConnection();
  try {
    // Pin the session BEFORE reading or altering: this is the zone the values
    // are rendered into. Getting it wrong here shifts every row.
    await conn.query(`SET time_zone = '${env.DB_TIMEZONE}'`);
    const [tz] = await conn.query<any[]>("SELECT @@session.time_zone t, NOW() n");
    console.log(`[audit-ist] session time_zone = ${tz[0].t}   NOW() = ${String(tz[0].n)}`);
    if (tz[0].t !== env.DB_TIMEZONE) {
      throw new Error(`session time_zone is ${tz[0].t}, expected ${env.DB_TIMEZONE} — aborting`);
    }

    // `revert` looks for datetime columns, the forward pass for timestamp ones,
    // so re-running either way is a no-op once it has been applied.
    const [rows] = await conn.query<any[]>(
      `SELECT TABLE_NAME t, COLUMN_NAME c, IS_NULLABLE n, COLUMN_DEFAULT d, EXTRA e
         FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = ?
          AND COLUMN_NAME IN ('created_on','updated_on')
          AND DATA_TYPE = ?
        ORDER BY TABLE_NAME, COLUMN_NAME`,
      [env.DB_NAME, revert ? "datetime" : "timestamp"],
    );

    // Snapshot tables (`*_bak_YYYYMMDD`) are left exactly as they were taken —
    // a backup you keep editing isn't a backup. Pass --include-backups to convert
    // them too, e.g. if one is about to be restored into the live schema.
    const includeBackups = process.argv.includes("--include-backups");
    const isBackup = (t: string) => /_bak(_\d+)?$/i.test(t);

    const all: Col[] = rows.map((r) => ({
      table: r.t, column: r.c, nullable: r.n === "YES",
      columnDefault: r.d ?? null, extra: String(r.e ?? ""),
    }));
    const skipped = includeBackups ? [] : all.filter((c) => isBackup(c.table));
    const cols = includeBackups ? all : all.filter((c) => !isBackup(c.table));
    if (skipped.length > 0) {
      console.log(
        `[audit-ist] skipping ${skipped.length} column(s) in backup table(s): ` +
          `${[...new Set(skipped.map((c) => c.table))].join(", ")} (use --include-backups to convert)`,
      );
    }

    if (cols.length === 0) {
      console.log(`[audit-ist] nothing to do — no ${revert ? "DATETIME" : "TIMESTAMP"} audit columns left.`);
      return;
    }

    // Group per table so each table is altered in ONE statement — two ALTERs on
    // video_usage (190k rows) would rebuild it twice for no reason.
    const byTable = new Map<string, Col[]>();
    for (const c of cols) {
      if (!byTable.has(c.table)) byTable.set(c.table, []);
      byTable.get(c.table)!.push(c);
    }

    console.log(`[audit-ist] ${cols.length} column(s) across ${byTable.size} table(s) → ${target}`);
    const before = await sample(conn);
    console.log(`[audit-ist] sample before: ${before}`);

    const statements: string[] = [];
    for (const [table, list] of byTable) {
      const sql =
        `ALTER TABLE \`${table}\` ` +
        list.map((c) => `MODIFY COLUMN \`${c.column}\` ${definition(c, target)}`).join(", ");
      statements.push(sql);
    }

    if (dryRun) {
      console.log("[audit-ist] DRY RUN — would run:");
      for (const s of statements) console.log("   " + s);
      return;
    }

    for (const s of statements) {
      const started = Date.now();
      await conn.query(s);
      console.log(`[audit-ist] ok (${((Date.now() - started) / 1000).toFixed(1)}s): ${s.slice(0, 90)}…`);
    }

    console.log(`[audit-ist] sample after : ${await sample(conn)}`);
    console.log(
      `[audit-ist] to undo: npm run db:audit-ist -- ${revert ? "" : "--revert"}`.trim() +
        "   (round-trips exactly, run in the same +05:30 session)",
    );
    console.log(`[audit-ist] note: columns were ${source === "datetime" ? "DATETIME" : "TIMESTAMP"} before this run.`);
  } finally {
    conn.release();
  }
}

/** One representative value, so before/after is visible in the log. */
async function sample(conn: any): Promise<string> {
  const [r] = await conn.query(
    "SELECT created_on FROM login_history ORDER BY id DESC LIMIT 1",
  );
  return r[0] ? `login_history.created_on = ${String(r[0].created_on)}` : "(no rows)";
}

main()
  .then(() => pool.end())
  .catch(async (err) => {
    console.error("[audit-ist] FAILED:", err instanceof Error ? err.message : err);
    await pool.end().catch(() => undefined);
    process.exit(1);
  });
