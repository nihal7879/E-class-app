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
  CORS_ORIGIN: z.string().default("http://localhost:5173,http://localhost:5174"),
  // Live reporting API (open, no auth). The cron + `ingest:api` read from here.
  ECLASS_API_BASE: z.string().url().default("https://dashboard1.sundarameclass.com"),
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

export const cronConfigPath = resolve(process.cwd(), "config/cron.json");

/** Read the cron config fresh from disk every call (so live edits are picked up). */
export function loadCronConfig(): CronConfig {
  let file: { schedule?: unknown; timezone?: unknown } = {};
  try {
    file = JSON.parse(readFileSync(cronConfigPath, "utf8"));
  } catch {
    // Missing file or invalid JSON → fall back to env / defaults below.
  }
  const schedule =
    process.env.CRON_SCHEDULE ??
    (typeof file.schedule === "string" ? file.schedule : undefined) ??
    "0 8 * * *";
  const timezone =
    process.env.CRON_TZ ??
    (typeof file.timezone === "string" ? file.timezone : undefined) ??
    "Asia/Kolkata";
  return { schedule, timezone };
}
