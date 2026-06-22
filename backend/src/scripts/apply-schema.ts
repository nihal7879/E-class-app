/**
 * Apply sql/schema.sql to the configured DB (DB_* in .env), then print the
 * resulting table structures. Drops any leftover placeholder `test` table first.
 *
 *   npm run db:apply-schema   (one-off; see package.json)
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";
import { env } from "../config.js";

const SCHEMA_PATH = fileURLToPath(new URL("../../sql/schema.sql", import.meta.url));

async function main(): Promise<void> {
  const conn = await mysql.createConnection({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    multipleStatements: true,
  });
  console.log(`[apply] connected to ${env.DB_NAME} @ ${env.DB_HOST}:${env.DB_PORT}`);

  // Remove the placeholder table the DB shipped with, if present.
  await conn.query("DROP TABLE IF EXISTS `test`");

  // schema.sql is self-contained (DROP + CREATE for all tables, audit cols, indexes).
  await conn.query(readFileSync(SCHEMA_PATH, "utf8"));
  console.log("[apply] schema.sql applied");

  const [tables] = await conn.query<any[]>(
    `SELECT TABLE_NAME FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME`,
    [env.DB_NAME],
  );
  console.log(`\n[apply] ${tables.length} table(s) now present:\n`);
  for (const t of tables) {
    const [rows] = await conn.query<any[]>(`SHOW CREATE TABLE \`${t.TABLE_NAME}\``);
    console.log(rows[0]["Create Table"] + ";\n");
  }

  await conn.end();
}

main().catch((e) => {
  console.error("[apply] FAILED:", e instanceof Error ? e.message : e);
  process.exit(1);
});
