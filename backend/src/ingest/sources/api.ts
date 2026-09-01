/**
 * Live source: senior's reporting API (dashboard1.sundarameclass.com).
 *
 * Three open (no-auth) endpoints, each for a date range:
 *   GET {base}/api/v1/Report/Login?fromDate=…&toDate=…
 *   GET {base}/api/v1/Report/VideoUsage?fromDate=…&toDate=…
 *   GET {base}/api/v1/Report/MCQ?fromDate=…&toDate=…
 *
 * ── The envelope (2026 change) ────────────────────────────────────────────────
 * All three used to answer with a bare JSON array. They now answer with:
 *
 *   { "Data": [ … ], "NextStartDate": "2026-06-13T15:21:23",
 *     "ToDate": "2026-06-14T23:59:59", "NextSync": false }
 *
 * and each record carries a new `ID` (numeric for Login, a GUID for the other
 * two). A page holds at most 10,000 rows; `NextSync: true` means "there is more
 * — call again with fromDate = NextStartDate". Both shapes are still parsed here
 * so an endpoint that has not been redeployed yet keeps working.
 *
 * ── Three things measured against the live API that the code MUST handle ──────
 *  1. The date format is strict: `yyyy-MM-dd HH:mm:ss`. Feeding `NextStartDate`
 *     back verbatim fails — it arrives with a `T` separator and the API answers
 *     417 "FromDate is mandatory and must be in yyyy-MM-dd HH:mm:ss format."
 *     formatApiDateTime() does that conversion.
 *  2. Pages OVERLAP. Login page 1 ended at ID 723225 and page 2 began at 723219
 *     — 7 rows repeated, because the cursor is inclusive at second granularity.
 *     Dedupe is by `upstream_id` in the DB, not here.
 *  3. `NextSync` cannot be trusted on its own. MCQ returned `NextSync: true`
 *     with an unmoving `NextStartDate` and a single already-seen row — a naive
 *     `while (NextSync)` loop spins forever. See the guards in iterateReportPages().
 *
 * ── The window is NOT a date filter on the row ───────────────────────────────
 * fromDate/toDate filter on an upstream sync timestamp, not on LoginDate /
 * LastAccessDate / AttemptedDate. Asking for 2026-04-14..2026-06-14 returned
 * 1803 login rows of which 896 had a LoginDate outside that window, some as old
 * as 2014. Rows are therefore stored against their OWN date; the sync tracks a
 * cursor per report (see lib/syncState.ts) instead of replacing a day at a time.
 *
 * Field-name quirks handled here:
 *   - user-kind key differs: Login & VideoUsage use "StudentTeacher", older MCQ
 *     payloads use "UserTypeName"
 *   - UserID / InstituteID / MediumID arrive as either string or number
 *   - InstituteID / MediumID / *Name present on every record → captured onto the
 *     user and collected into distinct institute / medium lists.
 */
import type {
  IngestBatch,
  RawInstitute,
  RawLogin,
  RawMcq,
  RawMedium,
  RawSchool,
  RawUser,
  RawVideo,
  ReportName,
} from "../types.js";
import { normalizeTime, nullIfEmpty, parseDate, toFloat, toInt } from "../transformers.js";

type Rec = Record<string, unknown>;

/** Endpoint path segment for each report. */
export const REPORT_ENDPOINT: Record<ReportName, "Login" | "VideoUsage" | "MCQ"> = {
  logins: "Login",
  videos: "VideoUsage",
  mcq: "MCQ",
};

export interface ApiOptions {
  base: string;      // e.g. https://dashboard1.sundarameclass.com
  fromDate: string;  // YYYY-MM-DD or YYYY-MM-DD HH:mm:ss
  toDate: string;    // YYYY-MM-DD or YYYY-MM-DD HH:mm:ss
}

/** One page of a report, as the API describes it. */
export interface ReportPage {
  records: Rec[];
  /** Cursor to resume from, already normalized to `yyyy-MM-dd HH:mm:ss`. */
  nextStartDate: string | null;
  /** Upstream's "there is more" flag. Necessary but NOT sufficient — see guards. */
  nextSync: boolean;
}

/**
 * Normalize any accepted date/datetime form to the ONLY format the API accepts:
 * `yyyy-MM-dd HH:mm:ss`.
 *
 *   "2026-06-13T15:21:23"  → "2026-06-13 15:21:23"   (what NextStartDate returns)
 *   "2026-06-13"           → "2026-06-13 00:00:00"
 *   "2026-06-13 15:21"     → "2026-06-13 15:21:00"
 *
 * Anything else is returned untouched and will surface as a 417 from the API
 * rather than being silently mangled into a wrong window.
 */
export function formatApiDateTime(value: string | Date): string {
  if (value instanceof Date) {
    const p = (n: number) => String(n).padStart(2, "0");
    return (
      `${value.getFullYear()}-${p(value.getMonth() + 1)}-${p(value.getDate())} ` +
      `${p(value.getHours())}:${p(value.getMinutes())}:${p(value.getSeconds())}`
    );
  }
  const s = String(value).trim();
  const m = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2})(?::(\d{2}))?)?/.exec(s);
  if (!m) return s;
  const [, date, hm, sec] = m;
  if (!hm) return `${date} 00:00:00`;
  return `${date} ${hm}:${sec ?? "00"}`;
}

function buildUrl(base: string, report: string, fromDate: string, toDate: string): string {
  const root = base.replace(/\/$/, "");
  const from = encodeURIComponent(formatApiDateTime(fromDate));
  const to = encodeURIComponent(formatApiDateTime(toDate));
  return `${root}/api/v1/Report/${report}?fromDate=${from}&toDate=${to}`;
}

/** "EISLR002 - No login report data found for given date range." and friends. */
const NO_DATA_MESSAGE = /no\s+.*\bdata found\b/i;

/**
 * An empty report answers with .NET's DateTime.MinValue as the cursor:
 *
 *   {"Data":[],"NextStartDate":"0001-01-01T00:00:00","ToDate":"0001-01-01T00:00:00","NextSync":false}
 *
 * That is a sentinel meaning "nothing", not a real position. Storing it would
 * rewind the cursor to the year 1, and the next run would ask the API for the
 * whole of history. On an existing install advanceCursor()'s GREATEST() blocks
 * the rewind, but on a FRESH one — empty sync_state, and the first window
 * happens to be empty — it would be inserted as the starting cursor with nothing
 * to compare against. Anything below this floor is treated as no cursor at all.
 */
const MIN_PLAUSIBLE_CURSOR = "2000-01-01 00:00:00";

/**
 * Fetch a single page.
 *
 * An empty window is NOT an error. The API expresses "no rows" three different
 * ways depending on the endpoint and how recently it was redeployed:
 *
 *   200  {"Data":[],"NextStartDate":null,"ToDate":null,"NextSync":false}
 *   417  "EISLR002 - No login report data found for given date range."   (bare string)
 *   417  {"Status":false,"Message":"… No MCQ report data found …"}       (object)
 *
 * Treating any of those as a failure broke every Sunday: nobody logs in on a
 * Sunday, so the Login report 417s, and that one rejection used to abort the
 * whole day — throwing away the VideoUsage and MCQ rows that DID exist.
 */
async function fetchPage(url: string): Promise<ReportPage> {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  const text = await res.text();

  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = text;
  }

  const message =
    typeof payload === "string"
      ? payload
      : typeof (payload as Rec)?.["Message"] === "string"
        ? String((payload as Rec)["Message"])
        : null;
  if (message && NO_DATA_MESSAGE.test(message)) {
    return { records: [], nextStartDate: null, nextSync: false };
  }

  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText} — ${url}${text ? `: ${text.slice(0, 300)}` : ""}`);
  }

  // Legacy shape: a bare array, no cursor. One page, and that's everything.
  if (Array.isArray(payload)) {
    return { records: payload as Rec[], nextStartDate: null, nextSync: false };
  }

  const envelope = payload as Rec | null;
  if (!envelope || !Array.isArray(envelope["Data"])) {
    throw new Error(
      `Expected {Data:[…]} or a JSON array from ${url}, got ${typeof payload}` +
        `${text ? `: ${text.slice(0, 200)}` : ""}`,
    );
  }
  const rawNext = envelope["NextStartDate"];
  const next = rawNext ? formatApiDateTime(String(rawNext)) : null;
  return {
    records: envelope["Data"] as Rec[],
    nextStartDate: next && next >= MIN_PLAUSIBLE_CURSOR ? next : null,
    nextSync: envelope["NextSync"] === true,
  };
}

export interface PageIterationOptions {
  /** Runaway guard. 10k rows/page, so 500 pages ≈ 5M rows. */
  maxPages?: number;
  /** Called after each page for progress logging. */
  onPage?: (info: { page: number; rows: number; cursor: string; nextStartDate: string | null }) => void;
}

/** One iteration step: the page plus the cursor that produced it. */
export interface ReportPageResult extends ReportPage {
  /** 1-based page number within this run. */
  page: number;
  /** The fromDate this page was fetched with. */
  cursor: string;
  /** True once the loop has decided this is the final page. */
  last: boolean;
}

/**
 * Walk a report's pages from `fromDate` to `toDate`, following `NextStartDate`.
 *
 * Yields each page so the caller can commit it before the next fetch — a run
 * interrupted halfway keeps everything already written, and resumes from the
 * last committed cursor rather than starting over.
 *
 * Termination is deliberately defensive, because `NextSync` alone is not
 * trustworthy. Measured on the live MCQ endpoint: page 1 returned 22 rows with
 * `NextSync: true` and `NextStartDate: 2026-06-12T12:26:04`; page 2 returned a
 * single already-seen row with `NextSync: true` and the SAME NextStartDate. A
 * plain `while (NextSync)` loop never exits. The loop therefore stops on ANY of:
 *
 *   - `NextSync` is false                    (the normal, documented end)
 *   - `NextStartDate` is null or unparseable (nothing to resume from)
 *   - the cursor did not move forward        (the MCQ case above)
 *   - the cursor moved PAST `toDate`         (see below)
 *   - the page repeated the previous page's ids exactly (no forward progress)
 *   - maxPages was reached                   (hard runaway stop)
 *
 * That fourth guard is not hypothetical either: the API happily returns a
 * `NextStartDate` beyond the window you asked for — a request ending at
 * 2026-09-01 00:00:00 came back with `NextStartDate: 2026-09-01 10:50:44` and
 * `NextSync: true`. Following it produces fromDate > toDate and the API answers
 * 417 "ToDate cannot be earlier than fromDate." There is simply nothing left
 * inside the window at that point, so the walk ends.
 */
export async function* iterateReportPages(
  base: string,
  report: ReportName,
  fromDate: string,
  toDate: string,
  opts: PageIterationOptions = {},
): AsyncGenerator<ReportPageResult> {
  const maxPages = opts.maxPages ?? 500;
  const endpoint = REPORT_ENDPOINT[report];
  const end = formatApiDateTime(toDate);

  let cursor = formatApiDateTime(fromDate);
  let previousIds = new Set<string>();

  for (let page = 1; page <= maxPages; page++) {
    const result = await fetchPage(buildUrl(base, endpoint, cursor, end));
    opts.onPage?.({
      page,
      rows: result.records.length,
      cursor,
      nextStartDate: result.nextStartDate,
    });

    const ids = new Set(result.records.map((r) => String(r["ID"] ?? "")));
    const repeatedWholePage =
      previousIds.size > 0 &&
      ids.size > 0 &&
      [...ids].every((id) => previousIds.has(id));

    const next = result.nextStartDate;
    const stalled = !next || next <= cursor;
    // Upstream has moved past the window we asked for — everything inside it has
    // been delivered. Following this cursor would send fromDate > toDate.
    const beyondWindow = !!next && next > end;
    const last =
      !result.nextSync ||
      stalled ||
      beyondWindow ||
      repeatedWholePage ||
      result.records.length === 0 ||
      page === maxPages;

    yield { ...result, page, cursor, last };

    if (last) {
      if (result.nextSync && stalled) {
        console.warn(
          `[ingest] ${report}: NextSync=true but the cursor did not advance ` +
            `(${cursor} → ${next ?? "null"}) — stopping to avoid an endless loop.`,
        );
      } else if (result.nextSync && repeatedWholePage) {
        console.warn(
          `[ingest] ${report}: NextSync=true but the page repeated the previous ` +
            "page's rows — stopping.",
        );
      } else if (result.nextSync && beyondWindow) {
        console.log(
          `[ingest] ${report}: cursor reached the end of the window ` +
            `(${next} > ${end}) — done.`,
        );
      } else if (page === maxPages && result.nextSync) {
        console.warn(
          `[ingest] ${report}: hit the ${maxPages}-page cap with NextSync still true — ` +
            "the next run resumes from the saved cursor.",
        );
      }
      return;
    }

    previousIds = ids;
    cursor = next!;
  }
}

/**
 * Fetch one report's raw records for a window, following pagination to the end.
 * Exported for the gap filler, which wants everything in one array.
 */
export async function fetchReport(
  base: string,
  report: "Login" | "VideoUsage" | "MCQ",
  fromDate: string,
  toDate: string,
): Promise<Rec[]> {
  const name = (Object.keys(REPORT_ENDPOINT) as ReportName[]).find(
    (k) => REPORT_ENDPOINT[k] === report,
  )!;
  const out: Rec[] = [];
  for await (const page of iterateReportPages(base, name, fromDate, toDate)) {
    out.push(...page.records);
  }
  return out;
}

/**
 * The three reports are independent datasets and are fetched independently: one
 * failing must never stop the other two from being ingested.
 *
 * Previously all three were awaited with Promise.all, so a single rejection —
 * a timeout on the large VideoUsage payload, a 500, a dropped connection —
 * discarded the entire day including the reports that had answered fine.
 * Now each is settled on its own; whatever came back is loaded, and the failures
 * are reported on the batch so the loader leaves THOSE tables untouched (see
 * `reportsLoaded`) and the caller can surface a partial run.
 *
 * Only a total blackout — all three failing — throws.
 */
export async function readFromApi(opts: ApiOptions): Promise<IngestBatch> {
  const { base, fromDate, toDate } = opts;

  const names: ReportName[] = ["logins", "videos", "mcq"];
  const settled = await Promise.allSettled(
    names.map((n) => fetchReport(base, REPORT_ENDPOINT[n], fromDate, toDate)),
  );

  const reportsLoaded: ReportName[] = [];
  const failures: Array<{ report: ReportName; error: string }> = [];
  const recs: Rec[][] = [[], [], []];

  settled.forEach((outcome, i) => {
    if (outcome.status === "fulfilled") {
      recs[i] = outcome.value;
      reportsLoaded.push(names[i]);
    } else {
      const error = outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason);
      failures.push({ report: names[i], error });
      console.error(`[ingest] ${names[i]} report FAILED (other reports continue): ${error}`);
    }
  });

  if (reportsLoaded.length === 0) {
    throw new Error(
      `All three reports failed for ${fromDate}..${toDate}: ` +
        failures.map((f) => `${f.report}: ${f.error}`).join(" | "),
    );
  }

  const [loginRecs, videoRecs, mcqRecs] = recs;
  const batch = buildBatch(loginRecs, videoRecs, mcqRecs);
  batch.reportsLoaded = reportsLoaded;
  batch.failures = failures;
  return batch;
}

function intOrNull(v: unknown): number | null {
  return toInt(v, 0) || null;
}

/** The upstream row id: a number on Login, a GUID on VideoUsage/MCQ, absent on old payloads. */
function upstreamId(r: Rec): string | null {
  return nullIfEmpty(r["ID"]);
}

/** Map raw API records onto the normalized batch shape. */
export function buildBatch(loginRecs: Rec[], videoRecs: Rec[], mcqRecs: Rec[]): IngestBatch {
  const userMap = new Map<number, RawUser>();
  const instituteMap = new Map<number, RawInstitute>();
  const mediumMap = new Map<number, RawMedium>();
  const schoolMap = new Map<number, RawSchool>();

  // Capture/refresh the user, institute and medium from any record. First
  // non-null wins for user fields; institute/medium names are recorded once.
  const upsertUser = (r: Rec): number | null => {
    const userId = toInt(r["UserID"], 0);
    if (!userId) return null;

    const instituteId = intOrNull(r["InstituteID"]);
    const mediumId = intOrNull(r["MediumID"]);
    // SchoolID is a newer upstream field — older records carry only the School
    // name, so this stays null until the senior's API starts emitting it.
    const schoolId = intOrNull(r["SchoolID"]);

    if (instituteId && !instituteMap.has(instituteId)) {
      instituteMap.set(instituteId, { id: instituteId, name: nullIfEmpty(r["InstituteName"]) });
    }
    if (mediumId && !mediumMap.has(mediumId)) {
      mediumMap.set(mediumId, { id: mediumId, name: nullIfEmpty(r["MediumName"]) });
    }
    if (schoolId && !schoolMap.has(schoolId)) {
      schoolMap.set(schoolId, { id: schoolId, name: nullIfEmpty(r["SchoolName"] ?? r["School"]) });
    }

    if (!userMap.has(userId)) {
      userMap.set(userId, {
        userKind: parseUserKind(r["StudentTeacher"] ?? r["UserTypeName"]),
        school: nullIfEmpty(r["School"]),
        schoolId,
        userId,
        enrollmentId: nullIfEmpty(r["EnrollmentID"]),
        studentName: nullIfEmpty(r["StudentName"]),
        division: nullIfEmpty(r["Division"]),
        emailId: nullIfEmpty(r["EmailID"]),
        gender: nullIfEmpty(r["Gender"]),
        instituteId,
        mediumId,
      });
    }
    return userId;
  };

  const logins: RawLogin[] = [];
  for (const r of loginRecs) {
    const userId = upsertUser(r);
    if (!userId) continue;
    logins.push({
      userId,
      upstreamId:  upstreamId(r),
      loginDate:   parseDate(r["LoginDate"]),
      loginTime:   normalizeTime(r["LoginTime"]),
      logoutDate:  parseDate(r["LogoutDate"]),
      logoutTime:  normalizeTime(r["LogoutTime"]),
      sessionTime: normalizeTime(r["SessionTime"]),
    });
  }

  const videos: RawVideo[] = [];
  for (const r of videoRecs) {
    const userId = upsertUser(r);
    if (!userId) continue;
    videos.push({
      userId,
      upstreamId:        upstreamId(r),
      course:            nullIfEmpty(r["Course"]),
      subject:           nullIfEmpty(r["Subject"]),
      chapter:           nullIfEmpty(r["Chapter"]),
      contentName:       nullIfEmpty(r["ContentName"]),
      contentType:       nullIfEmpty(r["ContentType"]),
      totalViewDuration: normalizeTime(r["TotalViewDuration"]),
      totalViewCount:    toInt(r["TotalViewCount"], 0),
      lastAccessDate:    parseDate(r["LastAccessDate"]),
      lastAccessTime:    normalizeTime(r["LastAccessTime"]),
    });
  }

  const mcq: RawMcq[] = [];
  for (const r of mcqRecs) {
    const userId = upsertUser(r);
    if (!userId) continue;
    mcq.push({
      userId,
      upstreamId:         upstreamId(r),
      course:             nullIfEmpty(r["Course"]),
      subject:            nullIfEmpty(r["Subject"]),
      chapter:            nullIfEmpty(r["Chapter"]),
      totalQuestion:      toInt(r["TotalQuestion"], 0),
      rightQuestionCount: toInt(r["RightQuestionCount"], 0),
      totalMarks:         toInt(r["TotalMarks"], 0),
      marksObtained:      toInt(r["MarksObtained"], 0),
      percentage:         toFloat(r["Percentage"], 0),
      attemptedDate:      parseDate(r["AttemptedDate"]),
      attemptedTime:      normalizeTime(r["AttemptedTime"]),
      timeSpent:          normalizeTime(r["TimeSpent"]),
    });
  }

  return {
    users: [...userMap.values()],
    logins,
    videos,
    mcq,
    institutes: [...instituteMap.values()],
    mediums: [...mediumMap.values()],
    schools: [...schoolMap.values()],
  };
}

function parseUserKind(v: unknown): "Student" | "Teacher" | null {
  const s = nullIfEmpty(v);
  if (!s) return null;
  const lower = s.toLowerCase();
  if (lower.startsWith("stud")) return "Student";
  if (lower.startsWith("teach")) return "Teacher";
  return null;
}
