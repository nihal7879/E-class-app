import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import clsx from "clsx";
import { computeVideoUsageOverview } from "@/lib/aggregations";
import { useFilter } from "@/lib/filterContext";
import {
  courseId as toCourseId,
  formatCourseLabel,
  formatHours,
  formatNumber,
} from "@/lib/parse";
import ChartCard from "./ChartCard";
import { CHART_PALETTE } from "./theme";

const TOP_N_DEFAULT = 6;

export default function VideoUsageCard() {
  const { filter } = useFilter();
  const navigate = useNavigate();
  const overview = useMemo(() => computeVideoUsageOverview(filter), [filter]);
  const [showAll, setShowAll] = useState(false);

  const hasData = overview.totalViews > 0;
  const visibleCourses = useMemo(
    () =>
      showAll
        ? overview.courses
        : overview.courses.slice(0, TOP_N_DEFAULT),
    [overview.courses, showAll],
  );
  const subjectPalette = useSubjectPalette(
    visibleCourses.flatMap((c) => c.subjects.map((s) => s.subject)),
  );
  const maxCourseMs = visibleCourses.reduce(
    (m, c) => Math.max(m, c.durationMs),
    0,
  );

  const openCourse = (course: string) =>
    navigate(`/course/${toCourseId(course)}`);

  const showToggle = overview.courses.length > TOP_N_DEFAULT;

  return (
    <ChartCard
      title="Video usage by standard"
      subtitle="Watch time per standard, broken down by the subjects inside it."
      right={
        showToggle ? (
          <div className="flex items-center gap-1 rounded-full bg-slate-100 p-1 text-xs">
            <button
              onClick={() => setShowAll(false)}
              className={clsx(
                "rounded-full px-3 py-1 font-medium transition",
                !showAll
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700",
              )}
            >
              Top {TOP_N_DEFAULT}
            </button>
            <button
              onClick={() => setShowAll(true)}
              className={clsx(
                "rounded-full px-3 py-1 font-medium transition",
                showAll
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700",
              )}
            >
              All {overview.courses.length}
            </button>
          </div>
        ) : undefined
      }
    >
      {!hasData ? (
        <Empty />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat
              label="Watch time"
              value={formatHours(overview.totalDurationMs)}
              tone="amber"
            />
            <Stat
              label="Video views"
              value={formatNumber(overview.totalViews)}
              tone="indigo"
            />
            <Stat
              label="Students"
              value={formatNumber(overview.uniqueStudents)}
              tone="violet"
            />
            <Stat
              label="Content items"
              value={formatNumber(overview.uniqueContent)}
              tone="emerald"
            />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {showAll
                  ? `All standards · watch time, split by subject`
                  : `Top standards · watch time, split by subject`}
              </div>
              <div className="text-[10.5px] text-slate-400">click a row for all data</div>
            </div>
            <ul className="space-y-2.5">
              {visibleCourses.map((c) => (
                <CourseRow
                  key={c.course}
                  course={c}
                  maxMs={maxCourseMs}
                  subjectPalette={subjectPalette}
                  onOpen={() => openCourse(c.course)}
                />
              ))}
            </ul>
          </div>

          <ContentTypeMix mix={overview.contentTypeMix} />
        </div>
      )}
    </ChartCard>
  );
}

interface CourseRowProps {
  course: import("@/lib/aggregations").VideoCourseBreakdown;
  maxMs: number;
  subjectPalette: Map<string, string>;
  onOpen: () => void;
}

function CourseRow({ course, maxMs, subjectPalette, onOpen }: CourseRowProps) {
  const [hoverSubj, setHoverSubj] = useState<string | null>(null);
  const widthPct = maxMs > 0 ? (course.durationMs / maxMs) * 100 : 0;
  const TOP_SUBJ = 5;
  const top = course.subjects.slice(0, TOP_SUBJ);
  const rest = course.subjects.slice(TOP_SUBJ);
  const restMs = rest.reduce((a, s) => a + s.durationMs, 0);
  const segments = [
    ...top.map((s) => ({
      key: s.subject,
      label: s.subject,
      durationMs: s.durationMs,
      views: s.views,
      color: subjectPalette.get(s.subject) || "#94a3b8",
    })),
    ...(restMs > 0
      ? [
          {
            key: "__other__",
            label: `Other (${rest.length})`,
            durationMs: restMs,
            views: rest.reduce((a, s) => a + s.views, 0),
            color: "#cbd5e1",
          },
        ]
      : []),
  ];

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="group block w-full rounded-lg px-2 py-1.5 text-left transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-200"
      >
        <div className="flex items-baseline justify-between gap-3">
          <div className="min-w-0 truncate text-[12.5px] font-semibold text-slate-900 group-hover:text-accent-700">
            {formatCourseLabel(course.course)}
          </div>
          <div className="shrink-0 text-[11px] text-slate-500">
            <span className="num font-semibold text-slate-700">
              {formatHours(course.durationMs)}
            </span>{" "}
            · <span className="num">{formatNumber(course.views)}</span> views ·{" "}
            <span className="num">{formatNumber(course.students)}</span> students
            <ChevronRight />
          </div>
        </div>
        <div
          className="mt-1.5 flex h-3 overflow-hidden rounded-full bg-slate-100"
          style={{ width: `${Math.max(widthPct, 3)}%`, minWidth: 48 }}
          onMouseLeave={() => setHoverSubj(null)}
        >
          {segments.map((seg) => {
            const pct = course.durationMs > 0 ? (seg.durationMs / course.durationMs) * 100 : 0;
            const dim = hoverSubj && hoverSubj !== seg.key;
            return (
              <div
                key={seg.key}
                onMouseEnter={(e) => {
                  e.stopPropagation();
                  setHoverSubj(seg.key);
                }}
                style={{
                  width: `${pct}%`,
                  background: seg.color,
                  opacity: dim ? 0.25 : 1,
                }}
                className="h-full transition-opacity"
                title={`${seg.label}: ${formatHours(seg.durationMs)} (${formatNumber(seg.views)} views)`}
              />
            );
          })}
        </div>
        <div className="mt-1 flex flex-wrap gap-x-2.5 gap-y-0.5 text-[10.5px]">
          {segments.map((seg) => {
            const dim = hoverSubj && hoverSubj !== seg.key;
            return (
              <span
                key={seg.key}
                onMouseEnter={(e) => {
                  e.stopPropagation();
                  setHoverSubj(seg.key);
                }}
                onMouseLeave={() => setHoverSubj(null)}
                className={
                  "inline-flex items-center gap-1 transition" +
                  (dim ? " opacity-40" : "")
                }
              >
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ background: seg.color }}
                />
                <span className="text-slate-600">{seg.label}</span>
                <span className="num font-semibold text-slate-800">
                  {formatHours(seg.durationMs)}
                </span>
              </span>
            );
          })}
        </div>
      </button>
    </li>
  );
}

function ChevronRight() {
  return (
    <svg
      className="ml-1 inline-block opacity-0 transition group-hover:opacity-100"
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="9 6 15 12 9 18" />
    </svg>
  );
}

function useSubjectPalette(subjects: string[]): Map<string, string> {
  return useMemo(() => {
    const map = new Map<string, string>();
    const unique = Array.from(new Set(subjects));
    unique.forEach((s, i) => map.set(s, CHART_PALETTE[i % CHART_PALETTE.length]));
    return map;
  }, [subjects.join("|")]);
}

function ContentTypeMix({
  mix,
}: {
  mix: { type: string; views: number; durationMs: number }[];
}) {
  const total = mix.reduce((a, m) => a + m.views, 0);
  if (total === 0) return null;
  const shown = mix.slice(0, 5);
  return (
    <div>
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        Content type mix
      </div>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
        {shown.map((m, i) => {
          const pct = (m.views / total) * 100;
          if (pct <= 0) return null;
          return (
            <div
              key={m.type}
              style={{ width: `${pct}%`, background: CHART_PALETTE[i] }}
              className="h-full"
              title={`${m.type}: ${formatNumber(m.views)} views`}
            />
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
        {shown.map((m, i) => {
          const pct = (m.views / total) * 100;
          return (
            <span key={m.type} className="inline-flex items-center gap-1.5">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: CHART_PALETTE[i] }}
              />
              <span className="text-slate-700">{m.type}</span>
              <span className="num text-slate-500">{pct.toFixed(0)}%</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

const STAT_TONES: Record<string, string> = {
  amber: "bg-amber-50 text-amber-700 ring-amber-100",
  indigo: "bg-indigo-50 text-indigo-700 ring-indigo-100",
  violet: "bg-violet-50 text-violet-700 ring-violet-100",
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
};

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: keyof typeof STAT_TONES;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-2.5">
      <span
        className={
          "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ring-1 " +
          STAT_TONES[tone]
        }
      >
        {label}
      </span>
      <div className="num mt-1.5 text-[18px] font-bold leading-none text-slate-900">
        {value}
      </div>
    </div>
  );
}

function Empty() {
  return (
    <div className="flex h-[300px] flex-col items-center justify-center text-center text-slate-400">
      <div className="text-sm font-medium text-slate-600">No video activity</div>
      <div className="text-xs">Adjust the filter to see watch time analytics.</div>
    </div>
  );
}
