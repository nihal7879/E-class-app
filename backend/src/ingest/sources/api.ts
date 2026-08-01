/**
 * Live source: senior's reporting API (dashboard1.sundarameclass.com).
 *
 * Three open (no-auth) endpoints, each returning a JSON array for a date range:
 *   GET {base}/api/v1/Report/Login?fromDate=YYYY-MM-DD 00:00&toDate=YYYY-MM-DD 23:59:59
 *   GET {base}/api/v1/Report/VideoUsage?...
 *   GET {base}/api/v1/Report/MCQ?...
 *
 * Field-name quirks handled here:
 *   - user-kind key differs: Login & VideoUsage use "StudentTeacher", MCQ uses "UserTypeName"
 *   - UserID / InstituteID / MediumID arrive as either string or number
 *   - InstituteID / MediumID / *Name present on every record → captured onto the user
 *     and collected into distinct institute / medium lists.
 *
 * Returns the same IngestBatch shape as readExcel() so the loader is unchanged.
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

export interface ApiOptions {
  base: string;      // e.g. https://dashboard1.sundarameclass.com
  fromDate: string;  // YYYY-MM-DD
  toDate: string;    // YYYY-MM-DD
}

function buildUrl(base: string, report: string, fromDate: string, toDate: string): string {
  const root = base.replace(/\/$/, "");
  const from = encodeURIComponent(`${fromDate} 00:00`);
  const to = encodeURIComponent(`${toDate} 23:59:59`);
  return `${root}/api/v1/Report/${report}?fromDate=${from}&toDate=${to}`;
}

/** "EISLR002 - No login report data found for given date range." and friends. */
const NO_DATA_MESSAGE = /no\s+.*\bdata found\b/i;

async function fetchArray(url: string): Promise<Rec[]> {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  const text = await res.text();

  // An empty window is NOT an error. This API answers "no rows for that range"
  // with HTTP 417 and a plain-string message instead of an empty array:
  //
  //   417  "EISLR002 - No login report data found for given date range."
  //   417  "EISMR002 - No MCQ report data found for given date range."
  //
  // Treating that as a failure broke every Sunday: nobody logs in on a Sunday,
  // so the Login report 417s — and because the three reports are fetched with
  // Promise.all, that one rejection aborted the entire day, throwing away the
  // VideoUsage and MCQ rows that DID exist (students watch videos at home).
  // Every Sunday was simply absent from the dashboard as a result.
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = text;
  }
  if (typeof payload === "string" && NO_DATA_MESSAGE.test(payload)) {
    return [];
  }

  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText} — ${url}${text ? `: ${text.slice(0, 300)}` : ""}`);
  }
  if (!Array.isArray(payload)) {
    throw new Error(`Expected a JSON array from ${url}, got ${typeof payload}`);
  }
  return payload as Rec[];
}

function intOrNull(v: unknown): number | null {
  return toInt(v, 0) || null;
}

/** Fetch one report's raw records for a window. Exported for the gap filler. */
export function fetchReport(
  base: string,
  report: "Login" | "VideoUsage" | "MCQ",
  fromDate: string,
  toDate: string,
): Promise<Rec[]> {
  return fetchArray(buildUrl(base, report, fromDate, toDate));
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

  const settled = await Promise.allSettled([
    fetchReport(base, "Login", fromDate, toDate),
    fetchReport(base, "VideoUsage", fromDate, toDate),
    fetchReport(base, "MCQ", fromDate, toDate),
  ]);

  const names: ReportName[] = ["logins", "videos", "mcq"];
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
