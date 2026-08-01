# Data Ingestion — Two Flows

The dashboard needs login/video/MCQ rows in MySQL. Two interchangeable sources can feed those tables:

| Flow | Source | When to use |
|------|--------|-------------|
| **1 — API (primary)** | Senior sir's API | Once his endpoint and auth are ready. Run on a schedule. |
| **2 — Excel (fallback)** | Local `.xlsx` report | Right now, or any time the API is down / incomplete. |

Both flows go through the same pipeline and end up in the same tables. Switching flows changes **one CLI flag** — nothing else.

```
┌─────────────────────────┐
│ Source                  │
│  - excel.ts  (Flow 2)   │  ──►  IngestBatch  ──►  loader.ts  ──►  MySQL
│  - api.ts    (Flow 1)   │
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
│   └── api.ts              ← Flow 1 — readFromApi({url, token}) → IngestBatch  (stub)
├── loader.ts               ← loadBatch(batch, mode) → MySQL upsert/insert in one txn
└── cli.ts                  ← argv parser + flow dispatcher (entrypoint)
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

## Flow 1 — Senior sir's API (use this later)

Right now `sources/api.ts` is a **stub that throws** — calling it crashes on purpose so we don't silently load empty data.

### When the API spec arrives

1. Add `SENIOR_API_URL` (and `SENIOR_API_TOKEN` if needed) to `backend/.env`.
2. Open `backend/src/ingest/sources/api.ts` and implement `readFromApi()`:
   - Make whatever HTTP calls the senior's API requires.
   - Map the response into the `IngestBatch` shape (same as the Excel reader).
   - Use the same transformers (`parseDate`, `parseTimeToMs`, …) so parsing stays consistent.
3. Optionally schedule it (Windows Task Scheduler, cron, or a `setInterval` worker).

### Command (once implemented)

```bash
cd backend
npm run ingest:api
```

Same `--mode=replace` / `--mode=append` flags apply.

---

## When you re-run ingest

| Table | What happens | Why |
|-------|--------------|-----|
| `users` | UPSERT on `user_id`. Non-null fields from the new row win; null fields don't clobber existing values. | Same student appears across many rows; we want the latest profile data. |
| `login_history` | `replace`: TRUNCATE + INSERT.   `append`: INSERT. | These tables are full exports — replacing avoids duplicate sessions. |
| `video_usage` | Same as login_history. | Same reasoning. |
| `mcq_report` | Same as login_history. | Same reasoning. |

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
| `readFromApi() not yet implemented` | tried `--source=api` before implementing | Implement `sources/api.ts` or fall back to `--source=excel` |
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
