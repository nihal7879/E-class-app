import { useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useCourseDetail, useCourseSchools, useCourseSubjects } from "@/lib/hooks";
import {
  courseFromId,
  formatCourseLabel,
  formatHours,
  formatNumber,
  naturalCompare,
  schoolId as toSchoolId,
} from "@/lib/parse";
import SectionHeader from "@/components/ui/SectionHeader";
import {
  KpiStripSkeleton,
  PageHeroSkeleton,
  TableSkeleton,
} from "@/components/ui/Skeleton";
import ErrorState from "@/components/ui/ErrorState";

interface CourseOverviewSubject {
  subject: string;
  students: number;
  chapters: number;
  videoViews: number;
  videoDurationMs: number;
  mcqAttempts: number;
  avgMcqPercentage: number;
}
interface CourseOverviewSchool {
  school: string;
  students: number;
  videoViews: number;
  videoDurationMs: number;
  mcqAttempts: number;
  avgMcqPercentage: number;
}

type SubjectSortKey =
  | "subject"
  | "students"
  | "chapters"
  | "videoViews"
  | "videoDurationMs"
  | "mcqAttempts"
  | "avgMcqPercentage";

type SchoolSortKey =
  | "school"
  | "students"
  | "videoViews"
  | "videoDurationMs"
  | "mcqAttempts"
  | "avgMcqPercentage";

function colorForPct(pct: number): string {
  if (pct >= 80) return "#16a34a";
  if (pct >= 60) return "#65a30d";
  if (pct >= 40) return "#d97706";
  if (pct >= 20) return "#ea580c";
  return "#dc2626";
}

type FocusMode = "video" | "mcq" | "all";

export default function CourseOverviewPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const course = courseId ? courseFromId(courseId) : "";
  const [searchParams] = useSearchParams();
  const fromParam = searchParams.get("from");
  const focus: FocusMode =
    fromParam === "video" ? "video" : fromParam === "mcq" ? "mcq" : "all";
  const showVideo = focus !== "mcq";
  const showMcq = focus !== "video";

  const detailApi = useCourseDetail(course || undefined);
  const subjectsApi = useCourseSubjects(course || undefined);
  const schoolsApi = useCourseSchools(course || undefined);

  const data = useMemo(() => {
    const d = detailApi.data;
    if (!d) return null;
    return {
      totalSchools:    d.schools,
      totalStudents:   d.uniqueStudents,
      totalSubjects:   d.subjects,
      videoViews:      d.videoViews,
      videoDurationMs: d.videoWatchMs,
      mcqAttempts:     d.mcqAttempts,
      avgMcqPercentage: d.avgPercentage,
    };
  }, [detailApi.data]);

  const subjects: CourseOverviewSubject[] = useMemo(
    () =>
      (subjectsApi.data?.items ?? []).map((s) => ({
        subject: s.subject,
        students: s.students,
        chapters: s.chapters,
        videoViews: s.videoViews,
        videoDurationMs: s.videoWatchMs,
        mcqAttempts: s.mcqAttempts,
        avgMcqPercentage: s.avgPercentage,
      })),
    [subjectsApi.data],
  );
  const schools: CourseOverviewSchool[] = useMemo(
    () =>
      (schoolsApi.data?.items ?? []).map((s) => ({
        school: s.school,
        students: s.students,
        videoViews: s.videoViews,
        videoDurationMs: s.videoWatchMs,
        mcqAttempts: s.mcqAttempts,
        avgMcqPercentage: s.avgPercentage,
      })),
    [schoolsApi.data],
  );

  if (detailApi.error) {
    return (
      <ErrorState
        title="course details"
        error={detailApi.error}
        onRetry={detailApi.refetch}
      />
    );
  }

  if (!course || !data) {
    return (
      <div className="space-y-6 pb-12">
        <PageHeroSkeleton />
        <KpiStripSkeleton count={6} />
        <div>
          <SectionHeader
            title="Subjects in this standard"
            description="Across all schools — sorted by combined video + MCQ activity."
          />
          <TableSkeleton rows={6} columns={7} withSearch />
        </div>
        <div>
          <SectionHeader
            title="Schools using this standard"
            description="Where this standard is being consumed — click a school to drill into its students."
          />
          <TableSkeleton rows={5} columns={7} />
        </div>
      </div>
    );
  }

  const hasAny =
    data.totalSubjects > 0 || data.videoViews > 0 || data.mcqAttempts > 0;

  return (
    <div className="space-y-6 pb-12">
      <div className="card p-5">
        <div className="min-w-0">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1 text-[12px] font-medium text-slate-500 transition hover:text-accent-600"
          >
            <ArrowLeftIcon />
            Back to dashboard
          </Link>
          <div className="mt-1 text-[12px] font-medium text-slate-500">
            Standard · across all schools (respects current filter)
          </div>
          <h2 className="mt-0.5 truncate text-[22px] font-bold text-slate-900">
            {formatCourseLabel(course)}
          </h2>
        </div>
      </div>

      {!hasAny ? (
        <div className="card flex items-center justify-center p-10 text-[13px] text-slate-500">
          No activity for this standard under the current filters.
        </div>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
            <StatTile
              label="Schools"
              value={formatNumber(data.totalSchools)}
              tone="indigo"
            />
            <StatTile
              label="Students"
              value={formatNumber(data.totalStudents)}
              tone="violet"
            />
            <StatTile
              label="Subjects"
              value={formatNumber(data.totalSubjects)}
              tone="emerald"
            />
            {showVideo && (
              <StatTile
                label="Video views"
                value={formatNumber(data.videoViews)}
                tone="amber"
              />
            )}
            {showVideo && (
              <StatTile
                label="Watch time"
                value={formatHours(data.videoDurationMs)}
                tone="amber"
              />
            )}
            {showMcq && (
              <StatTile
                label="Avg MCQ"
                value={
                  data.mcqAttempts > 0
                    ? `${data.avgMcqPercentage.toFixed(0)}%`
                    : "—"
                }
                tone="rose"
                accent={
                  data.mcqAttempts > 0
                    ? colorForPct(data.avgMcqPercentage)
                    : undefined
                }
              />
            )}
            {focus === "mcq" && (
              <StatTile
                label="MCQ attempts"
                value={formatNumber(data.mcqAttempts)}
                tone="indigo"
              />
            )}
          </section>

          <div>
            <SectionHeader
              title="Subjects in this standard"
              description={
                focus === "video"
                  ? "Across all schools — sorted by video activity."
                  : focus === "mcq"
                    ? "Across all schools — sorted by MCQ activity."
                    : "Across all schools — sorted by combined video + MCQ activity."
              }
            />
            <SubjectTable subjects={subjects} focus={focus} />
          </div>

          <div>
            <SectionHeader
              title="Schools using this standard"
              description="Where this standard is being consumed — click a school to drill into its students."
            />
            <SchoolTable course={course} schools={schools} focus={focus} />
          </div>
        </>
      )}
    </div>
  );
}

// ---------- Subjects table ----------

function SubjectTable({
  subjects,
  focus,
}: {
  subjects: CourseOverviewSubject[];
  focus: FocusMode;
}) {
  const showVideo = focus !== "mcq";
  const showMcq = focus !== "video";
  // Default order: natural by subject name (1, 2, … 10, then non-numeric).
  const [sortKey, setSortKey] = useState<SubjectSortKey>("subject");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return subjects;
    return subjects.filter((s) => s.subject.toLowerCase().includes(q));
  }, [subjects, query]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      let cmp: number;
      if (sortKey === "subject") cmp = naturalCompare(String(av), String(bv));
      else if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
      else cmp = String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  if (subjects.length === 0) {
    return (
      <div className="card flex items-center justify-center p-8 text-[13px] text-slate-500">
        No subjects under this standard.
      </div>
    );
  }

  const setSort = (key: SubjectSortKey) => {
    if (key === sortKey) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(key);
      setSortDir(key === "subject" ? "asc" : "desc");
    }
  };

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-2.5">
        <div className="text-[12px] text-slate-500">
          <span className="num font-semibold text-slate-700">
            {sorted.length}
          </span>{" "}
          of{" "}
          <span className="num font-semibold text-slate-700">
            {subjects.length}
          </span>{" "}
          subjects
        </div>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search subject"
          className="w-full max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12.5px] outline-none transition focus:border-accent-400 focus:ring-2 focus:ring-accent-100"
        />
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-[12.5px]">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <Th
                label="Subject"
                active={sortKey === "subject"}
                dir={sortDir}
                onClick={() => setSort("subject")}
                align="left"
              />
              <Th
                label="Students"
                active={sortKey === "students"}
                dir={sortDir}
                onClick={() => setSort("students")}
              />
              <Th
                label="Chapters"
                active={sortKey === "chapters"}
                dir={sortDir}
                onClick={() => setSort("chapters")}
              />
              {showVideo && (
                <Th
                  label="Video views"
                  active={sortKey === "videoViews"}
                  dir={sortDir}
                  onClick={() => setSort("videoViews")}
                />
              )}
              {showVideo && (
                <Th
                  label="Watch time"
                  active={sortKey === "videoDurationMs"}
                  dir={sortDir}
                  onClick={() => setSort("videoDurationMs")}
                />
              )}
              {showMcq && (
                <Th
                  label="MCQ attempts"
                  active={sortKey === "mcqAttempts"}
                  dir={sortDir}
                  onClick={() => setSort("mcqAttempts")}
                />
              )}
              {showMcq && (
                <Th
                  label="Avg score"
                  active={sortKey === "avgMcqPercentage"}
                  dir={sortDir}
                  onClick={() => setSort("avgMcqPercentage")}
                />
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.map((s) => (
              <tr key={s.subject} className="hover:bg-slate-50/60">
                <td className="px-4 py-2.5 font-medium text-slate-900">
                  {s.subject}
                </td>
                <NumCell value={formatNumber(s.students)} />
                <NumCell value={formatNumber(s.chapters)} />
                {showVideo && <NumCell value={formatNumber(s.videoViews)} />}
                {showVideo && <NumCell value={formatHours(s.videoDurationMs)} />}
                {showMcq && <NumCell value={formatNumber(s.mcqAttempts)} />}
                {showMcq && (
                  <td
                    className="num px-4 py-2.5 text-right font-semibold"
                    style={{
                      color:
                        s.mcqAttempts > 0
                          ? colorForPct(s.avgMcqPercentage)
                          : "#94a3b8",
                    }}
                  >
                    {s.mcqAttempts > 0
                      ? `${s.avgMcqPercentage.toFixed(0)}%`
                      : "—"}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------- Schools table ----------

function SchoolTable({
  course,
  schools,
  focus,
}: {
  course: string;
  schools: CourseOverviewSchool[];
  focus: FocusMode;
}) {
  const showVideo = focus !== "mcq";
  const showMcq = focus !== "video";
  const [sortKey, setSortKey] = useState<SchoolSortKey>(
    focus === "mcq" ? "mcqAttempts" : "videoDurationMs",
  );
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const sorted = useMemo(() => {
    const arr = [...schools];
    arr.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      let cmp: number;
      if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
      else cmp = String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [schools, sortKey, sortDir]);

  if (schools.length === 0) {
    return (
      <div className="card flex items-center justify-center p-8 text-[13px] text-slate-500">
        No schools using this standard.
      </div>
    );
  }

  const setSort = (key: SchoolSortKey) => {
    if (key === sortKey) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(key);
      setSortDir(key === "school" ? "asc" : "desc");
    }
  };

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full text-[12.5px]">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <Th
                label="School"
                active={sortKey === "school"}
                dir={sortDir}
                onClick={() => setSort("school")}
                align="left"
              />
              <Th
                label="Students"
                active={sortKey === "students"}
                dir={sortDir}
                onClick={() => setSort("students")}
              />
              {showVideo && (
                <Th
                  label="Video views"
                  active={sortKey === "videoViews"}
                  dir={sortDir}
                  onClick={() => setSort("videoViews")}
                />
              )}
              {showVideo && (
                <Th
                  label="Watch time"
                  active={sortKey === "videoDurationMs"}
                  dir={sortDir}
                  onClick={() => setSort("videoDurationMs")}
                />
              )}
              {showMcq && (
                <Th
                  label="MCQ attempts"
                  active={sortKey === "mcqAttempts"}
                  dir={sortDir}
                  onClick={() => setSort("mcqAttempts")}
                />
              )}
              {showMcq && (
                <Th
                  label="Avg score"
                  active={sortKey === "avgMcqPercentage"}
                  dir={sortDir}
                  onClick={() => setSort("avgMcqPercentage")}
                />
              )}
              <th className="px-4 py-2.5 text-right">{" "}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.map((s) => (
              <tr key={s.school} className="hover:bg-slate-50/60">
                <td className="px-4 py-2.5 font-medium text-slate-900">
                  {s.school}
                </td>
                <NumCell value={formatNumber(s.students)} />
                {showVideo && <NumCell value={formatNumber(s.videoViews)} />}
                {showVideo && <NumCell value={formatHours(s.videoDurationMs)} />}
                {showMcq && <NumCell value={formatNumber(s.mcqAttempts)} />}
                {showMcq && (
                  <td
                    className="num px-4 py-2.5 text-right font-semibold"
                    style={{
                      color:
                        s.mcqAttempts > 0
                          ? colorForPct(s.avgMcqPercentage)
                          : "#94a3b8",
                    }}
                  >
                    {s.mcqAttempts > 0
                      ? `${s.avgMcqPercentage.toFixed(0)}%`
                      : "—"}
                  </td>
                )}
                <td className="px-4 py-2.5 text-right">
                  <Link
                    to={`/school/${toSchoolId(s.school)}/course/${encodeURIComponent(course)}`}
                    className="inline-flex items-center gap-1 text-[12px] font-medium text-accent-600 transition hover:text-accent-700"
                  >
                    Open
                    <ArrowRightIcon />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------- shared ----------

const TONE_BG: Record<string, string> = {
  indigo: "bg-indigo-50 text-indigo-700 ring-indigo-100",
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  violet: "bg-violet-50 text-violet-700 ring-violet-100",
  amber: "bg-amber-50 text-amber-700 ring-amber-100",
  rose: "bg-rose-50 text-rose-700 ring-rose-100",
};

function StatTile({
  label,
  value,
  tone,
  accent,
}: {
  label: string;
  value: string;
  tone: keyof typeof TONE_BG;
  accent?: string;
}) {
  return (
    <div className="card flex flex-col gap-1 p-4">
      <span
        className={
          "inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-wide ring-1 " +
          (TONE_BG[tone] || "bg-slate-50 text-slate-700 ring-slate-100")
        }
      >
        {label}
      </span>
      <div
        className="num mt-1 text-[22px] font-bold"
        style={{ color: accent || "#0f172a" }}
      >
        {value}
      </div>
    </div>
  );
}

function Th({
  label,
  active,
  dir,
  onClick,
  align = "right",
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
  align?: "left" | "right";
}) {
  return (
    <th
      onClick={onClick}
      className={
        "cursor-pointer select-none whitespace-nowrap px-4 py-2.5 font-medium transition hover:text-slate-700 " +
        (align === "left" ? "text-left" : "text-right") +
        (active ? " text-slate-800" : "")
      }
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active && (
          <span className="text-[9px]">{dir === "asc" ? "▲" : "▼"}</span>
        )}
      </span>
    </th>
  );
}

function NumCell({ value }: { value: string }) {
  return <td className="num px-4 py-2.5 text-right text-slate-800">{value}</td>;
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
