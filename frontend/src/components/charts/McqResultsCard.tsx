import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import clsx from "clsx";
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
import {
  courseId as toCourseId,
  formatCourseLabel,
  formatNumber,
  sortCourses,
} from "@/lib/parse";
import ChartCard from "./ChartCard";
import { CustomTooltip } from "./Tooltip";
import { AXIS_COLOR, AXIS_TICK_STYLE, GRID_COLOR, GRID_DASH } from "./theme";

const TOP_N_DEFAULT = 6;

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
  const navigate = useNavigate();
  const overview = useMemo(() => computeMcqOverview(filter), [filter]);
  const [showAll, setShowAll] = useState(false);

  const hasData = overview.totalAttempts > 0;
  const visibleCourses = useMemo(() => {
    if (!showAll) return overview.courses.slice(0, TOP_N_DEFAULT);
    const order = new Map(
      sortCourses(overview.courses.map((c) => c.course)).map((c, i) => [c, i]),
    );
    return [...overview.courses].sort(
      (a, b) => (order.get(a.course)! - order.get(b.course)!),
    );
  }, [overview.courses, showAll]);
  const showToggle = overview.courses.length >= 2;
  const topLabel = Math.min(TOP_N_DEFAULT, overview.courses.length);
  const openCourse = (course: string) =>
    navigate(`/course/${toCourseId(course)}`);

  return (
    <ChartCard
      title="MCQ results by standard"
      subtitle="Accuracy and attempts per standard, with per-subject breakdown."
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
              Top {topLabel}
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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-3.5">
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
                {showAll
                  ? "All standards · ordered 1st → 10th"
                  : "Accuracy by standard · sorted by attempts"}
              </div>
              <div className="text-[10.5px] text-slate-400">click a row for all data</div>
            </div>
            <ul className="space-y-1.5">
              {visibleCourses.map((c) => (
                <CourseAccuracyRow
                  key={c.course}
                  course={c}
                  onOpen={() => openCourse(c.course)}
                />
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
  onOpen,
}: {
  course: import("@/lib/aggregations").McqCourseBreakdown;
  onOpen: () => void;
}) {
  const courseColor = colorForPct(course.avgPercentage);

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="group grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-slate-100 px-3 py-2 text-left transition hover:border-slate-200 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-200"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <span className="truncate text-[12.5px] font-semibold text-slate-900 group-hover:text-accent-700">
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
        <svg
          className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-accent-500"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="9 6 15 12 9 18" />
        </svg>
      </button>
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
    <div className="flex flex-col rounded-xl border border-slate-100 bg-white px-3 py-3 sm:px-3.5 sm:py-3.5">
      <span
        className={
          "inline-flex w-fit items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ring-1 " +
          STAT_TONES[tone]
        }
      >
        {label}
      </span>
      <div
        className="num mt-3 text-[18px] font-bold leading-none"
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
