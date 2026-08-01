/**
 * Normalized row shapes that every "source" must produce.
 * Sources today: Excel (excel.ts). Tomorrow: senior's API (api.ts).
 * Transformers and loader consume these shapes only — keeps the swap simple.
 *
 * Times are stored as raw H:MM:SS strings (TIME columns in MySQL), not milliseconds.
 * Conversion to seconds/ms happens at query time in the API layer.
 */

export interface RawUser {
  userKind: "Student" | "Teacher" | null;
  school: string | null;
  schoolId: number | null;
  userId: number;
  enrollmentId: string | null;
  studentName: string | null;
  division: string | null;
  emailId: string | null;
  gender: string | null;
  instituteId: number | null;
  mediumId: number | null;
}

export interface RawInstitute {
  id: number;
  name: string | null;
}

export interface RawSchool {
  id: number;
  name: string | null;
}

export interface RawMedium {
  id: number;
  name: string | null;
}

export interface RawLogin {
  userId: number;
  loginDate: string | null;        // YYYY-MM-DD
  loginTime: string | null;        // wall-clock 'H:MM:SS'
  logoutDate: string | null;
  logoutTime: string | null;       // wall-clock 'H:MM:SS'
  sessionTime: string | null;      // duration 'H:MM:SS'
}

export interface RawVideo {
  userId: number;
  course: string | null;
  subject: string | null;
  chapter: string | null;
  contentName: string | null;
  contentType: string | null;
  totalViewDuration: string | null; // duration 'H:MM:SS'
  totalViewCount: number;
  lastAccessDate: string | null;    // YYYY-MM-DD
  lastAccessTime: string | null;    // wall-clock 'H:MM:SS'
}

export interface RawMcq {
  userId: number;
  course: string | null;
  subject: string | null;
  /** Repaired chapter name — see ingest/chapterRepair.ts. */
  chapter: string | null;
  /** Exactly what the source sent, before the chapter repair. Set by the loader. */
  chapterRaw?: string | null;
  totalQuestion: number;
  rightQuestionCount: number;
  totalMarks: number;
  marksObtained: number;
  percentage: number;
  attemptedDate: string | null;    // YYYY-MM-DD
  attemptedTime: string | null;    // wall-clock 'H:MM:SS'
  timeSpent: string | null;        // duration 'H:MM:SS'
}

/** The three independent source reports. */
export type ReportName = "logins" | "videos" | "mcq";

export const ALL_REPORTS: ReportName[] = ["logins", "videos", "mcq"];

export interface IngestBatch {
  users: RawUser[];
  logins: RawLogin[];
  videos: RawVideo[];
  mcq: RawMcq[];
  institutes: RawInstitute[];
  mediums: RawMedium[];
  schools: RawSchool[];
  /**
   * Which reports this batch actually carries. In 'daily' mode the loader only
   * DELETEs the tables named here — a report that failed to fetch must keep the
   * rows it already has rather than being wiped and not replaced. Undefined
   * means "all three" (the Excel source always has everything).
   */
  reportsLoaded?: ReportName[];
  /** Reports that failed to fetch, for logging and partial-run reporting. */
  failures?: Array<{ report: ReportName; error: string }>;
}
