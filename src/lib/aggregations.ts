import {
  LOGIN_ROWS,
  VIDEO_ROWS,
  getMonth,
  getYear,
  sortAlpha,
  uniq,
} from "./parse";
import type {
  FilterState,
  LoginRow,
  SchoolSessionStat,
  SchoolTrendPoint,
  StudentStat,
  VideoRow,
} from "./types";

function matchesYear(date: string, year: FilterState["year"]) {
  return year === "all" || getYear(date) === year;
}

function matchesMonth(date: string, month: FilterState["month"]) {
  return month === "all" || getMonth(date) === month;
}

function matchesSchool(school: string, schools: string[]) {
  return schools.length === 0 || schools.includes(school);
}

export function filterLogins(rows: LoginRow[], f: FilterState): LoginRow[] {
  // Courses filter must be applied via Video-Usage join, since LoginHistory has no Course.
  const courseUserIds =
    f.courses.length === 0 ? null : courseUserIdSet(VIDEO_ROWS, f.courses);

  return rows.filter(
    (r) =>
      matchesYear(r.LoginDate, f.year) &&
      matchesMonth(r.LoginDate, f.month) &&
      matchesSchool(r.School, f.schools) &&
      (courseUserIds === null || courseUserIds.has(r.UserID)),
  );
}

export function filterVideos(rows: VideoRow[], f: FilterState): VideoRow[] {
  return rows.filter(
    (r) =>
      matchesYear(r.LastAccessDate, f.year) &&
      matchesMonth(r.LastAccessDate, f.month) &&
      matchesSchool(r.School, f.schools) &&
      (f.courses.length === 0 || f.courses.includes(r.Course)),
  );
}

function courseUserIdSet(rows: VideoRow[], courses: string[]): Set<number> {
  const set = new Set<number>();
  for (const r of rows) {
    if (courses.includes(r.Course)) set.add(r.UserID);
  }
  return set;
}

// ---------- catalogue (for filter dropdowns) ----------

export interface Catalogue {
  years: number[];
  months: number[]; // 1..12 present in either dataset
  schools: string[];
  courses: string[];
}

let _catalogue: Catalogue | null = null;
export function getCatalogue(): Catalogue {
  if (_catalogue) return _catalogue;
  const years = new Set<number>();
  const months = new Set<number>();
  const schools = new Set<string>();
  const courses = new Set<string>();
  for (const r of LOGIN_ROWS) {
    years.add(getYear(r.LoginDate));
    months.add(getMonth(r.LoginDate));
    schools.add(r.School);
  }
  for (const r of VIDEO_ROWS) {
    years.add(getYear(r.LastAccessDate));
    months.add(getMonth(r.LastAccessDate));
    schools.add(r.School);
    if (r.Course) courses.add(r.Course);
  }
  _catalogue = {
    years: Array.from(years).sort((a, b) => b - a),
    months: Array.from(months).sort((a, b) => a - b),
    schools: sortAlpha(Array.from(schools)),
    courses: sortAlpha(Array.from(courses)),
  };
  return _catalogue;
}

// ---------- KPIs ----------

export interface Kpis {
  totalSchools: number;
  totalStudents: number;
  totalCourses: number;
  totalLearningMs: number;
  totalLogins: number;
}

export function computeKpis(f: FilterState): Kpis {
  const logins = filterLogins(LOGIN_ROWS, f);
  const videos = filterVideos(VIDEO_ROWS, f);

  const schoolSet = new Set<string>();
  const studentSet = new Set<number>();
  for (const r of logins) {
    schoolSet.add(r.School);
    if (r["Student/Teacher"] === "Student") studentSet.add(r.UserID);
  }
  for (const r of videos) schoolSet.add(r.School);

  const courseSet = new Set<string>();
  let totalLearningMs = 0;
  for (const r of videos) {
    if (r.Course) courseSet.add(r.Course);
    totalLearningMs += r.TotalViewDuration || 0;
  }

  return {
    totalSchools: schoolSet.size,
    totalStudents: studentSet.size,
    totalCourses: courseSet.size,
    totalLearningMs,
    totalLogins: logins.length,
  };
}

// ---------- School trend (multi-line) ----------

export function computeSchoolTrend(f: FilterState): {
  data: SchoolTrendPoint[];
  schools: string[];
  totalLogins: number;
} {
  const logins = filterLogins(LOGIN_ROWS, f);
  const schools = uniq(logins.map((r) => r.School)).sort();
  const byDate = new Map<string, Record<string, number>>();
  for (const r of logins) {
    const key = r.LoginDate;
    if (!byDate.has(key)) byDate.set(key, {});
    const bucket = byDate.get(key)!;
    bucket[r.School] = (bucket[r.School] || 0) + 1;
  }
  const dates = Array.from(byDate.keys()).sort();
  const data: SchoolTrendPoint[] = dates.map((date) => {
    const row: SchoolTrendPoint = { date };
    for (const s of schools) row[s] = byDate.get(date)![s] || 0;
    return row;
  });
  return { data, schools, totalLogins: logins.length };
}

// ---------- School-wise session stats ----------

export function computeSchoolStats(f: FilterState): SchoolSessionStat[] {
  const logins = filterLogins(LOGIN_ROWS, f);
  const map = new Map<string, SchoolSessionStat>();
  const studentsBySchool = new Map<string, Set<number>>();
  for (const r of logins) {
    const cur =
      map.get(r.School) || {
        school: r.School,
        logins: 0,
        sessions: 0,
        totalSessionMs: 0,
        uniqueStudents: 0,
      };
    cur.logins += 1;
    if (r.SessionTime > 0) cur.sessions += 1;
    cur.totalSessionMs += r.SessionTime || 0;
    map.set(r.School, cur);
    if (!studentsBySchool.has(r.School))
      studentsBySchool.set(r.School, new Set());
    studentsBySchool.get(r.School)!.add(r.UserID);
  }
  for (const [school, s] of map) s.uniqueStudents = studentsBySchool.get(school)!.size;
  return Array.from(map.values()).sort((a, b) => b.logins - a.logins);
}

// ---------- Student-level (for school detail) ----------

export function computeStudentStats(
  school: string,
  f: FilterState,
): StudentStat[] {
  const scoped = filterLogins(LOGIN_ROWS, {
    ...f,
    schools: [school],
  });
  const byEnrollment = new Map<string, StudentStat>();
  for (const r of scoped) {
    const cur =
      byEnrollment.get(r.EnrollmentID) || {
        enrollmentId: r.EnrollmentID,
        studentName: r.StudentName,
        sessions: 0,
        totalSessionMs: 0,
        logins: 0,
      };
    cur.logins += 1;
    if (r.SessionTime > 0) cur.sessions += 1;
    cur.totalSessionMs += r.SessionTime || 0;
    byEnrollment.set(r.EnrollmentID, cur);
  }
  return Array.from(byEnrollment.values()).sort(
    (a, b) => b.totalSessionMs - a.totalSessionMs,
  );
}

// ---------- Daily series for KPI sparklines ----------

export interface DailyKpiSeries {
  logins: { date: string; value: number }[];
  students: { date: string; value: number }[];
  schools: { date: string; value: number }[];
  hours: { date: string; value: number }[];
  courses: { date: string; value: number }[];
}

export function computeDailyKpiSeries(f: FilterState): DailyKpiSeries {
  const logins = filterLogins(LOGIN_ROWS, f);
  const videos = filterVideos(VIDEO_ROWS, f);

  const loginDates = new Map<string, number>();
  const studentDates = new Map<string, Set<number>>();
  const schoolDates = new Map<string, Set<string>>();
  for (const r of logins) {
    loginDates.set(r.LoginDate, (loginDates.get(r.LoginDate) || 0) + 1);
    if (r["Student/Teacher"] === "Student") {
      if (!studentDates.has(r.LoginDate))
        studentDates.set(r.LoginDate, new Set());
      studentDates.get(r.LoginDate)!.add(r.UserID);
    }
    if (!schoolDates.has(r.LoginDate))
      schoolDates.set(r.LoginDate, new Set());
    schoolDates.get(r.LoginDate)!.add(r.School);
  }

  const hourDates = new Map<string, number>();
  const courseDates = new Map<string, Set<string>>();
  for (const r of videos) {
    const d = r.LastAccessDate;
    hourDates.set(d, (hourDates.get(d) || 0) + (r.TotalViewDuration || 0));
    if (r.Course) {
      if (!courseDates.has(d)) courseDates.set(d, new Set());
      courseDates.get(d)!.add(r.Course);
    }
  }

  const toSeries = (m: Map<string, number>) =>
    Array.from(m.entries())
      .map(([date, value]) => ({ date, value }))
      .sort((a, b) => a.date.localeCompare(b.date));
  const toCountSeries = <T>(m: Map<string, Set<T>>) =>
    Array.from(m.entries())
      .map(([date, set]) => ({ date, value: set.size }))
      .sort((a, b) => a.date.localeCompare(b.date));

  return {
    logins: toSeries(loginDates),
    students: toCountSeries(studentDates),
    schools: toCountSeries(schoolDates),
    hours: toSeries(hourDates).map((p) => ({
      date: p.date,
      value: p.value / 3_600_000,
    })),
    courses: toCountSeries(courseDates),
  };
}

export function computeSchoolDailyUsageHours(
  school: string,
  f: FilterState,
): { date: string; value: number }[] {
  const scoped = filterLogins(LOGIN_ROWS, { ...f, schools: [school] });
  const byDate = new Map<string, number>();
  for (const r of scoped) {
    byDate.set(r.LoginDate, (byDate.get(r.LoginDate) || 0) + (r.SessionTime || 0));
  }
  return Array.from(byDate.entries())
    .map(([date, ms]) => ({ date, value: ms / 3_600_000 }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function computeSchoolDailyActivity(
  school: string,
  f: FilterState,
): { date: string; logins: number; uniqueStudents: number }[] {
  const scoped = filterLogins(LOGIN_ROWS, {
    ...f,
    schools: [school],
  });
  const byDate = new Map<string, { logins: number; students: Set<number> }>();
  for (const r of scoped) {
    const cur = byDate.get(r.LoginDate) || { logins: 0, students: new Set<number>() };
    cur.logins += 1;
    cur.students.add(r.UserID);
    byDate.set(r.LoginDate, cur);
  }
  return Array.from(byDate.entries())
    .map(([date, v]) => ({
      date,
      logins: v.logins,
      uniqueStudents: v.students.size,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
