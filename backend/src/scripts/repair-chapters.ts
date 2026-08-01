/**
 * Backfill: restore the chapter serial number on MCQ rows already in the DB.
 *
 *   npm run db:repair-chapters -- --dry-run   # report only, touch nothing
 *   npm run db:repair-chapters                # apply
 *
 * The upstream MCQ endpoint drops the first character of every `Chapter` value
 * (so "15. एक होती समई" arrives as "5. एक होती समई" and "1. Real Numbers" as
 * ". Real Numbers") and glues multi-chapter attempts together. New rows are
 * repaired at ingest time; this script fixes everything ingested before that.
 * See src/ingest/chapterRepair.ts for the full write-up.
 *
 * Idempotent: the repair always runs from `chapter_raw` (what upstream sent),
 * never from an already-repaired value, so re-running is a no-op.
 */
import "dotenv/config";
import mysql from "mysql2/promise";
import { env } from "../config.js";
import {
  buildChapterCatalog,
  emptyStats,
  looksTruncated,
  repairChapter,
  type CatalogRow,
  type RepairKind,
} from "../ingest/chapterRepair.js";

const DRY_RUN = process.argv.slice(2).includes("--dry-run");

async function columnExists(conn: mysql.Connection, table: string, column: string): Promise<boolean> {
  const [rows] = await conn.query<any[]>(
    `SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [env.DB_NAME, table, column],
  );
  return rows.length > 0;
}

/** Migration 002, behind a guard (no portable ADD COLUMN IF NOT EXISTS in MySQL). */
async function ensureSchema(conn: mysql.Connection): Promise<void> {
  if (await columnExists(conn, "mcq_report", "chapter_raw")) {
    console.log("[repair] mcq_report.chapter_raw already present");
    return;
  }
  if (DRY_RUN) {
    console.log("[repair] (dry-run) would add mcq_report.chapter_raw and widen chapter to VARCHAR(1024)");
    return;
  }
  // Widened because a repaired multi-chapter value re-emits several names.
  await conn.query(
    `ALTER TABLE mcq_report
       MODIFY COLUMN chapter VARCHAR(1024) NULL,
       ADD COLUMN chapter_raw VARCHAR(1024) NULL AFTER chapter`,
  );
  console.log("[repair] added mcq_report.chapter_raw, widened chapter to VARCHAR(1024)");
}

async function main(): Promise<void> {
  const conn = await mysql.createConnection({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
  });
  console.log(`[repair] ${env.DB_NAME} @ ${env.DB_HOST}${DRY_RUN ? "  (dry-run)" : ""}`);

  try {
    await ensureSchema(conn);
    const hasRawColumn = await columnExists(conn, "mcq_report", "chapter_raw");

    // Chapter catalogue — video_usage carries the same chapters, un-truncated.
    const [catalogRows] = await conn.query<any[]>(
      `SELECT DISTINCT course, subject, chapter
         FROM video_usage
        WHERE chapter IS NOT NULL AND chapter <> ''`,
    );
    console.log(`[repair] catalogue: ${catalogRows.length} distinct video chapters`);
    const catalog = buildChapterCatalog(catalogRows as CatalogRow[]);

    // Always repair from the ORIGINAL upstream value so re-runs are stable.
    const source = hasRawColumn ? "COALESCE(NULLIF(chapter_raw, ''), chapter)" : "chapter";
    const rawMissing = hasRawColumn ? "SUM(chapter_raw IS NULL) AS rawMissing" : "COUNT(*) AS rawMissing";
    const [groups] = await conn.query<any[]>(
      `SELECT course, subject, chapter AS cur, ${source} AS src, ${rawMissing}, COUNT(*) AS n
         FROM mcq_report
        WHERE chapter IS NOT NULL AND chapter <> ''
        GROUP BY course, subject, chapter, src`,
    );

    // Check before repairing: if the stored upstream values already carry their
    // chapter numbers, there is nothing to fix and we touch nothing.
    const broken = looksTruncated(groups.map((g: any) => ({ chapter: g.src })));
    if (!broken) {
      console.log(
        "[repair] chapter numbers look correct in the stored upstream values — " +
          "nothing to repair.",
      );
      return;
    }

    const stats = emptyStats();
    let rowsChanged = 0;
    let rowsTotal = 0;
    const examples: string[] = [];

    for (const g of groups) {
      const n = Number(g.n);
      rowsTotal += n;
      const { chapter, kind } = repairChapter(g.course, g.subject, g.src, catalog);
      stats[kind as RepairKind] += n;

      // Already repaired on an earlier run (and chapter_raw filled) — skip, so
      // re-running writes nothing at all.
      if (chapter === g.cur && Number(g.rawMissing) === 0) continue;

      if (chapter !== g.cur) {
        rowsChanged += n;
        if (examples.length < 10) {
          examples.push(`  ${JSON.stringify(g.cur)}  ->  ${JSON.stringify(chapter)}`);
        }
      }
      if (DRY_RUN) continue;

      // <=> is NULL-safe equality — course/subject can legitimately be NULL.
      await conn.query(
        `UPDATE mcq_report
            SET chapter = ?, chapter_raw = ?
          WHERE course <=> ? AND subject <=> ? AND ${source} <=> ?`,
        [chapter, g.src, g.course, g.subject, g.src],
      );
    }

    console.log(`\n[repair] outcomes by row: ${JSON.stringify(stats)}`);
    console.log(`[repair] ${DRY_RUN ? "would change" : "changed"} ${rowsChanged}/${rowsTotal} rows`);
    if (examples.length > 0) console.log("[repair] examples:\n" + examples.join("\n"));
    const left = stats.unmatched + stats.ambiguous;
    if (left > 0) {
      console.log(
        `[repair] ${left} row(s) left exactly as upstream sent them — no unique match, ` +
          "so no serial number was invented.",
      );
    }
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error("[repair] FAILED:", err instanceof Error ? err.message : err);
  process.exit(1);
});
