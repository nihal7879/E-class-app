/**
 * Apply migration 003 (cursor sync) to the configured DB — idempotently.
 *
 *   npm run db:migrate-sync
 *
 * MySQL has no portable "ADD COLUMN IF NOT EXISTS" / "ADD INDEX IF NOT EXISTS",
 * so each step is guarded on information_schema and skipped when already present.
 * Safe to run repeatedly, and safe to run against a DB that already has data:
 * existing rows get upstream_id = NULL, which a UNIQUE index permits any number
 * of, so they neither collide nor participate in dedupe.
 *
 * See sql/migrations/003_sync_state.sql for why this is needed.
 */
import "dotenv/config";
import { pool } from "../db.js";
import { env } from "../config.js";

async function columnExists(table: string, column: string): Promise<boolean> {
  const [rows] = await pool.query<any[]>(
    `SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [env.DB_NAME, table, column],
  );
  return rows.length > 0;
}

async function indexExists(table: string, index: string): Promise<boolean> {
  const [rows] = await pool.query<any[]>(
    `SELECT 1 FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [env.DB_NAME, table, index],
  );
  return rows.length > 0;
}

async function tableExists(table: string): Promise<boolean> {
  const [rows] = await pool.query<any[]>(
    `SELECT 1 FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
    [env.DB_NAME, table],
  );
  return rows.length > 0;
}

const FACT_TABLES: Array<{ table: string; index: string }> = [
  { table: "login_history", index: "uq_login_upstream" },
  { table: "video_usage", index: "uq_video_upstream" },
  { table: "mcq_report", index: "uq_mcq_upstream" },
];

async function main(): Promise<void> {
  console.log(`[migrate] target: ${env.DB_NAME} @ ${env.DB_HOST}:${env.DB_PORT}`);

  for (const { table, index } of FACT_TABLES) {
    if (await columnExists(table, "upstream_id")) {
      console.log(`[migrate] ${table}.upstream_id already present — skipped`);
    } else {
      await pool.query(
        `ALTER TABLE \`${table}\` ADD COLUMN upstream_id VARCHAR(64) NULL AFTER user_id`,
      );
      console.log(`[migrate] ${table}.upstream_id added`);
    }

    if (await indexExists(table, index)) {
      console.log(`[migrate] ${table}.${index} already present — skipped`);
    } else {
      // A pre-existing table can already hold duplicate rows from before the
      // dedupe key existed; those all have upstream_id NULL, which never
      // conflicts, so this index can be added without a cleanup pass.
      await pool.query(`ALTER TABLE \`${table}\` ADD UNIQUE KEY \`${index}\` (upstream_id)`);
      console.log(`[migrate] ${table}.${index} added`);
    }
  }

  if (await tableExists("sync_state")) {
    console.log("[migrate] sync_state already present — skipped");
  } else {
    await pool.query(
      `CREATE TABLE sync_state (
         report          VARCHAR(32)  NOT NULL PRIMARY KEY,
         next_start_date DATETIME     NULL,
         last_sync_at    DATETIME     NULL,
         last_status     VARCHAR(512) NULL,
         rows_last_sync  INT          NOT NULL DEFAULT 0,
         pages_last_sync INT          NOT NULL DEFAULT 0,
         created_on      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
         updated_on      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
         is_deleted      TINYINT(1)   NOT NULL DEFAULT 0,
         is_active       TINYINT(1)   NOT NULL DEFAULT 1
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    );
    console.log("[migrate] sync_state created");
  }

  const [state] = await pool.query<any[]>("SELECT * FROM sync_state ORDER BY report");
  console.log("[migrate] sync_state now holds:", state.length ? state : "(empty — first sync will seed it)");
  console.log("[migrate] done.");
}

main()
  .then(() => pool.end())
  .catch(async (err) => {
    console.error("[migrate] FAILED:", err instanceof Error ? err.message : err);
    await pool.end().catch(() => undefined);
    process.exit(1);
  });
