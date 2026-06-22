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

async function fetchArray(url: string): Promise<Rec[]> {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} — ${url}${text ? `: ${text.slice(0, 300)}` : ""}`);
  }
  const json = await res.json();
  if (!Array.isArray(json)) {
    throw new Error(`Expected a JSON array from ${url}, got ${typeof json}`);
  }
  return json as Rec[];
}

function intOrNull(v: unknown): number | null {
  return toInt(v, 0) || null;
}

export async function readFromApi(opts: ApiOptions): Promise<IngestBatch> {
  const { base, fromDate, toDate } = opts;

  const [loginRecs, videoRecs, mcqRecs] = await Promise.all([
    fetchArray(buildUrl(base, "Login", fromDate, toDate)),
    fetchArray(buildUrl(base, "VideoUsage", fromDate, toDate)),
    fetchArray(buildUrl(base, "MCQ", fromDate, toDate)),
  ]);

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
