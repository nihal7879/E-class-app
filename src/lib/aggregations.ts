import {
  LOGIN_ROWS,
  MCQ_ROWS,
  VIDEO_ROWS,
  getMonth,
  getYear,
  sortAlpha,
  sortCourses,
  uniq,
} from "./parse";
import type {
  FilterState,
  LoginRow,
  McqRow,
  SchoolCompositionStat,
  SchoolSessionStat,
  SchoolTrendPoint,
  StudentStat,
  VideoRow,
} from "./types";

function matchesPeriod(date: string, f: FilterState): boolean {
  if (f.dateFrom || f.dateTo) {
    if (f.dateFrom && date < f.dateFrom) return false;
    if (f.dateTo && date > f.dateTo) return false;
    return true;
  }
  if (f.year !== "all" && getYear(date) !== f.year) return false;
  if (f.month !== "all" && getMonth(date) !== f.month) return false;
  return true;
}

function matchesSchool(school: string, schools: string[]) {
  return schools.length === 0 || schools.includes(school);
}

export function filterLogins(rows: LoginRow[], f: FilterState): LoginRow[] {
  const courseUserIds =
    f.courses.length === 0 ? null : courseUserIdSet(VIDEO_ROWS, f.courses);

  return rows.filter(
    (r) =>
      matchesPeriod(r.LoginDate, f) &&
      matchesSchool(r.School, f.schools) &&
      (f.divisions.length === 0 || f.divisions.includes(r.Division)) &&
      (f.genders.length === 0 || f.genders.includes(r.Gender)) &&
      (courseUserIds === null || courseUserIds.has(r.UserID)),
  );
}

export function filterVideos(rows: VideoRow[], f: FilterState): VideoRow[] {
  return rows.filter(
    (r) =>
      matchesPeriod(r.LastAccessDate, f) &&
      matchesSchool(r.School, f.schools) &&
      (f.courses.length === 0 || f.courses.includes(r.Course)) &&
      (f.divisions.length === 0 || f.divisions.includes(r.Division)) &&
      (f.genders.length === 0 || f.genders.includes(r.Gender)),
  );
}

export function filterMcq(rows: McqRow[], f: FilterState): McqRow[] {
  return rows.filter(
    (r) =>
      matchesPeriod(r.AttemptedDate, f) &&
      matchesSchool(r.School, f.schools) &&
      (f.courses.length === 0 || f.courses.includes(r.Course)) &&
      (f.divisions.length === 0 || f.divisions.includes(r.Division)) &&
      (f.genders.length === 0 || f.genders.includes(r.Gender)),
  );
}

function courseUserIdSet(rows: VideoRow[], courses: string[]): Set<number> {
  const set = new Set<number>();
  for (const r of rows) {
    if (courses.includes(r.Course)) set.add(r.UserID);
  }
  return set;
}

// ---------- catalogue (full list of all values in source data) ----------

export interface Catalogue {
  years: number[];
  months: number[];
  schools: string[];
  courses: string[];
  divisions: string[];
  genders: string[];
  minDate: string; // YYYY-MM-DD — earliest date in source data
  maxDate: string; // YYYY-MM-DD — latest date in source data
}

let _catalogue: Catalogue | null = null;
export function getCatalogue(): Catalogue {
  if (_catalogue) return _catalogue;
  const years = new Set<number>();
  const months = new Set<number>();
  const schools = new Set<string>();
  const courses = new Set<string>();
  const divisions = new Set<string>();
  const genders = new Set<string>();
  let minDate = "";
  let maxDate = "";
  const trackDate = (d: string) => {
    if (!d) return;
    if (!minDate || d < minDate) minDate = d;
    if (!maxDate || d > maxDate) maxDate = d;
  };
  for (const r of LOGIN_ROWS) {
    years.add(getYear(r.LoginDate));
    months.add(getMonth(r.LoginDate));
    schools.add(r.School);
    if (r.Division) divisions.add(r.Division);
    if (r.Gender) genders.add(r.Gender);
    trackDate(r.LoginDate);
  }
  for (const r of VIDEO_ROWS) {
    years.add(getYear(r.LastAccessDate));
    months.add(getMonth(r.LastAccessDate));
    schools.add(r.School);
    if (r.Course) courses.add(r.Course);
    if (r.Division) divisions.add(r.Division);
    if (r.Gender) genders.add(r.Gender);
    trackDate(r.LastAccessDate);
  }
  _catalogue = {
    years: Array.from(years).sort((a, b) => b - a),
    months: Array.from(months).sort((a, b) => a - b),
    schools: sortAlpha(Array.from(schools)),
    courses: sortCourses(Array.from(courses)),
    divisions: sortAlpha(Array.from(divisions)),
    genders: sortAlpha(Array.from(genders)),
    minDate,
    maxDate,
  };
  return _catalogue;
}

// ---------- cascading: options available given current filter selections ----------

type FilterField = keyof FilterState;

function withoutField(f: FilterState, field: FilterField): FilterState {
  const cleared = { ...f };
  if (field === "year") cleared.year = "all";
  else if (field === "month") cleared.month = "all";
  else if (field === "schools") cleared.schools = [];
  else if (field === "courses") cleared.courses = [];
  else if (field === "divisions") cleared.divisions = [];
  else if (field === "genders") cleared.genders = [];
  return cleared;
}

export function availableFilterOptions(f: FilterState): Catalogue {
  // Years
  const yLF = filterLogins(LOGIN_ROWS, withoutField(f, "year"));
  const yVF = filterVideos(VIDEO_ROWS, withoutField(f, "year"));
  const years = new Set<number>();
  for (const r of yLF) years.add(getYear(r.LoginDate));
  for (const r of yVF) years.add(getYear(r.LastAccessDate));

  // Months
  const mLF = filterLogins(LOGIN_ROWS, withoutField(f, "month"));
  const mVF = filterVideos(VIDEO_ROWS, withoutField(f, "month"));
  const months = new Set<number>();
  for (const r of mLF) months.add(getMonth(r.LoginDate));
  for (const r of mVF) months.add(getMonth(r.LastAccessDate));

  // Schools
  const sLF = filterLogins(LOGIN_ROWS, withoutField(f, "schools"));
  const sVF = filterVideos(VIDEO_ROWS, withoutField(f, "schools"));
  const schools = new Set<string>();
  for (const r of sLF) schools.add(r.School);
  for (const r of sVF) schools.add(r.School);

  // Courses (only in video data)
  const cVF = filterVideos(VIDEO_ROWS, withoutField(f, "courses"));
  const courses = new Set<string>();
  for (const r of cVF) if (r.Course) courses.add(r.Course);

  // Divisions
  const dLF = filterLogins(LOGIN_ROWS, withoutField(f, "divisions"));
  const dVF = filterVideos(VIDEO_ROWS, withoutField(f, "divisions"));
  const divisions = new Set<string>();
  for (const r of dLF) if (r.Division) divisions.add(r.Division);
  for (const r of dVF) if (r.Division) divisions.add(r.Division);

  // Genders
  const gLF = filterLogins(LOGIN_ROWS, withoutField(f, "genders"));
  const gVF = filterVideos(VIDEO_ROWS, withoutField(f, "genders"));
  const genders = new Set<string>();
  for (const r of gLF) if (r.Gender) genders.add(r.Gender);
  for (const r of gVF) if (r.Gender) genders.add(r.Gender);

  // Always include the user's currently-selected values, so they can be deselected
  // even after they become "unavailable" under the rest of the filter.
  for (const s of f.schools) schools.add(s);
  for (const c of f.courses) courses.add(c);
  for (const d of f.divisions) divisions.add(d);
  for (const g of f.genders) genders.add(g);

  const base = getCatalogue();
  return {
    years: Array.from(years).sort((a, b) => b - a),
    months: Array.from(months).sort((a, b) => a - b),
    schools: sortAlpha(Array.from(schools)),
    courses: sortCourses(Array.from(courses)),
    divisions: sortAlpha(Array.from(divisions)),
    genders: sortAlpha(Array.from(genders)),
    minDate: base.minDate,
    maxDate: base.maxDate,
  };
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

// ---------- School activity composition (logins / sessions / videos / mcq + courses) ----------

export function computeSchoolComposition(f: FilterState): SchoolCompositionStat[] {
  const logins = filterLogins(LOGIN_ROWS, f);
  const videos = filterVideos(VIDEO_ROWS, f);
  const mcq = filterMcq(MCQ_ROWS, f);

  const map = new Map<string, SchoolCompositionStat>();
  const coursesBySchool = new Map<string, Set<string>>();
  const addCourse = (school: string, course: string) => {
    if (!course) return;
    if (!coursesBySchool.has(school)) coursesBySchool.set(school, new Set());
    coursesBySchool.get(school)!.add(course);
  };
  const ensure = (school: string): SchoolCompositionStat => {
    let cur = map.get(school);
    if (!cur) {
      cur = {
        school,
        logins: 0,
        sessions: 0,
        videoViews: 0,
        videoDurationMs: 0,
        mcqAttempts: 0,
        total: 0,
        courses: 0,
      };
      map.set(school, cur);
    }
    return cur;
  };

  for (const r of logins) {
    const s = ensure(r.School);
    s.logins += 1;
    if (r.SessionTime > 0) s.sessions += 1;
  }
  for (const r of videos) {
    const s = ensure(r.School);
    s.videoViews += 1;
    s.videoDurationMs += r.TotalViewDuration || 0;
    addCourse(r.School, r.Course);
  }
  for (const r of mcq) {
    const s = ensure(r.School);
    s.mcqAttempts += 1;
    addCourse(r.School, r.Course);
  }

  for (const s of map.values()) {
    s.total = s.logins + s.sessions + s.videoViews + s.mcqAttempts;
    s.courses = coursesBySchool.get(s.school)?.size || 0;
  }

  return Array.from(map.values()).sort((a, b) => b.total - a.total);
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

export function computeSchoolCourses(school: string, f: FilterState): string[] {
  const videos = filterVideos(VIDEO_ROWS, { ...f, schools: [school] });
  const mcq = filterMcq(MCQ_ROWS, { ...f, schools: [school] });
  const set = new Set<string>();
  for (const r of videos) if (r.Course) set.add(r.Course);
  for (const r of mcq) if (r.Course) set.add(r.Course);
  return sortCourses(Array.from(set));
}

export interface SchoolCourseStat {
  course: string;
  students: number;
  subjects: number;
  videoViews: number;
  videoDurationMs: number;
  mcqAttempts: number;
}

export function computeSchoolCourseStats(
  school: string,
  f: FilterState,
): SchoolCourseStat[] {
  const videos = filterVideos(VIDEO_ROWS, { ...f, schools: [school] });
  const mcq = filterMcq(MCQ_ROWS, { ...f, schools: [school] });

  const map = new Map<
    string,
    {
      students: Set<number>;
      subjects: Set<string>;
      videoViews: number;
      videoDurationMs: number;
      mcqAttempts: number;
    }
  >();
  const ensure = (course: string) => {
    let cur = map.get(course);
    if (!cur) {
      cur = {
        students: new Set<number>(),
        subjects: new Set<string>(),
        videoViews: 0,
        videoDurationMs: 0,
        mcqAttempts: 0,
      };
      map.set(course, cur);
    }
    return cur;
  };

  for (const r of videos) {
    if (!r.Course) continue;
    const c = ensure(r.Course);
    c.videoViews += 1;
    c.videoDurationMs += r.TotalViewDuration || 0;
    c.students.add(r.UserID);
    if (r.Subject) c.subjects.add(r.Subject);
  }
  for (const r of mcq) {
    if (!r.Course) continue;
    const c = ensure(r.Course);
    c.mcqAttempts += 1;
    c.students.add(r.UserID);
    if (r.Subject) c.subjects.add(r.Subject);
  }

  const list: SchoolCourseStat[] = Array.from(map.entries()).map(([course, v]) => ({
    course,
    students: v.students.size,
    subjects: v.subjects.size,
    videoViews: v.videoViews,
    videoDurationMs: v.videoDurationMs,
    mcqAttempts: v.mcqAttempts,
  }));
  const order = new Map(sortCourses(list.map((x) => x.course)).map((c, i) => [c, i]));
  list.sort((a, b) => (order.get(a.course)! - order.get(b.course)!));
  return list;
}

export interface CourseSubjectStat {
  subject: string;
  students: number;
  chapters: number;
  videoViews: number;
  videoDurationMs: number;
  mcqAttempts: number;
}

export function computeCourseSubjectStats(
  school: string,
  course: string,
  f: FilterState,
): CourseSubjectStat[] {
  const scopedFilter: FilterState = {
    ...f,
    schools: [school],
    courses: [course],
  };
  const videos = filterVideos(VIDEO_ROWS, scopedFilter);
  const mcq = filterMcq(MCQ_ROWS, scopedFilter);

  const map = new Map<
    string,
    {
      students: Set<number>;
      chapters: Set<string>;
      videoViews: number;
      videoDurationMs: number;
      mcqAttempts: number;
    }
  >();
  const ensure = (subject: string) => {
    let cur = map.get(subject);
    if (!cur) {
      cur = {
        students: new Set<number>(),
        chapters: new Set<string>(),
        videoViews: 0,
        videoDurationMs: 0,
        mcqAttempts: 0,
      };
      map.set(subject, cur);
    }
    return cur;
  };

  for (const r of videos) {
    if (r.Course !== course || !r.Subject) continue;
    const s = ensure(r.Subject);
    s.videoViews += 1;
    s.videoDurationMs += r.TotalViewDuration || 0;
    s.students.add(r.UserID);
    if (r.Chapter) s.chapters.add(r.Chapter);
  }
  for (const r of mcq) {
    if (r.Course !== course || !r.Subject) continue;
    const s = ensure(r.Subject);
    s.mcqAttempts += 1;
    s.students.add(r.UserID);
    if (r.Chapter) s.chapters.add(r.Chapter);
  }

  return Array.from(map.entries())
    .map(([subject, v]) => ({
      subject,
      students: v.students.size,
      chapters: v.chapters.size,
      videoViews: v.videoViews,
      videoDurationMs: v.videoDurationMs,
      mcqAttempts: v.mcqAttempts,
    }))
    .sort((a, b) => a.subject.localeCompare(b.subject));
}

export interface SubjectStudentStat {
  userId: number;
  enrollmentId: string;
  studentName: string;
  division: string;
  videoViews: number;
  videoDurationMs: number;
  chaptersTouched: number;
  mcqAttempts: number;
}

export interface SubjectChapterStat {
  chapter: string;
  students: number;
  videoViews: number;
  videoDurationMs: number;
  contentItems: number;
  mcqAttempts: number;
}

export interface SubjectDetail {
  videoViews: number;
  videoDurationMs: number;
  mcqAttempts: number;
  totalStudents: number;
  totalChapters: number;
  students: SubjectStudentStat[];
  chapters: SubjectChapterStat[];
}

export function computeSubjectDetail(
  school: string,
  course: string,
  subject: string,
  f: FilterState,
): SubjectDetail {
  const scopedFilter: FilterState = {
    ...f,
    schools: [school],
    courses: [course],
  };
  const videos = filterVideos(VIDEO_ROWS, scopedFilter).filter(
    (r) => r.Subject === subject,
  );
  const mcq = filterMcq(MCQ_ROWS, scopedFilter).filter(
    (r) => r.Subject === subject,
  );

  // ---- per-student ----
  const studentMap = new Map<
    number,
    {
      userId: number;
      enrollmentId: string;
      studentName: string;
      division: string;
      videoViews: number;
      videoDurationMs: number;
      chapters: Set<string>;
      mcqAttempts: number;
    }
  >();
  const ensureStudent = (
    userId: number,
    enrollmentId: string,
    name: string,
    division: string,
  ) => {
    let cur = studentMap.get(userId);
    if (!cur) {
      cur = {
        userId,
        enrollmentId,
        studentName: name,
        division,
        videoViews: 0,
        videoDurationMs: 0,
        chapters: new Set<string>(),
        mcqAttempts: 0,
      };
      studentMap.set(userId, cur);
    }
    return cur;
  };

  for (const r of videos) {
    const s = ensureStudent(r.UserID, r.EnrollmentID, r.StudentName, r.Division);
    s.videoViews += 1;
    s.videoDurationMs += r.TotalViewDuration || 0;
    if (r.Chapter) s.chapters.add(r.Chapter);
  }
  for (const r of mcq) {
    const s = ensureStudent(r.UserID, r.EnrollmentID, r.StudentName, r.Division);
    s.mcqAttempts += 1;
    if (r.Chapter) s.chapters.add(r.Chapter);
  }

  const students: SubjectStudentStat[] = Array.from(studentMap.values())
    .map((s) => ({
      userId: s.userId,
      enrollmentId: s.enrollmentId,
      studentName: s.studentName,
      division: s.division,
      videoViews: s.videoViews,
      videoDurationMs: s.videoDurationMs,
      chaptersTouched: s.chapters.size,
      mcqAttempts: s.mcqAttempts,
    }))
    .sort((a, b) => b.videoDurationMs - a.videoDurationMs);

  // ---- per-chapter ----
  const chapterMap = new Map<
    string,
    {
      students: Set<number>;
      videoViews: number;
      videoDurationMs: number;
      contentItems: Set<string>;
      mcqAttempts: number;
    }
  >();
  const ensureChapter = (chapter: string) => {
    let cur = chapterMap.get(chapter);
    if (!cur) {
      cur = {
        students: new Set<number>(),
        videoViews: 0,
        videoDurationMs: 0,
        contentItems: new Set<string>(),
        mcqAttempts: 0,
      };
      chapterMap.set(chapter, cur);
    }
    return cur;
  };

  for (const r of videos) {
    if (!r.Chapter) continue;
    const c = ensureChapter(r.Chapter);
    c.students.add(r.UserID);
    c.videoViews += 1;
    c.videoDurationMs += r.TotalViewDuration || 0;
    if (r.ContentName) c.contentItems.add(r.ContentName);
  }
  for (const r of mcq) {
    if (!r.Chapter) continue;
    const c = ensureChapter(r.Chapter);
    c.students.add(r.UserID);
    c.mcqAttempts += 1;
  }

  const chapters: SubjectChapterStat[] = Array.from(chapterMap.entries())
    .map(([chapter, v]) => ({
      chapter,
      students: v.students.size,
      videoViews: v.videoViews,
      videoDurationMs: v.videoDurationMs,
      contentItems: v.contentItems.size,
      mcqAttempts: v.mcqAttempts,
    }))
    .sort((a, b) => b.videoDurationMs - a.videoDurationMs);

  let totalDuration = 0;
  for (const r of videos) totalDuration += r.TotalViewDuration || 0;

  return {
    videoViews: videos.length,
    videoDurationMs: totalDuration,
    mcqAttempts: mcq.length,
    totalStudents: students.length,
    totalChapters: chapters.length,
    students,
    chapters,
  };
}

// ---------- Dashboard: Video usage overview ----------

export interface VideoSubjectBreakdown {
  subject: string;
  durationMs: number;
  views: number;
}

export interface VideoCourseBreakdown {
  course: string;
  durationMs: number;
  views: number;
  students: number;
  subjects: VideoSubjectBreakdown[]; // sorted desc by durationMs
}

export interface VideoUsageOverview {
  totalViews: number;
  totalDurationMs: number;
  uniqueStudents: number;
  uniqueContent: number;
  topCourses: VideoCourseBreakdown[]; // top N courses (standards) with nested subjects
  contentTypeMix: { type: string; views: number; durationMs: number }[];
}

const VIDEO_TOP_COURSES = 6;

export function computeVideoUsageOverview(f: FilterState): VideoUsageOverview {
  const videos = filterVideos(VIDEO_ROWS, f);

  const courseMap = new Map<
    string,
    {
      durationMs: number;
      views: number;
      students: Set<number>;
      subjects: Map<string, { durationMs: number; views: number }>;
    }
  >();
  const typeMap = new Map<string, { views: number; durationMs: number }>();
  const students = new Set<number>();
  const content = new Set<string>();
  let totalDurationMs = 0;

  for (const r of videos) {
    totalDurationMs += r.TotalViewDuration || 0;
    students.add(r.UserID);
    if (r.ContentName) content.add(`${r.Course}::${r.Subject}::${r.Chapter}::${r.ContentName}`);

    if (r.Course) {
      let c = courseMap.get(r.Course);
      if (!c) {
        c = {
          durationMs: 0,
          views: 0,
          students: new Set<number>(),
          subjects: new Map(),
        };
        courseMap.set(r.Course, c);
      }
      c.durationMs += r.TotalViewDuration || 0;
      c.views += 1;
      c.students.add(r.UserID);
      const subjKey = r.Subject || "(Unspecified)";
      const sub = c.subjects.get(subjKey) || { durationMs: 0, views: 0 };
      sub.durationMs += r.TotalViewDuration || 0;
      sub.views += 1;
      c.subjects.set(subjKey, sub);
    }

    const typeKey = r.ContentType || "Other";
    const t = typeMap.get(typeKey) || { views: 0, durationMs: 0 };
    t.views += 1;
    t.durationMs += r.TotalViewDuration || 0;
    typeMap.set(typeKey, t);
  }

  const topCourses: VideoCourseBreakdown[] = Array.from(courseMap.entries())
    .map(([course, v]) => ({
      course,
      durationMs: v.durationMs,
      views: v.views,
      students: v.students.size,
      subjects: Array.from(v.subjects.entries())
        .map(([subject, s]) => ({ subject, ...s }))
        .sort((a, b) => b.durationMs - a.durationMs),
    }))
    .sort((a, b) => b.durationMs - a.durationMs)
    .slice(0, VIDEO_TOP_COURSES);

  const contentTypeMix = Array.from(typeMap.entries())
    .map(([type, v]) => ({ type, ...v }))
    .sort((a, b) => b.views - a.views);

  return {
    totalViews: videos.length,
    totalDurationMs,
    uniqueStudents: students.size,
    uniqueContent: content.size,
    topCourses,
    contentTypeMix,
  };
}

// ---------- Dashboard: MCQ overview ----------

export interface McqSubjectBreakdown {
  subject: string;
  attempts: number;
  avgPercentage: number;
}

export interface McqCourseBreakdown {
  course: string;
  attempts: number;
  avgPercentage: number;
  students: number;
  subjects: McqSubjectBreakdown[]; // sorted desc by attempts
}

export interface McqOverview {
  totalAttempts: number;
  avgPercentage: number; // 0..100, weighted by attempt
  uniqueStudents: number;
  avgTimeSpentMs: number;
  topCourses: McqCourseBreakdown[]; // grouped by standard, with subjects nested
  scoreDistribution: { bucket: string; count: number }[];
}

const MCQ_TOP_COURSES = 6;

export function computeMcqOverview(f: FilterState): McqOverview {
  const mcq = filterMcq(MCQ_ROWS, f);

  const students = new Set<number>();
  let pctSum = 0;
  let timeSum = 0;
  const courseMap = new Map<
    string,
    {
      attempts: number;
      pctSum: number;
      students: Set<number>;
      subjects: Map<string, { attempts: number; pctSum: number }>;
    }
  >();
  const buckets = [
    { bucket: "0–20%", min: 0, max: 20, count: 0 },
    { bucket: "20–40%", min: 20, max: 40, count: 0 },
    { bucket: "40–60%", min: 40, max: 60, count: 0 },
    { bucket: "60–80%", min: 60, max: 80, count: 0 },
    { bucket: "80–100%", min: 80, max: 100.0001, count: 0 },
  ];

  for (const r of mcq) {
    students.add(r.UserID);
    pctSum += r.Percentage || 0;
    timeSum += r.TimeSpent || 0;
    if (r.Course) {
      let c = courseMap.get(r.Course);
      if (!c) {
        c = {
          attempts: 0,
          pctSum: 0,
          students: new Set<number>(),
          subjects: new Map(),
        };
        courseMap.set(r.Course, c);
      }
      c.attempts += 1;
      c.pctSum += r.Percentage || 0;
      c.students.add(r.UserID);
      const subjKey = r.Subject || "(Unspecified)";
      const sub = c.subjects.get(subjKey) || { attempts: 0, pctSum: 0 };
      sub.attempts += 1;
      sub.pctSum += r.Percentage || 0;
      c.subjects.set(subjKey, sub);
    }
    const p = r.Percentage || 0;
    for (const b of buckets) {
      if (p >= b.min && p < b.max) {
        b.count += 1;
        break;
      }
    }
  }

  const topCourses: McqCourseBreakdown[] = Array.from(courseMap.entries())
    .map(([course, v]) => ({
      course,
      attempts: v.attempts,
      avgPercentage: v.attempts > 0 ? v.pctSum / v.attempts : 0,
      students: v.students.size,
      subjects: Array.from(v.subjects.entries())
        .map(([subject, s]) => ({
          subject,
          attempts: s.attempts,
          avgPercentage: s.attempts > 0 ? s.pctSum / s.attempts : 0,
        }))
        .sort((a, b) => b.attempts - a.attempts),
    }))
    .sort((a, b) => b.attempts - a.attempts)
    .slice(0, MCQ_TOP_COURSES);

  return {
    totalAttempts: mcq.length,
    avgPercentage: mcq.length > 0 ? pctSum / mcq.length : 0,
    uniqueStudents: students.size,
    avgTimeSpentMs: mcq.length > 0 ? timeSum / mcq.length : 0,
    topCourses,
    scoreDistribution: buckets.map((b) => ({ bucket: b.bucket, count: b.count })),
  };
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
