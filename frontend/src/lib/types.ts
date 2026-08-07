export interface FilterState {
  year: number | "all";
  month: number | "all"; // 1..12
  institutes: string[]; // institute IDs; seeded from the logged-in institute (sticky scope)
  mediums: string[]; // medium IDs; empty = all
  schools: string[]; // empty = all
  courses: string[]; // empty = all
  divisions: string[]; // empty = all
  genders: string[]; // empty = all
  dateFrom?: string; // YYYY-MM-DD — when set, overrides year/month for date matching
  dateTo?: string; // YYYY-MM-DD — inclusive
}

// Page-scoped override merged on top of FilterState when building the Excel
// export URL only (not applied to the dashboard charts). Lets a drill-down page
// export exactly its own slice — e.g. a course page pins { courses: ["English"] }
// and a subject page pins { courses, subjects } — including subject, which the
// global FilterState deliberately does not carry.
export interface ExportScope {
  schools?: string[];
  courses?: string[];
  subjects?: string[];
}

export interface StudentStat {
  enrollmentId: string;
  studentName: string;
  sessions: number;
  totalSessionMs: number;
  logins: number;
  videoWatchMs: number;
  mcqAttempts: number;
}
