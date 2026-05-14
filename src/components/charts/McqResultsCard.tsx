import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { computeMcqOverview } from "@/lib/aggregations";
import { useFilter } from "@/lib/filterContext";
import { formatCourseLabel, formatNumber } from "@/lib/parse";
import ChartCard from "./ChartCard";
import { CustomTooltip } from "./Tooltip";
import { AXIS_COLOR, AXIS_TICK_STYLE, GRID_COLOR, GRID_DASH } from "./theme";

// Red (low) -> green (high) accuracy scale.
function colorForPct(pct: number): string {
  if (pct >= 80) return "#16a34a"; // green-600
  if (pct >= 60) return "#65a30d"; // lime-600
  if (pct >= 40) return "#d97706"; // amber-600
  if (pct >= 20) return "#ea580c"; // orange-600
  return "#dc2626"; // red-600
}

function formatTime(ms: number): string {
  if (ms <= 0) return "0s";
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(0)}s`;
  const m = s / 60;
  if (m < 60) return `${m.toFixed(1)}m`;
  return `${(m / 60).toFixed(1)}h`;
}

export default function McqResultsCard() {
  const { filter } = useFilter();
  const overview = useMemo(() => computeMcqOverview(filter), [filter]);

  const hasData = overview.totalAttempts > 0;

  return (
    <ChartCard
      title="MCQ results by standard"
      subtitle="Accuracy and attempts per standard, with per-subject breakdown."
    >
      {!hasData ? (
        <Empty />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat
              label="Avg score"
              value={`${overview.avgPercentage.toFixed(0)}%`}
              tone="rose"
              accent={colorForPct(overview.avgPercentage)}
            />
            <Stat
              label="Attempts"
              value={formatNumber(overview.totalAttempts)}
              tone="indigo"
            />
            <Stat
              label="Students"
              value={formatNumber(overview.uniqueStudents)}
              tone="violet"
            />
            <Stat
              label="Avg time"
              value={formatTime(overview.avgTimeSpentMs)}
              tone="emerald"
            />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Accuracy by standard · expand for subjects
              </div>
              <div className="text-[10.5px] text-slate-400">click to drill in</div>
            </div>
            <ul className="space-y-1.5">
              {overview.topCourses.map((c) => (
                <CourseAccuracyRow key={c.course} course={c} />
              ))}
            </ul>
          </div>

          <div>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Score distribution (all attempts)
            </div>
            <div className="h-[140px]">
              <ResponsiveContainer>
                <BarChart
                  data={overview.scoreDistribution}
                  margin={{ top: 4, right: 8, bottom: 4, left: -16 }}
                >
                  <CartesianGrid
                    stroke={GRID_COLOR}
                    strokeDasharray={GRID_DASH}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="bucket"
                    tick={AXIS_TICK_STYLE}
                    stroke={AXIS_COLOR}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={AXIS_TICK_STYLE}
                    stroke={AXIS_COLOR}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                    width={32}
                  />
                  <Tooltip
                    cursor={{ fill: "#f1f5f9" }}
                    content={
                      <CustomTooltip
                        formatter={(v) => `${formatNumber(Number(v))} attempts`}
                      />
                    }
                  />
                  <Bar
                    dataKey="count"
                    name="Attempts"
                    radius={[4, 4, 0, 0]}
                    isAnimationActive
                    animationDuration={500}
                  >
                    {overview.scoreDistribution.map((b) => {
                      const mid = bucketMid(b.bucket);
                      return <Cell key={b.bucket} fill={colorForPct(mid)} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </ChartCard>
  );
}

function CourseAccuracyRow({
  course,
}: {
  course: import("@/lib/aggregations").McqCourseBreakdown;
}) {
  const [open, setOpen] = useState(false);
  const courseColor = colorForPct(course.avgPercentage);

  return (
    <li className="rounded-lg border border-slate-100">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-2 text-left transition hover:bg-slate-50"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <span className="truncate text-[12.5px] font-semibold text-slate-900">
              {formatCourseLabel(course.course)}
            </span>
            <span className="num shrink-0 text-[11px] text-slate-500">
              <span className="num">{formatNumber(course.attempts)}</span>{" "}
              attempts ·{" "}
              <span className="num">{formatNumber(course.students)}</span>{" "}
              students
            </span>
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${course.avgPercentage}%`,
                  background: courseColor,
                }}
              />
            </div>
            <span
              className="num shrink-0 text-[12.5px] font-bold"
              style={{ color: courseColor }}
            >
              {course.avgPercentage.toFixed(0)}%
            </span>
          </div>
        </div>
        <span
          className="text-[10px] text-slate-400 transition"
          style={{ transform: open ? "rotate(180deg)" : "none" }}
        >
          ▼
        </span>
      </button>

      {open && course.subjects.length > 0 && (
        <div className="border-t border-slate-100 bg-slate-50/60 px-3 py-2">
          <ul className="space-y-1.5">
            {course.subjects.slice(0, 8).map((s) => {
              const subColor = colorForPct(s.avgPercentage);
              return (
                <li key={s.subject} className="flex items-center gap-2">
                  <div className="min-w-0 flex-1 truncate text-[11.5px] text-slate-700">
                    {s.subject}
                  </div>
                  <div className="h-1.5 w-[35%] overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${s.avgPercentage}%`,
                        background: subColor,
                      }}
                    />
                  </div>
                  <span
                    className="num w-9 shrink-0 text-right text-[11.5px] font-semibold"
                    style={{ color: subColor }}
                  >
                    {s.avgPercentage.toFixed(0)}%
                  </span>
                  <span className="num w-12 shrink-0 text-right text-[10.5px] text-slate-500">
                    {formatNumber(s.attempts)}
                  </span>
                </li>
              );
            })}
          </ul>
          {course.subjects.length > 8 && (
            <div className="mt-1.5 text-[10.5px] text-slate-400">
              + {course.subjects.length - 8} more subjects
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function bucketMid(bucket: string): number {
  const m = bucket.match(/(\d+)\D+(\d+)/);
  if (!m) return 0;
  return (Number(m[1]) + Number(m[2])) / 2;
}

const STAT_TONES: Record<string, string> = {
  rose: "bg-rose-50 text-rose-700 ring-rose-100",
  indigo: "bg-indigo-50 text-indigo-700 ring-indigo-100",
  violet: "bg-violet-50 text-violet-700 ring-violet-100",
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
};

function Stat({
  label,
  value,
  tone,
  accent,
}: {
  label: string;
  value: string;
  tone: keyof typeof STAT_TONES;
  accent?: string;
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
      <div
        className="num mt-1.5 text-[18px] font-bold leading-none"
        style={{ color: accent || "#0f172a" }}
      >
        {value}
      </div>
    </div>
  );
}

function Empty() {
  return (
    <div className="flex h-[300px] flex-col items-center justify-center text-center text-slate-400">
      <div className="text-sm font-medium text-slate-600">No MCQ attempts</div>
      <div className="text-xs">Adjust the filter to see quiz analytics.</div>
    </div>
  );
}
