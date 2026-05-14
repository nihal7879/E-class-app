import { useEffect, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import {
  computeSchoolCourses,
  computeSchoolDailyActivity,
  computeStudentStats,
} from "@/lib/aggregations";
import { useFilter } from "@/lib/filterContext";
import { formatNumber, schoolFromId, schoolId as toSchoolId } from "@/lib/parse";
import KpiTile from "@/components/kpi/KpiTile";
import DailyActivityChart from "@/components/charts/DailyActivityChart";
import StudentBreakdownChart from "@/components/charts/StudentBreakdownChart";
import StudentList from "@/components/charts/StudentList";
import SectionHeader from "@/components/ui/SectionHeader";

export default function SchoolDetailPage() {
  const { schoolId: id } = useParams<{ schoolId: string }>();
  const school = id ? schoolFromId(id) : "";
  const { filter, setFilter } = useFilter();

  // Keep the schools filter in sync with the URL school so the Filter popover
  // reflects the current view, and so changes to it can navigate elsewhere.
  useEffect(() => {
    if (!school) return;
    setFilter((f) =>
      f.schools.length === 1 && f.schools[0] === school
        ? f
        : { ...f, schools: [school] },
    );
  }, [school, setFilter]);

  const students = useMemo(() => computeStudentStats(school, filter), [school, filter]);
  const daily = useMemo(
    () => computeSchoolDailyActivity(school, filter),
    [school, filter],
  );
  const courseCount = useMemo(
    () => (school ? computeSchoolCourses(school, filter).length : 0),
    [school, filter],
  );

  const topStudents = students.slice(0, 5);
  const lowStudents = students
    .filter((s) => s.totalSessionMs > 0)
    .slice(-5)
    .reverse();

  const totalSessions = students.reduce((a, s) => a + s.sessions, 0);
  const totalLogins = students.reduce((a, s) => a + s.logins, 0);
  const totalMs = students.reduce((a, s) => a + s.totalSessionMs, 0);
  const totalHours = totalMs / 3_600_000;

  const coursesHref = school ? `/school/${toSchoolId(school)}/courses` : "#";

  return (
    <div className="space-y-6 pb-12">
      <div className="card p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[12px] font-medium text-slate-500">School</div>
            <h2 className="mt-0.5 truncate text-[22px] font-bold text-slate-900">
              {school || "Unknown"}
            </h2>
            <p className="mt-1 text-[12.5px] text-slate-500">
              <span className="num font-semibold text-slate-700">
                {students.length}
              </span>{" "}
              students · per-student activity below
            </p>
          </div>
        </div>
      </div>

      <section className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        <KpiTile
          tone="indigo"
          label="Students"
          value={formatNumber(students.length)}
          icon={<UsersIcon />}
        />
        <Link
          to={coursesHref}
          aria-label="View courses for this school"
          className="block rounded-2xl outline-none transition focus-visible:ring-2 focus-visible:ring-accent-200"
        >
          <KpiTile
            tone="emerald"
            label="Courses"
            value={formatNumber(courseCount)}
            icon={<BookIcon />}
            hint={
              <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                View courses
                <ArrowRightIcon />
              </span>
            }
          />
        </Link>
        <KpiTile
          tone="rose"
          label="Total logins"
          value={formatNumber(totalLogins)}
          icon={<KeyIcon />}
        />
        <KpiTile
          tone="violet"
          label="Total sessions"
          value={formatNumber(totalSessions)}
          icon={<PlayIcon />}
        />
        <KpiTile
          tone="amber"
          label="Total usage"
          value={totalHours >= 10 ? totalHours.toFixed(0) : totalHours.toFixed(1)}
          unit="hrs"
          icon={<ClockIcon />}
        />
      </section>

      <div>
        <SectionHeader
          title="Daily activity"
          description="Logins and active students per day for this school."
        />
        <DailyActivityChart data={daily} />
      </div>

      <div>
        <SectionHeader
          title="Per-student breakdown"
          description="Sessions and usage time by Enrollment ID."
        />
        <StudentBreakdownChart students={students} />
      </div>

      <div>
        <SectionHeader
          title="Top and low usage students"
          description="Who's spending the most and least time on the platform."
        />
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <StudentList
            title="Top usage students"
            subtitle="Highest total time logged in"
            students={topStudents}
            tone="emerald"
          />
          <StudentList
            title="Low usage students"
            subtitle="Active but lowest total time"
            students={lowStudents}
            tone="rose"
            emptyText="No students with non-zero usage to rank"
          />
        </div>
      </div>
    </div>
  );
}

function UsersIcon() {
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
      <path d="M16 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M8 21v-2a4 4 0 0 1 3-3.87" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
function KeyIcon() {
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
      <circle cx="8" cy="15" r="4" />
      <path d="m10.85 12.15 7.65-7.65" />
      <path d="m18 8 2 2" />
      <path d="m15 5 3 3" />
    </svg>
  );
}
function PlayIcon() {
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
      <polygon points="6 4 20 12 6 20 6 4" />
    </svg>
  );
}
function ClockIcon() {
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
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15 14" />
    </svg>
  );
}
function BookIcon() {
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
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
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
