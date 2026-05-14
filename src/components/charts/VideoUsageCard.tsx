import { useMemo, useState } from "react";
import { computeVideoUsageOverview } from "@/lib/aggregations";
import { useFilter } from "@/lib/filterContext";
import { formatCourseLabel, formatHours, formatNumber } from "@/lib/parse";
import ChartCard from "./ChartCard";
import { CHART_PALETTE } from "./theme";

export default function VideoUsageCard() {
  const { filter } = useFilter();
  const overview = useMemo(() => computeVideoUsageOverview(filter), [filter]);

  const hasData = overview.totalViews > 0;
  const subjectPalette = useSubjectPalette(
    overview.topCourses.flatMap((c) => c.subjects.map((s) => s.subject)),
  );
  const maxCourseMs = overview.topCourses.reduce(
    (m, c) => Math.max(m, c.durationMs),
    0,
  );

  return (
    <ChartCard
      title="Video usage by standard"
      subtitle="Watch time per standard, broken down by the subjects inside it."
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
                Top standards · watch time, split by subject
              </div>
              <div className="text-[10.5px] text-slate-400">hover for details</div>
            </div>
            <ul className="space-y-2.5">
              {overview.topCourses.map((c) => (
                <CourseRow
                  key={c.course}
                  course={c}
                  maxMs={maxCourseMs}
                  subjectPalette={subjectPalette}
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
}

function CourseRow({ course, maxMs, subjectPalette }: CourseRowProps) {
  const [hoverSubj, setHoverSubj] = useState<string | null>(null);
  const widthPct = maxMs > 0 ? (course.durationMs / maxMs) * 100 : 0;
  // Up to 5 subject segments per row + "Other".
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
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0 truncate text-[12.5px] font-semibold text-slate-900">
          {formatCourseLabel(course.course)}
        </div>
        <div className="shrink-0 text-[11px] text-slate-500">
          <span className="num font-semibold text-slate-700">
            {formatHours(course.durationMs)}
          </span>{" "}
          · <span className="num">{formatNumber(course.views)}</span> views ·{" "}
          <span className="num">{formatNumber(course.students)}</span> students
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
              onMouseEnter={() => setHoverSubj(seg.key)}
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
              onMouseEnter={() => setHoverSubj(seg.key)}
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
    </li>
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
