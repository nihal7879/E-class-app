import { useMemo } from "react";
import { useParams } from "react-router-dom";
import {
  computeSchoolDailyActivity,
  computeSchoolDailyUsageHours,
  computeStudentStats,
} from "@/lib/aggregations";
import { useFilter } from "@/lib/filterContext";
import { formatNumber, schoolFromId } from "@/lib/parse";
import FilterBar from "@/components/filters/FilterBar";
import KpiTile from "@/components/kpi/KpiTile";
import DailyActivityChart from "@/components/charts/DailyActivityChart";
import StudentSessionChart from "@/components/charts/StudentSessionChart";
import UsageDurationChart from "@/components/charts/UsageDurationChart";
import StudentList from "@/components/charts/StudentList";
import SectionHeader from "@/components/ui/SectionHeader";

export default function SchoolDetailPage() {
  const { schoolId: id } = useParams<{ schoolId: string }>();
  const school = id ? schoolFromId(id) : "";
  const { filter } = useFilter();

  const students = useMemo(() => computeStudentStats(school, filter), [school, filter]);
  const daily = useMemo(
    () => computeSchoolDailyActivity(school, filter),
    [school, filter],
  );
  const dailyHours = useMemo(
    () => computeSchoolDailyUsageHours(school, filter),
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

  const dailyLogins = daily.map((d) => ({ date: d.date, value: d.logins }));
  const dailyStudents = daily.map((d) => ({ date: d.date, value: d.uniqueStudents }));

  const totalHours = totalMs / 3_600_000;

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

      <FilterBar />

      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiTile
          tone="indigo"
          label="Students"
          value={formatNumber(students.length)}
          icon={<UsersIcon />}
          series={dailyStudents}
        />
        <KpiTile
          tone="rose"
          label="Total logins"
          value={formatNumber(totalLogins)}
          icon={<KeyIcon />}
          series={dailyLogins}
        />
        <KpiTile
          tone="violet"
          label="Total sessions"
          value={formatNumber(totalSessions)}
          icon={<PlayIcon />}
          series={dailyLogins}
        />
        <KpiTile
          tone="amber"
          label="Total usage"
          value={totalHours >= 10 ? totalHours.toFixed(0) : totalHours.toFixed(1)}
          unit="hrs"
          icon={<ClockIcon />}
          series={dailyHours}
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
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <StudentSessionChart students={students} />
          <UsageDurationChart students={students} />
        </div>
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
