/**
 * One-off historical backfill from the live reporting API.
 *
 *   npm run db:backfill                              # 2026-01-01 .. 2026-06-16 (default)
 *   npm run db:backfill -- --from=2026-01-01 --to=2026-06-16
 *
 * Fetches the API in monthly chunks (keeps each response a manageable size) and
 * loads them into the DB pointed at by backend/.env. The FIRST chunk loads in
 * 'replace' mode (TRUNCATEs login_history / video_usage / mcq_report / users),
 * every later chunk in 'append' mode — so the whole run is idempotent: re-running
 * it reproduces the same result instead of duplicating rows.
 *
 * Chunks are disjoint date ranges, so append never double-inserts a fact row.
 */
import "dotenv/config";
import { env } from "../config.js";
import { readFromApi } from "../ingest/sources/api.js";
import { loadBatch, type IngestMode } from "../ingest/loader.js";
import { pool } from "../db.js";
import { isISODate } from "../lib/dates.js";

const DEFAULT_FROM = "2026-01-01";
const DEFAULT_TO = "2026-06-16";

function parseArgs(): { from: string; to: string } {
  let from = DEFAULT_FROM;
  let to = DEFAULT_TO;
  for (const arg of process.argv.slice(2)) {
    const [k, v = ""] = arg.split("=");
    if (k === "--from") from = v;
    else if (k === "--to") to = v;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!isISODate(from)) throw new Error(`--from must be YYYY-MM-DD, got: ${from}`);
  if (!isISODate(to)) throw new Error(`--to must be YYYY-MM-DD, got: ${to}`);
  if (from > to) throw new Error(`--from (${from}) is after --to (${to})`);
  return { from, to };
}

/** Inclusive list of [chunkFrom, chunkTo] monthly windows clipped to [from, to]. */
function monthlyChunks(from: string, to: string): Array<[string, string]> {
  const chunks: Array<[string, string]> = [];
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  let y = fy;
  let m = fm; // 1-based month
  while (y < ty || (y === ty && m <= tm)) {
    const monthStart = `${y}-${String(m).padStart(2, "0")}-01`;
    // Last day of this month: day 0 of next month.
    const lastDay = new Date(y, m, 0).getDate();
    const monthEnd = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    const chunkFrom = monthStart < from ? from : monthStart;
    const chunkTo = monthEnd > to ? to : monthEnd;
    chunks.push([chunkFrom, chunkTo]);
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return chunks;
}

async function main(): Promise<void> {
  const { from, to } = parseArgs();
  const chunks = monthlyChunks(from, to);
  console.log(
    `[backfill] ${from} .. ${to} in ${chunks.length} monthly chunk(s) ` +
      `→ ${env.DB_NAME} @ ${env.DB_HOST}  base=${env.ECLASS_API_BASE}\n`,
  );

  const totals = { users: 0, logins: 0, videos: 0, mcq: 0, institutes: 0, mediums: 0 };

  for (let i = 0; i < chunks.length; i++) {
    const [cFrom, cTo] = chunks[i];
    const mode: IngestMode = i === 0 ? "replace" : "append";
    process.stdout.write(`[backfill] ${cFrom} .. ${cTo}  (mode=${mode})  fetching… `);

    const batch = await readFromApi({ base: env.ECLASS_API_BASE, fromDate: cFrom, toDate: cTo });
    process.stdout.write(
      `parsed ${batch.logins.length} logins / ${batch.videos.length} videos / ` +
        `${batch.mcq.length} mcq / ${batch.users.length} users — loading… `,
    );

    const r = await loadBatch(batch, { mode });
    console.log("done");

    totals.logins += r.logins;
    totals.videos += r.videos;
    totals.mcq += r.mcq;
    // users/institutes/mediums are upserts across chunks; report the last-seen batch sizes summed
    totals.users += r.users;
    totals.institutes += r.institutes;
    totals.mediums += r.mediums;
  }

  console.log("\n[backfill] inserted fact rows:");
  console.log(`  logins : ${totals.logins}`);
  console.log(`  videos : ${totals.videos}`);
  console.log(`  mcq    : ${totals.mcq}`);

  // Report the authoritative row counts straight from the DB.
  const [counts] = await pool.query<any[]>(
    `SELECT
       (SELECT COUNT(*) FROM users)         AS users,
       (SELECT COUNT(*) FROM institutes)    AS institutes,
       (SELECT COUNT(*) FROM mediums)       AS mediums,
       (SELECT COUNT(*) FROM login_history) AS login_history,
       (SELECT COUNT(*) FROM video_usage)   AS video_usage,
       (SELECT COUNT(*) FROM mcq_report)    AS mcq_report`,
  );
  console.log("\n[backfill] final DB row counts:", counts[0]);
}

main()
  .then(() => pool.end())
  .catch(async (err) => {
    console.error("\n[backfill] FAILED:", err instanceof Error ? err.message : err);
    await pool.end().catch(() => undefined);
    process.exit(1);
  });
