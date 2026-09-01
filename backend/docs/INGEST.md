# Data Ingestion — Two Flows

The dashboard needs login/video/MCQ rows in MySQL. Two interchangeable sources can feed those tables:

| Flow | Source | When to use |
|------|--------|-------------|
| **1 — API sync (primary)** | `dashboard1.sundarameclass.com` reporting API | Always. Runs hourly on its own; `npm run sync` for backfills. |
| **2 — Excel (fallback)** | Local `.xlsx` report | Only when the API is down or a one-off correction is needed. |

Both flows go through the same pipeline and end up in the same tables. Switching flows changes **one CLI flag** — nothing else.

```
┌─────────────────────────┐
│ Source                  │
│  - excel.ts  (Flow 2)   │  ──►  IngestBatch  ──►  loader.ts  ──►  MySQL
│  - api.ts    (Flow 1)   │       (one page)
└─────────────────────────┘
        ▲                                          ▲
    swap here                              tables don't change
```

---

## Architecture map

```
backend/src/ingest/
├── types.ts                ← RawUser, RawLogin, RawVideo, RawMcq, IngestBatch
├── transformers.ts         ← parseDate, parseTimeToMs, toInt, toFloat, nullIfEmpty
├── sources/
│   ├── excel.ts            ← Flow 2 — readExcel(filePath) → IngestBatch
│   └── api.ts              ← Flow 1 — iterateReportPages() → one page at a time
├── loader.ts               ← loadBatch(batch, mode) → MySQL upsert/insert in one txn
└── cli.ts                  ← argv parser + flow dispatcher (Excel entrypoint)

backend/src/
├── jobs/apiSync.ts         ← the hourly job: cursor → pages → loadBatch('sync')
├── lib/syncState.ts        ← reads/writes the per-report cursor in `sync_state`
└── scripts/
    ├── migrate-sync.ts     ← idempotent migration 003 (upstream_id + sync_state)
    └── sync.ts             ← `npm run sync` CLI (backfill / status / dry run)
```

The two sources produce the **same `IngestBatch` shape**. The loader and the DB schema are completely unaware of where data came from.

---

## Flow 2 — Excel (use this now)

### Prerequisites

1. `.env` is configured with MySQL credentials (`DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`).
2. The schema is already created (run `sql/schema.sql` once).
3. You have an `.xlsx` file in the standard `OverallActivityReport_*` shape.

### Command

```bash
cd backend
npm run ingest:excel -- --file="C:/Users/dell/Downloads/OverallActivityReport_20260514_145352.xlsx"
```

Optional flags:

| Flag | Default | Effect |
|------|---------|--------|
| `--mode=replace` | yes | Wipes `login_history` / `video_usage` / `mcq_report` first. Use when the Excel is a full export. |
| `--mode=append` | — | Keeps existing rows. Use when adding incremental data. |

### What the Excel reader expects

Sheet names (case-insensitive; missing/empty sheets are tolerated):

| Sheet | Maps to | Required columns |
|-------|---------|------------------|
| `Login History` | `users` + `login_history` | `Student/Teacher, School, UserID, EnrollmentID, StudentName, Division, EmailID, Gender, LoginDate, LoginTime, LogoutDate, LogoutTime, SessionTime` |
| `Video Usage` | `users` + `video_usage` | `Student/Teacher, School, UserID, EnrollmentID, StudentName, Division, EmailID, Gender, Course, Subject, Chapter, ContentName, ContentType, TotalViewDuration, TotalViewCount, LastAccessDate, LastAccessTime` |
| `MCQ Report` | `users` + `mcq_report` | `Student/Teacher, School, UserID, EnrollmentID, StudentName, Division, EmailID, Gender, Course, Subject, Chapter, TotalQuestion, RightQuestionCount, TotalMarks, MarksObtained, Percentage, AttemptedDate, AttemptedTime, TimeSpent` |

Other sheets in the workbook (`Login Summary`, `MCQ Pivot`, `Institute Corner`, etc.) are **ignored** — they're pivots/summaries derived from the three above.

Users are deduplicated by `UserID` across all three sheets.

### Field conversions

Times are stored **raw** in `TIME` columns — what you see in MySQL Workbench is the same `H:MM:SS` string the Excel/API gave us. Numeric conversions (seconds, ms) happen at query time in the API layer via `TIME_TO_SEC()`.

| Excel value | Stored as | Example in DB |
|---|---|---|
| `"2/26/26"` | `DATE` | `2026-02-26` |
| `"12:23:04"` (wall-clock) | `TIME` | `12:23:04` |
| `"0:04:19"` (duration) | `TIME` | `00:04:19` |
| `"66.67"` | `DECIMAL(5,2)` | `66.67` |
| empty cell | `NULL` | — |

Unparseable date/time cells become `NULL` rather than aborting — check the console for warnings.

> **Why TIME, not BIGINT ms?** You can read the column directly in any MySQL client — no math required to know when a student logged in. Aggregations stay efficient because `TIME_TO_SEC` is a simple cast.

### Expected output

```
[ingest] source=excel mode=replace file=C:/Users/.../report.xlsx
[ingest] reading Excel...
[ingest] parsed: 412 users, 0 logins, 1376 videos, 30 mcq
[ingest] writing to MySQL...
[ingest] done: { users: 412, logins: 0, videos: 1376, mcq: 30, mode: 'replace' }
```

---

## Flow 1 — the API sync (primary)

The reporting API is a **cursor feed**, not a daily dump. Getting this wrong is the
single biggest source of bad numbers in this project, so the contract is spelled out
in full. Everything below was measured against the live endpoints on 2026-09-01.

### The response shape

```
GET {base}/api/v1/Report/Login?fromDate=2026-04-14 00:00:00&toDate=2026-06-14 23:59:59
GET {base}/api/v1/Report/VideoUsage?fromDate=…&toDate=…
GET {base}/api/v1/Report/MCQ?fromDate=…&toDate=…
```

```jsonc
{
  "Data": [ { "ID": 842790, "UserID": 9323, "LoginDate": "2026-04-15", … } ],
  "NextStartDate": "2026-06-13T15:21:23",   // cursor — resume here
  "ToDate": "2026-06-14T23:59:59",
  "NextSync": false                          // true = there is more
}
```

All three reports use this envelope. They previously returned a bare JSON array;
`fetchPage()` still accepts that shape so an endpoint that has not been redeployed
keeps working.

### Five rules the client must obey

| # | Rule | What happens if you don't |
|---|------|---------------------------|
| 1 | **`fromDate`/`toDate` must be `yyyy-MM-dd HH:mm:ss`** | `NextStartDate` comes back with a `T` separator. Feeding it back verbatim → `417 "FromDate is mandatory and must be in yyyy-MM-dd HH:mm:ss format."` `formatApiDateTime()` converts it. |
| 2 | **A page holds at most 10,000 rows** | Anything past 10k is silently missing unless you follow `NextSync`. |
| 3 | **Pages overlap** | Login page 1 ended at `ID 723225`, page 2 began at `723219` — 7 rows repeated, because the cursor is inclusive at second granularity. Plain `INSERT` duplicates them on every run. Dedupe is the `upstream_id` UNIQUE key. |
| 4 | **`NextSync` alone is not a loop condition** | MCQ returned `NextSync: true` with an unmoving `NextStartDate` and one already-seen row. `while (NextSync)` never exits. |
| 5 | **`NextStartDate` can exceed the `toDate` you asked for** | Asking for `…2026-09-01 00:00:00` returned `NextStartDate: 2026-09-01 10:50:44`. Following it sends `fromDate > toDate` → `417 "ToDate cannot be earlier than fromDate."` And *storing* it would permanently skip every row upstream synced inside that gap, since this run never requested them — so the persisted cursor is clamped to `min(NextStartDate, toDate)`. |

`iterateReportPages()` stops on **any** of: `NextSync` false, no `NextStartDate`, the
cursor not advancing, the cursor passing `toDate`, a page repeating the previous page's
ids, or the 500-page runaway cap.

### The window is NOT a date filter on the row

This is the rule that invalidates the old "ingest yesterday" job. `fromDate`/`toDate`
filter on an **upstream sync timestamp**, not on `LoginDate` / `LastAccessDate` /
`AttemptedDate`. Measured:

```
GET /Report/Login?fromDate=2026-04-14 00:00:00&toDate=2026-06-14 23:59:59
  → 1803 rows, of which 896 have a LoginDate OUTSIDE that window
    (spread across 2024, 2025, and 309 rows dated 2014-01-01)
```

So a sync run on the 31st legitimately delivers rows belonging to the 16th, to last
November, to two years ago — and **each row must be stored against its own date**. A
date-scoped `DELETE … WHERE login_date = ?` would wipe days it never replaces. That is
why `loadBatch` grew a `'sync'` mode that deletes nothing and upserts on `upstream_id`.

### The cursor

`sync_state` holds one row per report:

| column | meaning |
|---|---|
| `report` | `logins` \| `videos` \| `mcq` |
| `next_start_date` | where the next run resumes |
| `last_sync_at`, `last_status` | outcome of the last run |
| `rows_last_sync`, `pages_last_sync` | how much it moved |

The cursor advances **only after a page's rows are committed**, and never moves
backwards (`GREATEST` in `advanceCursor`). A run that dies halfway keeps everything it
wrote and re-fetches its last page — at-least-once delivery, made harmless by the
`upstream_id` upsert.

With no stored cursor, a report starts from `SYNC_START_DATE` (`.env`, default
`2026-01-01 00:00:00`).

### Commands

```bash
npm run db:migrate-sync                              # once — adds upstream_id + sync_state
npm run sync                                         # resume every report from its cursor
npm run sync -- --from=2026-01-01 --to=2026-09-01    # backfill a window
npm run sync -- --report=logins                      # one report only
npm run sync -- --dry-run                            # read the API, write nothing
npm run sync -- --status                             # where do the cursors sit?
npm run sync -- --reset=2026-01-01                   # rewind the cursors, then sync
```

A backfill is *the same code path* as the cron — just with an explicit `--from`. If the
backfill works, the cron works.

### The schedule

**The two hosts run on different schedules, and they must.**

| Host | Schedule | Where it's configured |
|---|---|---|
| Persistent (local, VPS, Render…) | **hourly**, `0 * * * *` Asia/Kolkata | `config/cron.json`, fallback `DEFAULT_CRON_SCHEDULE` in `src/config.ts` |
| Vercel | **daily**, `30 2 * * *` UTC = 8:00 IST | `vercel.json` → `crons` |

⚠️ **Do not set the Vercel cron to hourly.** A Hobby account rejects any cron more
frequent than once per day, and it fails at DEPLOY time, not at run time:

> Hobby accounts are limited to daily cron jobs. This cron expression would run
> more than once per day.

So `0 * * * *` in `vercel.json` breaks the whole deployment. It needs a Pro plan
(minimum interval: once per minute). Note also that Hobby cron timing is only
accurate to ±59 minutes.

To get true hourly syncing while staying on Hobby, leave `vercel.json` daily and
drive it externally instead — GitHub Actions, cron-job.org, or any uptime monitor
hitting `/api/cron/sync` with `Authorization: Bearer $CRON_SECRET`.

The in-process scheduler starts automatically with the API server (`src/index.ts`);
`config/cron.json` is watched, so editing the schedule needs neither rebuild nor
restart. A tick that lands while the previous run is still paging is **skipped**,
not stacked.

`GET /api/cron/status` reports where every cursor sits — the fastest way to answer
"is the sync alive?".

---

## When you re-run ingest

| Table | What happens | Why |
|-------|--------------|-----|
| `users` | UPSERT on `user_id`. Non-null fields from the new row win; null fields don't clobber existing values. | Same student appears across many rows; we want the latest profile data. |
| `login_history` | UPSERT on `upstream_id`. Plus, per mode: `replace` TRUNCATEs first, `daily` DELETEs that date first, `sync` deletes nothing. | The API re-sends rows (overlapping pages, upstream corrections), so the row's own id is the only safe identity. |
| `video_usage` | Same as login_history. | Same reasoning. |
| `mcq_report` | Same as login_history. | Same reasoning. |

Rows with no `upstream_id` — anything loaded from Excel — stay NULL, and MySQL permits
any number of NULLs in a UNIQUE index, so they simply don't participate in dedupe.

Load modes:

| Mode | Deletes | Use for |
|---|---|---|
| `sync` | nothing | the hourly cursor sync and every backfill (`npm run sync`) |
| `daily` | that one date's rows | legacy single-day re-ingest (`npm run ingest:api -- --date=…`) |
| `append` | nothing | Excel increments |
| `replace` | TRUNCATEs the fact tables | rebuilding from one full Excel export |

The whole load runs **inside one transaction** — a SQL failure halfway through rolls back, you don't end up half-loaded.

---

## Known upstream defect — MCQ chapter serial numbers

**`GET /api/v1/Report/MCQ` returns `Chapter` with its first character missing.** Confirmed
against the live endpoint on 2026-07-29:

| Upstream sends | Correct value |
|---|---|
| `". आनुवंशिकता व उत्क्रांती"` | `"1. आनुवंशिकता व उत्क्रांती"` |
| `"0. आप्पांचे पत्र"` | `"10. आप्पांचे पत्र"` |
| `"5. एक होती समई"` | `"15. एक होती समई"` |
| `". Living World...2. Health and Diseases3. Force and Pressure"` | three chapters, first one headless |

When one attempt covers several chapters the names are also concatenated **without a
separator** — the signature of a "strip the leading separator" that runs on a string built
without separators, so it eats a real character instead.

`/api/v1/Report/VideoUsage` is **not** affected (`"16. Heredity and Variation"` arrives
intact), and the old manual Excel exports were correct — so this is an MCQ-endpoint bug,
not an ingest bug. **It still needs fixing at the source**; everything below is a
workaround. Note the damage is worse than a missing digit: `15.` arriving as `5.` is a
*wrong* chapter number, which is why the client saw it in the downloaded MCQ report.

**Affected range: everything.** The oldest MCQ record the API serves is **2023-04-26**, and
the defect is present in every month through today. There is no good date window to fall
back on:

```bash
# broken — chapter number missing, from the very first record onwards
curl "https://dashboard1.sundarameclass.com/api/v1/Report/MCQ?fromDate=2023-04-26%2000:00&toDate=2023-04-30%2023:59:59"
#   → "Chapter": ".मूलद्रव्यांचे आवर्ती वर्गीकरण "

# still broken today
curl "https://dashboard1.sundarameclass.com/api/v1/Report/MCQ?fromDate=2026-07-27%2000:00&toDate=2026-07-27%2023:59:59"
#   → "Chapter": ". आनुवंशिकता व उत्क्रांती"

# same chapters, same day, from VideoUsage — correct
curl "https://dashboard1.sundarameclass.com/api/v1/Report/VideoUsage?fromDate=2026-07-27%2000:00&toDate=2026-07-27%2023:59:59"
#   → "Chapter": "6. ऐ सखि ! (पूरक पठन)"
```

### The workaround

**It checks before it repairs.** `looksTruncated()` scans the batch for the unmistakable
signature — a chapter name starting with `.` — because that only happens when a leading
digit was eaten. If the signature is absent, the API is healthy, the repair is skipped
wholesale, and whatever the API sent is stored verbatim (`healthy` in the stats). So the
day the endpoint is fixed this code steps aside on its own with no edit required.

When the signature IS present, `src/ingest/chapterRepair.ts` treats `video_usage` as a chapter catalogue — it holds the
same chapter names, un-truncated, under the same `(course, subject)` — and puts the missing
head character back. The loader runs it after inserting videos (so the catalogue also sees
chapters that arrived in the same batch) and before inserting MCQ rows:

| Outcome | Meaning |
|---|---|
| `healthy` | the batch shows no truncation — API trusted, repair never ran |
| `exact` | already a known chapter name — left untouched, so this becomes a no-op once the API is fixed |
| `restored` | exactly one catalogue entry `E` satisfies `E.slice(1) === raw` |
| `split` | a glued multi-chapter string, re-emitted as `"1. A, 2. B, 3. C"` |
| `title` | same chapter title, serial taken from the catalogue |
| `ambiguous` / `unmatched` | **left exactly as upstream sent it** — no serial number is ever invented |

Every step requires a *unique* candidate. `mcq_report.chapter_raw` keeps the untouched
upstream string, so the repair is auditable and always re-runnable from the original.
Ingest logs a one-line summary: `[ingest] mcq chapter repair: restored=7602 split=253 …`

### Backfilling rows ingested before the fix

```bash
npm run db:repair-chapters -- --dry-run   # report only, writes nothing
npm run db:repair-chapters                # apply
```

Adds `mcq_report.chapter_raw` if missing (migration `002`), then repairs every row from its
original value. Idempotent — a second run writes nothing. Applied to production on
2026-07-29: **7,855 of 7,962 rows repaired, 93 left as-is** (no unique catalogue match).

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `Access denied for user` | wrong `DB_PASSWORD` in `.env` | Update `.env`, retry |
| `Table 'eclass_analytics.users' doesn't exist` | schema not created | Run `sql/schema.sql` |
| `parsed: 0 users, 0 logins, 0 videos, 0 mcq` from Excel | wrong sheet names or empty sheets | Open the file in Excel and confirm sheet names match the list above |
| Lots of `NULL` `login_date` rows | Excel cells stored as Excel-native dates (not strings) | The reader uses `raw: false` which usually converts them; if not, open the file and re-save the date column as text or fix the column type |
| `Expected {Data:[…]} or a JSON array` | upstream changed the envelope again | Inspect the raw response; `fetchPage()` is where the shape is decoded |
| `417 … FromDate is mandatory and must be in yyyy-MM-dd HH:mm:ss format` | a cursor was passed through without normalising the `T` | Route it through `formatApiDateTime()` |
| `417 … ToDate cannot be earlier than fromDate` | followed a `NextStartDate` past `toDate` | The `beyondWindow` guard in `iterateReportPages()` prevents this |
| Sync appears to hang, same rows repeating | upstream `NextSync` stuck true with a frozen cursor | Already guarded; the run logs `cursor did not advance … stopping` and exits |
| Row counts roughly doubled after a sync | pre-`upstream_id` rows still present alongside re-synced copies | `DELETE FROM <table> WHERE upstream_id IS NULL` once the resync covers the same range |
| `Unknown column 'upstream_id' in 'field list'` | migration `003` not applied to this DB | `npm run db:migrate-sync` |
| MCQ report shows no chapter number, or the wrong one | upstream MCQ endpoint truncation (see above) | `npm run db:repair-chapters`; chase the fix at the API |
| `Unknown column 'chapter_raw' in 'field list'` on ingest | migration `002` not applied to this DB | `npm run db:repair-chapters` (adds the column, then backfills) |

---

## Adding a new source (e.g. CSV, S3 file, message queue)

1. Add `backend/src/ingest/sources/<name>.ts` exporting a function that returns `Promise<IngestBatch>` (or `IngestBatch`).
2. Re-use `transformers.ts` for date/time/number parsing — keep parsing rules in one place.
3. Add a branch in `cli.ts → main()` for the new `--source=<name>`.
4. Add an `npm run ingest:<name>` script to `package.json`.
5. Document it here.

The loader and the DB schema do not change.
