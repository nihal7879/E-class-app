/**
 * One-off cleanup after the first full cursor sync.
 *
 *   npm run db:prune-legacy -- --dry-run   # counts only, writes nothing
 *   npm run db:prune-legacy                # delete
 *
 * Rows ingested BEFORE migration 003 have `upstream_id = NULL` — they predate the
 * dedupe key, so the sync cannot recognise them as the same records it re-fetches
 * and inserts fresh copies alongside them. Once a sync has re-covered the range
 * those legacy rows are exact duplicates and every dashboard number is inflated.
 *
 * This deletes them. It is safe ONLY after a sync has actually re-covered the
 * range they span, so the script refuses to run unless each table already holds
 * more rows WITH an upstream_id than without — a crude but effective guard
 * against wiping data that has not been replaced yet.
 *
 * Not needed on a database bootstrapped from the current sql/schema.sql.
 */
import "dotenv/config";
import { pool } from "../db.js";

const TABLES = ["login_history", "video_usage", "mcq_report"] as const;

async function counts(table: string): Promise<{ legacy: number; synced: number }> {
  const [rows] = await pool.query<any[]>(
    `SELECT SUM(upstream_id IS NULL) AS legacy, SUM(upstream_id IS NOT NULL) AS synced
       FROM \`${table}\``,
  );
  return { legacy: Number(rows[0]?.legacy ?? 0), synced: Number(rows[0]?.synced ?? 0) };
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const force = process.argv.includes("--force");

  const plan: Array<{ table: string; legacy: number; synced: number }> = [];
  for (const table of TABLES) {
    const c = await counts(table);
    plan.push({ table, ...c });
  }
  console.table(plan);

  if (!force) {
    const unsafe = plan.filter((p) => p.legacy > 0 && p.synced <= p.legacy);
    if (unsafe.length > 0) {
      console.error(
        "[prune] REFUSING: these tables hold no more synced rows than legacy ones, " +
          "so the sync has probably not re-covered the range yet:\n  " +
          unsafe.map((u) => `${u.table} (legacy ${u.legacy} vs synced ${u.synced})`).join("\n  ") +
          "\nRun the sync first, or pass --force if you are certain.",
      );
      process.exitCode = 1;
      return;
    }
  }

  if (dryRun) {
    const total = plan.reduce((a, p) => a + p.legacy, 0);
    console.log(`[prune] DRY RUN — would delete ${total} legacy row(s). Nothing written.`);
    return;
  }

  // One transaction: either every table sheds its legacy rows or none does, so
  // the dashboard is never left half-corrected.
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const { table } of TABLES.map((t) => ({ table: t }))) {
      const [res] = await conn.query<any>(
        `DELETE FROM \`${table}\` WHERE upstream_id IS NULL`,
      );
      console.log(`[prune] ${table}: deleted ${res.affectedRows} legacy row(s)`);
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  console.log("[prune] after:");
  console.table(
    await Promise.all(
      TABLES.map(async (table) => ({ table, ...(await counts(table)) })),
    ),
  );
}

main()
  .then(() => pool.end())
  .catch(async (err) => {
    console.error("[prune] FAILED:", err instanceof Error ? err.message : err);
    await pool.end().catch(() => undefined);
    process.exit(1);
  });
