import { useEffect, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { computeCourseSubjectStats } from "@/lib/aggregations";
import { useFilter } from "@/lib/filterContext";
import {
  courseFromId,
  courseId as toCourseId,
  formatCourseLabel,
  formatNumber,
  schoolFromId,
  schoolId as toSchoolId,
  subjectId as toSubjectId,
} from "@/lib/parse";
import SectionHeader from "@/components/ui/SectionHeader";

export default function CourseSubjectsPage() {
  const { schoolId: sId, courseId: cId } = useParams<{
    schoolId: string;
    courseId: string;
  }>();
  const school = sId ? schoolFromId(sId) : "";
  const course = cId ? courseFromId(cId) : "";
  const { filter, setFilter } = useFilter();

  // Sync only the school to the global filter — the course scope lives in the
  // URL and is applied by computeCourseSubjectStats internally. Writing the
  // course into filter.courses would persist after navigating back and hide
  // the other courses on SchoolCoursesPage.
  useEffect(() => {
    if (!school) return;
    setFilter((f) =>
      f.schools.length === 1 && f.schools[0] === school
        ? f
        : { ...f, schools: [school] },
    );
  }, [school, setFilter]);

  const subjects = useMemo(
    () =>
      school && course ? computeCourseSubjectStats(school, course, filter) : [],
    [school, course, filter],
  );

  const coursesHref = school ? `/school/${toSchoolId(school)}/courses` : "/dashboard";

  return (
    <div className="space-y-6 pb-12">
      <div className="card p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <Link
              to={coursesHref}
              className="inline-flex items-center gap-1 text-[12px] font-medium text-slate-500 transition hover:text-accent-600"
            >
              <ArrowLeftIcon />
              Back to courses
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
        {subjects.length === 0 ? (
          <div className="card flex items-center justify-center p-10 text-[13px] text-slate-500">
            No subjects for this course under the current filters.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
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

function SubjectCard({
  stat,
  href,
}: {
  stat: ReturnType<typeof computeCourseSubjectStats>[number];
  href: string;
}) {
  const hours = stat.videoDurationMs / 3_600_000;
  return (
    <Link
      to={href}
      aria-label={`View details for ${stat.subject}`}
      className="card card-hover group flex flex-col gap-3 p-4 outline-none transition focus-visible:ring-2 focus-visible:ring-accent-200 sm:p-5"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
          <SubjectIcon />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11.5px] font-medium uppercase tracking-wide text-slate-500">
            Subject
          </div>
          <div className="truncate text-[15px] font-semibold text-slate-900">
            {stat.subject}
          </div>
        </div>
        <ChevronRightIcon />
      </div>

      <div className="grid grid-cols-2 gap-2.5 text-[12px]">
        <Metric label="Students" value={formatNumber(stat.students)} />
        <Metric label="Chapters" value={formatNumber(stat.chapters)} />
        <Metric label="Video views" value={formatNumber(stat.videoViews)} />
        <Metric
          label="Watch time"
          value={hours >= 10 ? hours.toFixed(0) : hours.toFixed(1)}
          unit="hrs"
        />
        <Metric
          label="MCQ attempts"
          value={formatNumber(stat.mcqAttempts)}
          span={2}
        />
      </div>

      <div className="mt-auto inline-flex items-center gap-1 text-[11.5px] font-semibold text-indigo-700">
        View students & chapters
        <ArrowRightIcon />
      </div>
    </Link>
  );
}

function Metric({
  label,
  value,
  unit,
  span,
}: {
  label: string;
  value: string;
  unit?: string;
  span?: number;
}) {
  return (
    <div
      className={
        "rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 " +
        (span === 2 ? "col-span-2" : "")
      }
    >
      <div className="text-[10.5px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-0.5 flex items-baseline gap-1">
        <span className="num text-[16px] font-bold text-slate-900">{value}</span>
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

function ArrowRightIcon() {
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
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
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
