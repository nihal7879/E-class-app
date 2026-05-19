import type { FilterState } from "./types";
import type {
  CourseDetailResponse,
  CourseSchoolsResponse,
  CourseSubjectsResponse,
  DailyActivityResponse,
  FilterCatalogue,
  KpiResponse,
  McqOverviewResponse,
  McqResultsResponse,
  SchoolCompositionResponse,
  SchoolCoursesResponse,
  SchoolDetailResponse,
  StudentsResponse,
  SubjectDetailResponse,
  SubjectStudentsResponse,
  VideoOverviewResponse,
  VideoUsageResponse,
} from "./apiTypes";

// Base URL: blank string means "same origin" so the Vite proxy ("/api" → http://localhost:4000)
// handles dev. In prod set VITE_API_BASE to the deployed backend origin.
const BASE = (import.meta.env.VITE_API_BASE ?? "").replace(/\/$/, "");

function filterToParams(f: FilterState | undefined): URLSearchParams {
  const p = new URLSearchParams();
  if (!f) return p;
  if (f.year !== "all")  p.set("year",  String(f.year));
  if (f.month !== "all") p.set("month", String(f.month));
  // Send each multi-value as a repeated query param (?schools=A&schools=B).
  // Joining with commas would corrupt values that contain commas — e.g. the
  // school name "Jilha Parishad Prathamik Shala, Nandanmal" was being split
  // into two non-matching halves on the backend.
  for (const s of f.schools)   p.append("schools",   s);
  for (const c of f.courses)   p.append("courses",   c);
  for (const d of f.divisions) p.append("divisions", d);
  for (const g of f.genders)   p.append("genders",   g);
  if (f.dateFrom) p.set("dateFrom", f.dateFrom);
  if (f.dateTo)   p.set("dateTo",   f.dateTo);
  return p;
}

function withExtra(params: URLSearchParams, extra?: Record<string, string | number | undefined>): URLSearchParams {
  if (!extra) return params;
  for (const [k, v] of Object.entries(extra)) {
    if (v === undefined || v === "") continue;
    params.set(k, String(v));
  }
  return params;
}

// In-flight request dedupe: if React StrictMode (or a race) fires the same
// fetch twice before the first resolves, both callers share the same promise
// → only one network request actually goes out.
const inFlight = new Map<string, Promise<unknown>>();

async function getJson<T>(path: string, params?: URLSearchParams): Promise<T> {
  const qs = params && [...params.keys()].length ? `?${params.toString()}` : "";
  const url = `${BASE}${path}${qs}`;
  const existing = inFlight.get(url);
  if (existing) return existing as Promise<T>;

  const p = (async (): Promise<T> => {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`${res.status} ${res.statusText} — ${path}${text ? `: ${text}` : ""}`);
    }
    return (await res.json()) as T;
  })();

  inFlight.set(url, p);
  try {
    return await p;
  } finally {
    inFlight.delete(url);
  }
}

export const api = {
  health: () => getJson<{ ok: boolean }>("/api/health"),

  catalogue: () => getJson<FilterCatalogue>("/api/filters/catalogue"),

  kpis: (f: FilterState) =>
    getJson<KpiResponse>("/api/kpis", filterToParams(f)),

  dailyActivity: (f: FilterState) =>
    getJson<DailyActivityResponse>("/api/activity/daily", filterToParams(f)),

  schoolsComposition: (f: FilterState) =>
    getJson<SchoolCompositionResponse>("/api/schools/composition", filterToParams(f)),

  schoolDetail: (school: string, f: FilterState) =>
    getJson<SchoolDetailResponse>(`/api/schools/${encodeURIComponent(school)}`, filterToParams(f)),

  schoolCourses: (school: string, f: FilterState) =>
    getJson<SchoolCoursesResponse>(`/api/schools/${encodeURIComponent(school)}/courses`, filterToParams(f)),

  courseDetail: (course: string, f: FilterState) =>
    getJson<CourseDetailResponse>(`/api/courses/${encodeURIComponent(course)}`, filterToParams(f)),

  courseSubjects: (course: string, f: FilterState) =>
    getJson<CourseSubjectsResponse>(`/api/courses/${encodeURIComponent(course)}/subjects`, filterToParams(f)),

  courseSchools: (course: string, f: FilterState) =>
    getJson<CourseSchoolsResponse>(`/api/courses/${encodeURIComponent(course)}/schools`, filterToParams(f)),

  subjectDetail: (subject: string, f: FilterState) =>
    getJson<SubjectDetailResponse>(`/api/subjects/${encodeURIComponent(subject)}`, filterToParams(f)),

  subjectStudents: (subject: string, f: FilterState) =>
    getJson<SubjectStudentsResponse>(`/api/subjects/${encodeURIComponent(subject)}/students`, filterToParams(f)),

  videoUsage: (f: FilterState, opts?: { limit?: number }) =>
    getJson<VideoUsageResponse>("/api/videos/usage", withExtra(filterToParams(f), opts)),

  videoOverview: (f: FilterState) =>
    getJson<VideoOverviewResponse>("/api/videos/overview", filterToParams(f)),

  mcqResults: (f: FilterState, opts?: { limit?: number }) =>
    getJson<McqResultsResponse>("/api/mcq/results", withExtra(filterToParams(f), opts)),

  mcqOverview: (f: FilterState) =>
    getJson<McqOverviewResponse>("/api/mcq/overview", filterToParams(f)),

  students: (f: FilterState, opts?: { limit?: number; sort?: "logins" | "sessionMs" | "videoViews" | "mcqAttempts" }) =>
    getJson<StudentsResponse>("/api/students", withExtra(filterToParams(f), opts)),
};





