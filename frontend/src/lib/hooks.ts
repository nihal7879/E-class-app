import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";
import { useFilter } from "./filterContext";
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

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Generic async-fetch hook. `fetcher` is re-run whenever `deps` change.
 * Out-of-order responses are dropped via a ref counter so the latest call wins.
 */
export function useApi<T>(fetcher: () => Promise<T>, deps: ReadonlyArray<unknown>): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const callId = useRef(0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = ++callId.current;
    setLoading(true);
    setError(null);
    fetcher()
      .then((result) => {
        if (id !== callId.current) return;
        setData(result);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (id !== callId.current) return;
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const refetch = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, error, refetch };
}

// Stable JSON of the filter state — used as a single dependency so changes
// to any filter field re-trigger the fetch.
function useFilterKey(): string {
  const { filter } = useFilter();
  return JSON.stringify(filter);
}

// Merges optional per-call overrides into the context filter. Used by page-
// scoped hooks (e.g., students for a specific school) to avoid relying on the
// context-sync effect that previously caused a race-condition double-fetch.
import type { FilterState } from "./types";
function mergeFilter(base: FilterState, extra?: Partial<FilterState>): FilterState {
  if (!extra) return base;
  return { ...base, ...extra };
}

export function useCatalogue(): AsyncState<FilterCatalogue> {
  return useApi(() => api.catalogue(), []);
}

export function useKpis(): AsyncState<KpiResponse> {
  const { filter } = useFilter();
  const key = useFilterKey();
  return useApi(() => api.kpis(filter), [key]);
}

export function useDailyActivity(extra?: Partial<FilterState>): AsyncState<DailyActivityResponse> {
  const { filter } = useFilter();
  const key = useFilterKey();
  const extraKey = JSON.stringify(extra ?? null);
  return useApi(() => api.dailyActivity(mergeFilter(filter, extra)), [key, extraKey]);
}

export function useSchoolsComposition(): AsyncState<SchoolCompositionResponse> {
  const { filter } = useFilter();
  const key = useFilterKey();
  return useApi(() => api.schoolsComposition(filter), [key]);
}

export function useSchoolDetail(school: string | undefined): AsyncState<SchoolDetailResponse> {
  const { filter } = useFilter();
  const key = useFilterKey();
  return useApi(() => {
    if (!school) return Promise.reject(new Error("school is required"));
    return api.schoolDetail(school, filter);
  }, [key, school]);
}

export function useSchoolCourses(school: string | undefined): AsyncState<SchoolCoursesResponse> {
  const { filter } = useFilter();
  const key = useFilterKey();
  return useApi(() => {
    if (!school) return Promise.reject(new Error("school is required"));
    return api.schoolCourses(school, filter);
  }, [key, school]);
}

export function useCourseDetail(course: string | undefined): AsyncState<CourseDetailResponse> {
  const { filter } = useFilter();
  const key = useFilterKey();
  return useApi(() => {
    if (!course) return Promise.reject(new Error("course is required"));
    return api.courseDetail(course, filter);
  }, [key, course]);
}

export function useCourseSubjects(
  course: string | undefined,
  extra?: Partial<FilterState>,
): AsyncState<CourseSubjectsResponse> {
  const { filter } = useFilter();
  const key = useFilterKey();
  const extraKey = JSON.stringify(extra ?? null);
  return useApi(() => {
    if (!course) return Promise.reject(new Error("course is required"));
    return api.courseSubjects(course, mergeFilter(filter, extra));
  }, [key, course, extraKey]);
}

export function useCourseSchools(course: string | undefined): AsyncState<CourseSchoolsResponse> {
  const { filter } = useFilter();
  const key = useFilterKey();
  return useApi(() => {
    if (!course) return Promise.reject(new Error("course is required"));
    return api.courseSchools(course, filter);
  }, [key, course]);
}

export function useSubjectDetail(
  subject: string | undefined,
  extra?: Partial<FilterState>,
): AsyncState<SubjectDetailResponse> {
  const { filter } = useFilter();
  const key = useFilterKey();
  const extraKey = JSON.stringify(extra ?? null);
  return useApi(() => {
    if (!subject) return Promise.reject(new Error("subject is required"));
    return api.subjectDetail(subject, mergeFilter(filter, extra));
  }, [key, subject, extraKey]);
}

export function useSubjectStudents(
  subject: string | undefined,
  extra?: Partial<FilterState>,
): AsyncState<SubjectStudentsResponse> {
  const { filter } = useFilter();
  const key = useFilterKey();
  const extraKey = JSON.stringify(extra ?? null);
  return useApi(() => {
    if (!subject) return Promise.reject(new Error("subject is required"));
    return api.subjectStudents(subject, mergeFilter(filter, extra));
  }, [key, subject, extraKey]);
}

export function useVideoUsage(opts?: { limit?: number }): AsyncState<VideoUsageResponse> {
  const { filter } = useFilter();
  const key = useFilterKey();
  const limit = opts?.limit;
  return useApi(() => api.videoUsage(filter, { limit }), [key, limit]);
}

export function useVideoOverview(): AsyncState<VideoOverviewResponse> {
  const { filter } = useFilter();
  const key = useFilterKey();
  return useApi(() => api.videoOverview(filter), [key]);
}

export function useMcqResults(opts?: { limit?: number }): AsyncState<McqResultsResponse> {
  const { filter } = useFilter();
  const key = useFilterKey();
  const limit = opts?.limit;
  return useApi(() => api.mcqResults(filter, { limit }), [key, limit]);
}

export function useMcqOverview(): AsyncState<McqOverviewResponse> {
  const { filter } = useFilter();
  const key = useFilterKey();
  return useApi(() => api.mcqOverview(filter), [key]);
}

export function useStudents(opts?: {
  limit?: number;
  sort?: "logins" | "sessionMs" | "videoViews" | "mcqAttempts";
  extra?: Partial<FilterState>;
}): AsyncState<StudentsResponse> {
  const { filter } = useFilter();
  const key = useFilterKey();
  const limit = opts?.limit;
  const sort = opts?.sort;
  const extraKey = JSON.stringify(opts?.extra ?? null);
  return useApi(
    () => api.students(mergeFilter(filter, opts?.extra), { limit, sort }),
    [key, limit, sort, extraKey],
  );
}
