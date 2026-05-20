import { useEffect, useMemo } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useCourseSubjects } from "@/lib/hooks";
import { useFilter } from "@/lib/filterContext";
import {
  courseFromId,
  courseId as toCourseId,
  formatCourseLabel,
  formatNumber,
  naturalCompare,
  schoolFromId,
  schoolId as toSchoolId,
  subjectId as toSubjectId,
} from "@/lib/parse";
import SectionHeader from "@/components/ui/SectionHeader";
import { HorizontalCardListSkeleton } from "@/components/ui/Skeleton";

export default function CourseSubjectsPage() {
  const { schoolId: sId, courseId: cId } = useParams<{
    schoolId: string;
    courseId: string;
  }>();
  const school = sId ? schoolFromId(sId) : "";
  const course = cId ? courseFromId(cId) : "";
  const [searchParams] = useSearchParams();
  const backFromCourse = searchParams.get("back") === "course";
  const { setFilter } = useFilter();
  const navigate = useNavigate();

  useEffect(() => {
    if (!school) return;
    setFilter((f) =>
      f.schools.length === 1 && f.schools[0] === school
        ? f
        : { ...f, schools: [school] },
    );
  }, [school, setFilter]);

  // Pin the school via explicit override so we don't depend on the filter-sync
  // effect (which used to cause a race-induced double fetch on navigation).
  const extra = useMemo(() => ({ schools: school ? [school] : [] }), [school]);
  const { data, loading } = useCourseSubjects(school && course ? course : undefined, extra);
  const subjects = useMemo(
    () =>
      (data?.items ?? [])
        .map((s) => ({
          subject: s.subject,
          students: s.students,
          chapters: s.chapters,
          videoViews: s.videoViews,
          videoDurationMs: s.videoWatchMs,
          mcqAttempts: s.mcqAttempts,
          avgMcqPercentage: s.avgPercentage,
        }))
        // Order subject cards naturally — "1. …", "2. …", "10. …".
        .sort((a, b) => naturalCompare(a.subject, b.subject)),
    [data],
  );

  const coursesHref = backFromCourse && course
    ? `/course/${toCourseId(course)}`
    : school
      ? `/school/${toSchoolId(school)}/courses`
      : "/dashboard";
  const backLabel = backFromCourse ? "Back to standard" : "Back to courses";

  return (
    <div className="space-y-6 pb-12">
      <div className="card p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <Link
              to={coursesHref}
              onClick={(e) => {
                if (backFromCourse) {
                  e.preventDefault();
                  setFilter((f) => ({ ...f, schools: [] }));
                  navigate(coursesHref);
                }
              }}
              className="inline-flex items-center gap-1 text-[12px] font-medium text-slate-500 transition hover:text-accent-600"
            >
              <ArrowLeftIcon />
              {backLabel}
            </Link>
            <div className="mt-1 text-[12px] font-medium text-slate-500">
              {school || "Unknown school"} · Course
            </div>
            <h2 className="mt-0.5 truncate text-[22px] font-bold text-slate-900">
              {course ? formatCourseLabel(course) : "Unknown"}
            </h2>
            <p className="mt-1 text-[12.5px] text-slate-500">
              <span className="num font-semibold text-slate-700">
                {subjects.length}
              </span>{" "}
              {subjects.length === 1 ? "subject" : "subjects"} in this course
            </p>
          </div>
        </div>
      </div>

      <div>
        <SectionHeader
          title="Subjects"
          description="Activity scoped to the current filter selections."
        />
        {loading && !data ? (
          <HorizontalCardListSkeleton count={5} metrics={5} />
        ) : subjects.length === 0 ? (
          <div className="card flex items-center justify-center p-10 text-[13px] text-slate-500">
            No subjects for this course under the current filters.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {subjects.map((s) => (
              <SubjectCard
                key={s.subject}
                stat={s}
                href={
                  school && course
                    ? `/school/${toSchoolId(school)}/course/${toCourseId(course)}/subject/${toSubjectId(s.subject)}`
                    : "#"
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface SubjectStat {
  subject: string;
  students: number;
  chapters: number;
  videoViews: number;
  videoDurationMs: number;
  mcqAttempts: number;
  avgMcqPercentage: number;
}

function SubjectCard({
  stat,
  href,
}: {
  stat: SubjectStat;
  href: string;
}) {
  const hours = stat.videoDurationMs / 3_600_000;
  return (
    <Link
      to={href}
      aria-label={`View details for ${stat.subject}`}
      className="card card-hover group flex flex-col gap-4 p-4 outline-none transition focus-visible:ring-2 focus-visible:ring-accent-200 sm:flex-row sm:items-center sm:gap-5 sm:p-5"
    >
      {/* Left: icon + title */}
      <div className="flex items-center gap-3 sm:min-w-[220px] sm:max-w-[300px] sm:flex-1">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
          <SubjectIcon />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
            Subject
          </div>
          <div className="truncate text-[15px] font-semibold text-slate-900 group-hover:text-indigo-700">
            {stat.subject}
          </div>
        </div>
      </div>

      {/* Middle: metrics in fixed-width columns so numbers align across rows */}
      <div className="grid grid-cols-2 gap-2.5 sm:flex sm:flex-1 sm:items-center sm:justify-end sm:gap-6">
        <Metric label="Students" value={formatNumber(stat.students)} />
        <Metric label="Chapters" value={formatNumber(stat.chapters)} />
        <Metric label="Video views" value={formatNumber(stat.videoViews)} />
        <Metric
          label="Watch time"
          value={hours >= 10 ? hours.toFixed(0) : hours.toFixed(1)}
          unit="hrs"
        />
        <Metric label="MCQ attempts" value={formatNumber(stat.mcqAttempts)} />
      </div>

      {/* Right: chevron only — whole card is clickable */}
      <div className="hidden text-indigo-600 transition group-hover:translate-x-0.5 sm:flex sm:items-center sm:pl-2">
        <ChevronRightIcon />
      </div>
    </Link>
  );
}

function Metric({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit?: string;
}) {
  return (
    <div className="flex flex-col sm:w-[96px] sm:items-center sm:text-center">
      <div className="text-[10.5px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-0.5 flex items-baseline gap-1 sm:justify-center">
        <span className="num text-[15px] font-bold text-slate-900 tabular-nums">
          {value}
        </span>
        {unit && (
          <span className="text-[11px] font-medium text-slate-500">{unit}</span>
        )}
      </div>
    </div>
  );
}

function ArrowLeftIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="mt-0.5 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-indigo-600"
    >
      <polyline points="9 6 15 12 9 18" />
    </svg>
  );
}

function SubjectIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}
