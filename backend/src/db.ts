import mysql from "mysql2/promise";
import { env } from "./config.js";

export const pool = mysql.createPool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true,
});

/**
 * Every connection runs in IST.
 *
 * The database host's own clock is on Pacific time, so by default `NOW()`,
 * `CURRENT_TIMESTAMP` and every `created_on` / `updated_on` value read back
 * 12h30m behind Indian wall-clock time — a row written at 11:33 IST displayed as
 * 23:03 the previous day.
 *
 * The audit columns are `TIMESTAMP`, which MySQL stores internally as UTC and
 * converts on both read and write using the SESSION time zone. So this setting
 * is not a migration and rewrites nothing: it fixes existing rows' display as
 * well as new writes, because the stored instants were always correct — only the
 * zone they were rendered in was wrong. `DATE`, `TIME` and `DATETIME` columns
 * (login_date, session_time, sync_state.*) are zone-independent literals and are
 * unaffected either way.
 *
 * A numeric offset, not 'Asia/Kolkata': this server rejects named zones
 * ("Unknown or incorrect time zone") because the `mysql.time_zone` tables aren't
 * populated, which is normal on shared hosting. India has never observed DST, so
 * a fixed +05:30 is exact year-round rather than an approximation.
 *
 * `pool.on("connection")` fires once per NEW physical connection, and MySQL runs
 * a connection's queries in order, so this lands before any caller's query on
 * that connection.
 */
pool.on("connection", (conn) => {
  // mysql2's types declare this parameter as the promise-wrapped connection, but
  // at runtime the event carries the callback-style core connection — awaiting
  // its query() throws "not a promise". The callback form is the correct API here
  // regardless of what the type says.
  const raw = conn as unknown as {
    query: (sql: string, cb: (err: unknown) => void) => void;
  };
  raw.query(`SET time_zone = '${env.DB_TIMEZONE}'`, (err) => {
    if (!err) return;
    // Not fatal — queries still work, timestamps just render in the server's
    // zone. Loud, because silently-wrong times are how this was missed.
    console.error(
      `[db] could not set session time_zone to ${env.DB_TIMEZONE}: ` +
        `${err instanceof Error ? err.message : String(err)}`,
    );
  });
});

export async function pingDb(): Promise<boolean> {
  try {
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    return true;
  } catch (err) {
    console.error("DB ping failed:", (err as Error).message);
    return false;
  }
}
