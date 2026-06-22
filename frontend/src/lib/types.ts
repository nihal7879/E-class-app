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

export interface StudentStat {
  enrollmentId: string;
  studentName: string;
  sessions: number;
  totalSessionMs: number;
  logins: number;
}
