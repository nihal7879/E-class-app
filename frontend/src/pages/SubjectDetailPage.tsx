import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  computeSubjectDetail,
  type SubjectChapterStat,
  type SubjectStudentStat,
} from "@/lib/aggregations";
import { useFilter } from "@/lib/filterContext";
import {
  courseFromId,
  courseId as toCourseId,
  formatCourseLabel,
  formatHours,
  formatNumber,
  schoolFromId,
  schoolId as toSchoolId,
  subjectFromId,
} from "@/lib/parse";
import SectionHeader from "@/components/ui/SectionHeader";

type StudentSortKey =
  | "studentName"
  | "division"
  | "videoViews"
  | "videoDurationMs"
  | "chaptersTouched"
  | "mcqAttempts";

type ChapterSortKey =
  | "chapter"
  | "students"
  | "videoViews"
  | "videoDurationMs"
  | "contentItems"
  | "mcqAttempts";

export default function SubjectDetailPage() {
  const {
    schoolId: sId,
    courseId: cId,
    subjectId: subId,
  } = useParams<{ schoolId: string; courseId: string; subjectId: string }>();
  const school = sId ? schoolFromId(sId) : "";
  const course = cId ? courseFromId(cId) : "";
  const subject = subId ? subjectFromId(subId) : "";
  const { filter, setFilter } = useFilter();

  useEffect(() => {
    if (!school) return;
    setFilter((f) =>
      f.schools.length === 1 && f.schools[0] === school
        ? f
        : { ...f, schools: [school] },
    );
  }, [school, setFilter]);

  const detail = useMemo(
    () =>
      school && course && subject
        ? computeSubjectDetail(school, course, subject, filter)
        : null,
    [school, course, subject, filter],
  );

  const subjectsHref =
    school && course
      ? `/school/${toSchoolId(school)}/course/${toCourseId(course)}`
      : "/dashboard";

  return (
    <div className="space-y-6 pb-12">
      <div className="card p-5">
        <div className="min-w-0">
          <Link
            to={subjectsHref}
            className="inline-flex items-center gap-1 text-[12px] font-medium text-slate-500 transition hover:text-accent-600"
          >
            <ArrowLeftIcon />
            Back to subjects
          </Link>
          <div className="mt-1 text-[12px] font-medium text-slate-500">
            {school || "Unknown school"} ·{" "}
            {course ? formatCourseLabel(course) : "Unknown course"} · Subject
          </div>
          <h2 className="mt-0.5 truncate text-[22px] font-bold text-slate-900">
            {subject || "Unknown"}
          </h2>
        </div>
      </div>

      {!detail ||
      (detail.totalStudents === 0 && detail.totalChapters === 0) ? (
        <div className="card flex items-center justify-center p-10 text-[13px] text-slate-500">
          No activity for this subject under the current filters.
        </div>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
            <StatTile
              label="Students"
              value={formatNumber(detail.totalStudents)}
              tone="indigo"
            />
            <StatTile
              label="Chapters"
              value={formatNumber(detail.totalChapters)}
              tone="emerald"
            />
            <StatTile
              label="Video views"
              value={formatNumber(detail.videoViews)}
              tone="violet"
            />
            <StatTile
              label="Watch time"
              value={formatHours(detail.videoDurationMs)}
              tone="amber"
            />
            <StatTile
              label="MCQ attempts"
              value={formatNumber(detail.mcqAttempts)}
              tone="rose"
            />
          </section>

          <div>
            <SectionHeader
              title="Chapters"
              description="Activity grouped by chapter within this subject."
            />
            <ChapterTable chapters={detail.chapters} />
          </div>

          <div>
            <SectionHeader
              title="Students"
              description="Per-student activity on this subject."
            />
            <StudentTable students={detail.students} />
          </div>
        </>
      )}
    </div>
  );
}

// ---------- KPI tiles ----------

const TONE_BG: Record<string, string> = {
  indigo: "bg-indigo-50 text-indigo-700 ring-indigo-100",
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  violet: "bg-violet-50 text-violet-700 ring-violet-100",
  amber: "bg-amber-50 text-amber-700 ring-amber-100",
  rose: "bg-rose-50 text-rose-700 ring-rose-100",
  sky: "bg-sky-50 text-sky-700 ring-sky-100",
};

function StatTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: keyof typeof TONE_BG | string;
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
      <div className="num mt-1 text-[22px] font-bold text-slate-900">
        {value}
      </div>
    </div>
  );
}

// ---------- Chapter table ----------

function ChapterTable({ chapters }: { chapters: SubjectChapterStat[] }) {
  const [sortKey, setSortKey] = useState<ChapterSortKey>("videoDurationMs");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const sorted = useMemo(() => {
    const arr = [...chapters];
    arr.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      let cmp: number;
      if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
      else cmp = String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [chapters, sortKey, sortDir]);

  if (chapters.length === 0) {
    return (
      <div className="card flex items-center justify-center p-10 text-[13px] text-slate-500">
        No chapter data for this subject.
      </div>
    );
  }

  const setSort = (key: ChapterSortKey) => {
    if (key === sortKey) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(
        key === "chapter" ? "asc" : "desc",
      );
    }
  };

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full text-[12.5px]">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <Th
                label="Chapter"
                active={sortKey === "chapter"}
                dir={sortDir}
                onClick={() => setSort("chapter")}
                align="left"
              />
              <Th
                label="Students"
                active={sortKey === "students"}
                dir={sortDir}
                onClick={() => setSort("students")}
              />
              <Th
                label="Content items"
                active={sortKey === "contentItems"}
                dir={sortDir}
                onClick={() => setSort("contentItems")}
              />
              <Th
                label="Video views"
                active={sortKey === "videoViews"}
                dir={sortDir}
                onClick={() => setSort("videoViews")}
              />
              <Th
                label="Watch time"
                active={sortKey === "videoDurationMs"}
                dir={sortDir}
                onClick={() => setSort("videoDurationMs")}
              />
              <Th
                label="MCQ attempts"
                active={sortKey === "mcqAttempts"}
                dir={sortDir}
                onClick={() => setSort("mcqAttempts")}
              />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.map((c) => (
              <tr key={c.chapter} className="hover:bg-slate-50/60">
                <td className="px-4 py-2.5 font-medium text-slate-900">
                  {c.chapter}
                </td>
                <NumCell value={formatNumber(c.students)} />
                <NumCell value={formatNumber(c.contentItems)} />
                <NumCell value={formatNumber(c.videoViews)} />
                <NumCell value={formatHours(c.videoDurationMs)} />
                <NumCell value={formatNumber(c.mcqAttempts)} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------- Student table ----------

function StudentTable({ students }: { students: SubjectStudentStat[] }) {
  const [sortKey, setSortKey] = useState<StudentSortKey>("videoDurationMs");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        s.studentName.toLowerCase().includes(q) ||
        s.enrollmentId.toLowerCase().includes(q) ||
        s.division.toLowerCase().includes(q),
    );
  }, [students, query]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      let cmp: number;
      if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
      else cmp = String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  if (students.length === 0) {
    return (
      <div className="card flex items-center justify-center p-10 text-[13px] text-slate-500">
        No students for this subject.
      </div>
    );
  }

  const setSort = (key: StudentSortKey) => {
    if (key === sortKey) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(
        key === "studentName" || key === "division" ? "asc" : "desc",
      );
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
            {students.length}
          </span>{" "}
          students
        </div>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search student, enrollment, division"
          className="w-full max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12.5px] outline-none transition focus:border-accent-400 focus:ring-2 focus:ring-accent-100"
        />
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-[12.5px]">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <Th
                label="Student"
                active={sortKey === "studentName"}
                dir={sortDir}
                onClick={() => setSort("studentName")}
                align="left"
              />
              <Th
                label="Division"
                active={sortKey === "division"}
                dir={sortDir}
                onClick={() => setSort("division")}
                align="left"
              />
              <Th
                label="Chapters"
                active={sortKey === "chaptersTouched"}
                dir={sortDir}
                onClick={() => setSort("chaptersTouched")}
              />
              <Th
                label="Video views"
                active={sortKey === "videoViews"}
                dir={sortDir}
                onClick={() => setSort("videoViews")}
              />
              <Th
                label="Watch time"
                active={sortKey === "videoDurationMs"}
                dir={sortDir}
                onClick={() => setSort("videoDurationMs")}
              />
              <Th
                label="MCQ attempts"
                active={sortKey === "mcqAttempts"}
                dir={sortDir}
                onClick={() => setSort("mcqAttempts")}
              />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.map((s) => (
              <tr key={s.userId} className="hover:bg-slate-50/60">
                <td className="px-4 py-2.5">
                  <div className="font-medium text-slate-900">
                    {s.studentName || "—"}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {s.enrollmentId}
                  </div>
                </td>
                <td className="px-4 py-2.5 text-slate-700">
                  {s.division || "—"}
                </td>
                <NumCell value={formatNumber(s.chaptersTouched)} />
                <NumCell value={formatNumber(s.videoViews)} />
                <NumCell value={formatHours(s.videoDurationMs)} />
                <NumCell value={formatNumber(s.mcqAttempts)} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------- shared ----------

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
