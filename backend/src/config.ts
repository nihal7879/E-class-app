import "dotenv/config";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";

const EnvSchema = z.object({
  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().positive().default(3306),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().default(""),
  DB_NAME: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(4000),
  // Session time zone applied to every DB connection (see src/db.ts). The DB
  // host's clock is on Pacific time; without this, NOW() and every TIMESTAMP
  // audit column render 12h30m behind Indian wall-clock time. Must be a numeric
  // offset — this server has no named-zone tables loaded.
  DB_TIMEZONE: z.string().regex(/^[+-]\d{2}:\d{2}$/, "DB_TIMEZONE must be an offset like +05:30").default("+05:30"),
  CORS_ORIGIN: z.string().min(1),
  // Live reporting API (open, no auth). The cron + `ingest:api` read from here.
  ECLASS_API_BASE: z.string().url(),
  // Where the very first sync starts reading from, when `sync_state` has no
  // cursor yet for a report. Format 'YYYY-MM-DD' or 'YYYY-MM-DD HH:mm:ss'.
  SYNC_START_DATE: z.string().default("2026-01-01 00:00:00"),
  // Shared secret that guards the HTTP cron endpoint (/api/cron/daily-ingest).
  // Set on Vercel; Vercel Cron sends it as `Authorization: Bearer <CRON_SECRET>`.
  // Optional locally, where the in-process node-cron runs instead.
  CRON_SECRET: z.string().optional(),
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment variables:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

export const corsOrigins = env.CORS_ORIGIN.split(",")
  .map((s) => s.trim())
  .filter(Boolean);

/**
 * Cron config lives in a runtime JSON file — backend/config/cron.json — that is
 * read fresh from disk (NOT compiled into the build). The scheduler watches this
 * file and re-registers the job when it changes, so editing the schedule needs
 * neither a rebuild NOR a backend restart — just save the file.
 *
 * Precedence: env var (CRON_SCHEDULE / CRON_TZ) > cron.json > built-in default.
 * The file is resolved relative to the working directory (the backend folder),
 * so it stays editable next to the running app even after a production build.
 */
export interface CronConfig {
  schedule: string; // standard 5-field cron, e.g. "0 8 * * *"
  timezone: string; // IANA TZ, e.g. "Asia/Kolkata" (so 8 AM = 8 AM IST)
}

// Hardcoded, in-code schedule. This is the PRIMARY source of truth so a
// missing/unreadable config/cron.json on the server (wrong cwd, file not shipped
// with the build) can never silently disable the sync — which is exactly what
// happened before. config/cron.json and the CRON_SCHEDULE/CRON_TZ env vars are
// now only an OPTIONAL fallback/override.
//
// Hourly, on the hour. The upstream API is a cursor feed rather than a daily
// dump: each run asks "what has changed since my last cursor", so running it
// every 60 minutes keeps the dashboard at most an hour behind instead of a day.
export const DEFAULT_CRON_SCHEDULE = "0 * * * *";      // every hour, on the hour
export const DEFAULT_CRON_TIMEZONE = "Asia/Kolkata";   // IST

export const cronConfigPath = resolve(process.cwd(), "config/cron.json");

/**
 * Resolve the cron schedule. Precedence:
 *   1. CRON_SCHEDULE / CRON_TZ env vars (explicit override).
 *   2. config/cron.json (fallback override, read fresh so live edits apply).
 *   3. Hardcoded DEFAULT_CRON_* constants (always present, so the job can never
 *      end up unscheduled).
 */
export function loadCronConfig(): CronConfig {
  let file: { schedule?: unknown; timezone?: unknown } = {};
  try {
    file = JSON.parse(readFileSync(cronConfigPath, "utf8"));
  } catch {
    // Missing file or invalid JSON → the hardcoded defaults below still apply.
  }
  const schedule =
    process.env.CRON_SCHEDULE ??
    (typeof file.schedule === "string" ? file.schedule : undefined) ??
    DEFAULT_CRON_SCHEDULE;
  const timezone =
    process.env.CRON_TZ ??
    (typeof file.timezone === "string" ? file.timezone : undefined) ??
    DEFAULT_CRON_TIMEZONE;
  return { schedule, timezone };
}
