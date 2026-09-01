/**
 * Dev database bootstrap.
 *
 *   npm run db:bootstrap-dev
 *
 * Creates an isolated dev database (default: eclass_dashboard_dev) on the SAME
 * MySQL host as production, copies the production STRUCTURE ONLY (no data), then
 * applies the institutes/mediums migration. Production is never written to.
 *
 * Source/target names can be overridden via env:
 *   SOURCE_DB=eclass_dashboard  DEV_DB=eclass_dashboard_dev
 *
 * After a successful run, point the app at the dev DB by setting
 *   DB_NAME=eclass_dashboard_dev
 * in backend/.env (host/user/password stay the same).
 *
 * If the MySQL user lacks the CREATE privilege (common on shared hosting), the
 * script prints a clear message — create the DB via cPanel, grant the user, re-run.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";
import { env } from "../config.js";

const SOURCE_DB = process.env.SOURCE_DB ?? "eclass_dashboard";
const DEV_DB = process.env.DEV_DB ?? "eclass_dashboard_dev";

const MIGRATION_PATH = fileURLToPath(
  new URL("../../sql/migrations/001_institutes_mediums.sql", import.meta.url),
);
const SCHEMA_PATH = fileURLToPath(new URL("../../sql/schema.sql", import.meta.url));

async function tableCount(conn: mysql.Connection, db: string): Promise<number> {
  const [rows] = await conn.query<any[]>(
    `SELECT COUNT(*) AS n FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'`,
    [db],
  );
  return Number(rows[0]?.n ?? 0);
}

function ident(name: string): string {
  // Backtick-quote an identifier; reject anything that isn't a plain name so we
  // never interpolate something unexpected into DDL.
  if (!/^[A-Za-z0-9_]+$/.test(name)) {
    throw new Error(`Unsafe identifier: ${name}`);
  }
  return `\`${name}\``;
}

async function main(): Promise<void> {
  console.log(`[bootstrap] source=${SOURCE_DB} dev=${DEV_DB} host=${env.DB_HOST}`);

  const conn = await mysql.createConnection({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    multipleStatements: true,
  });

  try {
    // 1. Create the dev database.
    try {
      await conn.query(
        `CREATE DATABASE IF NOT EXISTS ${ident(DEV_DB)} ` +
          `CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
      );
      console.log(`[bootstrap] database ${DEV_DB} ready`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[bootstrap] could not CREATE DATABASE ${DEV_DB}: ${msg}`);
      console.error(
        "[bootstrap] Your MySQL user likely lacks CREATE privilege (shared hosting). " +
          `Create '${DEV_DB}' via cPanel, grant the user access, then re-run.`,
      );
      process.exit(1);
    }

    // 2. Populate the dev structure. Three cases:
    //    a) dev already has tables  → leave them (idempotent re-run)
    //    b) a SOURCE_DB exists here → copy its structure (remote/prod scenario)
    //    c) neither                 → initialize fresh from schema.sql (local scenario)
    await conn.query(`USE ${ident(DEV_DB)}`);
    const devTables = await tableCount(conn, DEV_DB);
    if (devTables > 0) {
      console.log(`[bootstrap] ${DEV_DB} already has ${devTables} tables — skipping structure init`);
    } else if ((await tableCount(conn, SOURCE_DB)) > 0) {
      console.log(`[bootstrap] copying structure from ${SOURCE_DB} (no data)…`);
      await conn.query("SET FOREIGN_KEY_CHECKS = 0");
      const [tableRows] = await conn.query<any[]>(
        `SELECT TABLE_NAME AS name FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'`,
        [SOURCE_DB],
      );
      for (const { name } of tableRows) {
        const [createRows] = await conn.query<any[]>(
          `SHOW CREATE TABLE ${ident(SOURCE_DB)}.${ident(name)}`,
        );
        const ddl: string = createRows[0]["Create Table"];
        const devDdl = ddl.replace(/^CREATE TABLE /i, "CREATE TABLE IF NOT EXISTS ");
        await conn.query(`USE ${ident(DEV_DB)}`);
        await conn.query(devDdl);
        console.log(`[bootstrap] copied structure: ${name}`);
      }
      await conn.query("SET FOREIGN_KEY_CHECKS = 1");
    } else {
      console.log(`[bootstrap] no source DB '${SOURCE_DB}' here — initializing from schema.sql`);
      await conn.query(`USE ${ident(DEV_DB)}`);
      await conn.query(readFileSync(SCHEMA_PATH, "utf8"));
      console.log("[bootstrap] schema.sql applied");
    }

    // 3. Apply the institutes/mediums migration into the dev DB.
    await conn.query(`USE ${ident(DEV_DB)}`);
    const migration = readFileSync(MIGRATION_PATH, "utf8");
    await conn.query(migration);
    console.log("[bootstrap] applied migration: institutes, mediums");

    // 4. Add users.institute_id / users.medium_id if missing (guarded — no
    //    portable ADD COLUMN IF NOT EXISTS).
    await addColumnIfMissing(conn, "users", "institute_id", "INT NULL", "idx_institute");
    await addColumnIfMissing(conn, "users", "medium_id", "INT NULL", "idx_medium");

    // 4b. Migration 002 — mcq_report.chapter_raw keeps the untouched upstream
    //     chapter string next to the repaired one (see ingest/chapterRepair.ts).
    await addColumnIfMissing(conn, "mcq_report", "chapter_raw", "VARCHAR(1024) NULL");

    // 5. Audit columns on every table: created_on / updated_on / is_deleted / is_active.
    //    created_on gets an index (drives date-based deletes/rollbacks).
    const AUDIT_TABLES = ["users", "login_history", "video_usage", "mcq_report", "institutes", "mediums"];
    for (const t of AUDIT_TABLES) {
      await addColumnIfMissing(conn, t, "created_on", "TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP", `idx_${t}_created`);
      await addColumnIfMissing(conn, t, "updated_on", "TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
      await addColumnIfMissing(conn, t, "is_deleted", "TINYINT(1) NOT NULL DEFAULT 0");
      await addColumnIfMissing(conn, t, "is_active", "TINYINT(1) NOT NULL DEFAULT 1");
    }

    // 6. Surrogate auto-increment `id` on institutes/mediums (the other tables
    //    already have one). Keeps every table consistent with an incrementing id.
    await addAutoIdIfMissing(conn, "institutes");
    await addAutoIdIfMissing(conn, "mediums");

    console.log(`[bootstrap] done. Set DB_NAME=${DEV_DB} in backend/.env to use it.`);
  } finally {
    await conn.end();
  }
}

async function addColumnIfMissing(
  conn: mysql.Connection,
  table: string,
  column: string,
  definition: string,
  indexName?: string,
): Promise<void> {
  const [cols] = await conn.query<any[]>(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [DEV_DB, table, column],
  );
  if (cols.length > 0) {
    console.log(`[bootstrap] ${table}.${column} already present`);
    return;
  }
  const addIndex = indexName ? `, ADD KEY ${ident(indexName)} (${ident(column)})` : "";
  await conn.query(
    `ALTER TABLE ${ident(table)} ADD COLUMN ${ident(column)} ${definition}${addIndex}`,
  );
  console.log(`[bootstrap] added ${table}.${column}`);
}

async function addAutoIdIfMissing(conn: mysql.Connection, table: string): Promise<void> {
  const [cols] = await conn.query<any[]>(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = 'id'`,
    [DEV_DB, table],
  );
  if (cols.length > 0) {
    console.log(`[bootstrap] ${table}.id already present`);
    return;
  }
  // AUTO_INCREMENT requires the column be a key; UNIQUE satisfies it. FIRST puts
  // it at the front. Existing rows are backfilled 1..N automatically.
  await conn.query(
    `ALTER TABLE ${ident(table)} ADD COLUMN id BIGINT NOT NULL AUTO_INCREMENT UNIQUE FIRST`,
  );
  console.log(`[bootstrap] added ${table}.id (auto-increment)`);
}

main().catch((err) => {
  console.error("[bootstrap] FAILED:", err instanceof Error ? err.message : err);
  process.exit(1);
});












