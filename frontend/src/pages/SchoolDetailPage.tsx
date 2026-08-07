import { useEffect, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import {
  useDailyActivity,
  useSchoolCourses,
  useSchoolDetail,
  useSchoolSubjects,
  useStudents,
} from "@/lib/hooks";
import { useFilter } from "@/lib/filterContext";
import { formatNumber, schoolFromId, schoolId as toSchoolId } from "@/lib/parse";
import type { StudentStat } from "@/lib/types";
import KpiTile from "@/components/kpi/KpiTile";
import DailyActivityChart from "@/components/charts/DailyActivityChart";
import StudentBreakdownChart from "@/components/charts/StudentBreakdownChart";
import StudentList from "@/components/charts/StudentList";
import SectionHeader from "@/components/ui/SectionHeader";
import { KpiStripSkeleton } from "@/components/ui/Skeleton";

export default function SchoolDetailPage() {
  const { schoolId: id } = useParams<{ schoolId: string }>();
  const school = id ? schoolFromId(id) : "";
  const { setFilter } = useFilter();

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

  // Pin the school in the request directly — don't wait for the context-sync
  // effect to write it to filter.schools (that caused a race where the first
  // render fetched with the WRONG school, then re-fetched with the right one).
  const extra = useMemo(() => ({ schools: school ? [school] : [] }), [school]);
  const studentsApi = useStudents({ sort: "sessionMs", limit: 1000, extra });
  const dailyApi = useDailyActivity(extra);
  const coursesApi = useSchoolCourses(school);
  const subjectsApi = useSchoolSubjects(school);
  // School-wide totals aggregated in SQL. Preferred over summing the students
  // list for video/MCQ, which is capped at 1000 rows and would under-count.
  const detailApi = useSchoolDetail(school);

  const students: StudentStat[] = useMemo(
    () =>
      (studentsApi.data?.items ?? []).map((s) => ({
        enrollmentId: s.enrollmentId ?? String(s.userId),
        studentName: s.studentName ?? "",
        // "Session" = login with any recorded time (>= 1 sec). Only
        // zero-duration rows are excluded.
        sessions: s.activeSessions,
        totalSessionMs: s.totalSessionMs,
        logins: s.logins,
        videoWatchMs: s.videoWatchMs,
        mcqAttempts: s.mcqAttempts,
      })),
    [studentsApi.data],
  );
  const daily = useMemo(
    () =>
      (dailyApi.data?.series ?? []).map((d) => ({
        date: d.date,
        logins: d.logins,
        uniqueStudents: d.uniqueStudents,
      })),
    [dailyApi.data],
  );
  const courseCount = coursesApi.data?.items.length ?? 0;
  // Top 5 subjects by video watch time (learning hours) for this school.
  const topSubjects = useMemo(
    () => (subjectsApi.data?.items ?? []).slice(0, 5),
    [subjectsApi.data],
  );
  const subjectsLoading = subjectsApi.loading && !subjectsApi.data;
  const studentsLoading = studentsApi.loading && !studentsApi.data;
  const dailyLoading = dailyApi.loading && !dailyApi.data;
  const kpisLoading =
    (studentsApi.loading && !studentsApi.data) ||
    (coursesApi.loading && !coursesApi.data) ||
    (detailApi.loading && !detailApi.data);

  // Top/low lists rank on video watch time, not login session time.
  const sortedDesc = useMemo(
    () => [...students].sort((a, b) => b.videoWatchMs - a.videoWatchMs),
    [students],
  );
  // Zero is never a ranking — a student with no watch time isn't a "top" or a
  // "low" performer, they're absent from the metric. Both lists drop them.
  const watched = sortedDesc.filter((s) => s.videoWatchMs > 0);
  const topStudents = watched.slice(0, 5);
  const lowStudents = watched.slice(-5).reverse();

  // Same rule for the per-student chart: a student with no video and no MCQ
  // activity contributes two empty bars and nothing else.
  const activeStudents = useMemo(
    () => students.filter((s) => s.videoWatchMs > 0 || s.mcqAttempts > 0),
    [students],
  );

  const totalSessions = students.reduce((a, s) => a + s.sessions, 0);
  const totalMcqAttempts = detailApi.data?.mcqAttempts ?? 0;
  // Video watch time (video_usage.total_view_duration), NOT login session
  // time — this tile answers "how much video did this school actually watch".
  const videoHours = (detailApi.data?.videoWatchMs ?? 0) / 3_600_000;

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

      {kpisLoading ? (
        <KpiStripSkeleton />
      ) : (
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
          label="Total MCQ attempts"
          value={formatNumber(totalMcqAttempts)}
          icon={<McqIcon />}
        />
        <KpiTile
          tone="violet"
          label="Total sessions"
          value={formatNumber(totalSessions)}
          icon={<PlayIcon />}
        />
        <KpiTile
          tone="amber"
          label="Total video usage"
          value={videoHours >= 10 ? videoHours.toFixed(0) : videoHours.toFixed(1)}
          unit="hrs"
          icon={<ClockIcon />}
        />
      </section>
      )}

      <div>
        <SectionHeader
          title="Top subjects"
          description="Most-watched subjects by learning hours in this school."
        />
        <TopSubjects subjects={topSubjects} loading={subjectsLoading} />
      </div>

      <div>
        <SectionHeader
          title="Daily activity"
          description="Logins and active students per day for this school."
        />
        <DailyActivityChart data={daily} loading={dailyLoading} />
      </div>

      <div>
        <SectionHeader
          title="Per-student breakdown"
          description="Video usage and MCQ attempts by Enrollment ID."
        />
        <StudentBreakdownChart students={activeStudents} loading={studentsLoading} />
      </div>

      <div>
        <SectionHeader
          title="Top and low usage students"
          description="Who's spending the most and least time on the platform."
        />
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <StudentList
            title="Top usage students"
            subtitle="Most video watch time"
            students={topStudents}
            tone="emerald"
            loading={studentsLoading}
          />
          <StudentList
            title="Low usage students"
            subtitle="Least video watch time, excluding students with none"
            students={lowStudents}
            tone="rose"
            emptyText="No students with video watch time to rank"
            loading={studentsLoading}
          />
        </div>
      </div>
    </div>
  );
}

// Top 5 subjects ranked by learning hours (video watch time) for the school.
function TopSubjects({
  subjects,
  loading,
}: {
  subjects: { subject: string; watchMs: number; views: number; students: number }[];
  loading: boolean;
}) {
  const maxMs = subjects.reduce((m, s) => Math.max(m, s.watchMs), 0);
  const TONES = [
    "from-indigo-500 to-indigo-600",
    "from-violet-500 to-violet-600",
    "from-emerald-500 to-emerald-600",
    "from-amber-400 to-amber-500",
    "from-rose-500 to-rose-600",
  ];

  if (loading) {
    return (
      <div className="card p-5">
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-9 animate-pulse rounded-lg bg-slate-100" />
          ))}
        </div>
      </div>
    );
  }

  if (subjects.length === 0) {
    return (
      <div className="card flex h-[140px] items-center justify-center p-5 text-center text-sm text-slate-400">
        No subject video activity for this school in the selected period.
      </div>
    );
  }

  return (
    <div className="card p-4 sm:p-5">
      <ul className="space-y-2.5">
        {subjects.map((s, i) => {
          const hours = s.watchMs / 3_600_000;
          const pct = maxMs > 0 ? Math.max(4, (s.watchMs / maxMs) * 100) : 0;
          return (
            <li
              key={s.subject}
              className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-slate-100 px-3 py-2.5"
            >
              <span
                className={
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-[12px] font-bold text-white " +
                  TONES[i % TONES.length]
                }
              >
                {i + 1}
              </span>
              <div className="min-w-0">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-[13px] font-semibold text-slate-900">
                    {s.subject}
                  </span>
                  <span className="num shrink-0 text-[11px] text-slate-500">
                    {formatNumber(s.views)} views · {formatNumber(s.students)} students
                  </span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={"h-full rounded-full bg-gradient-to-r " + TONES[i % TONES.length]}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
              <span className="num shrink-0 text-right text-[13px] font-bold text-slate-800">
                {hours >= 10 ? hours.toFixed(0) : hours.toFixed(1)}
                <span className="ml-0.5 text-[10.5px] font-medium text-slate-400">
                  hrs
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function UsersIcon() {
  return (
    <svg
      width="20"
      height="20"
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
function McqIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="m7 10 2 2 3-3" />
      <path d="M14 11h4" />
      <path d="M7 16h11" />
    </svg>
  );
}
function PlayIcon() {
  return (
    <svg
      width="20"
      height="20"
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
      width="20"
      height="20"
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
      width="20"
      height="20"
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



