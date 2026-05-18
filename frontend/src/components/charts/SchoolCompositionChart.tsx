import { useMemo, useState } from "react";
import clsx from "clsx";
import { computeSchoolComposition } from "@/lib/aggregations";
import { useFilter } from "@/lib/filterContext";
import { formatNumber } from "@/lib/parse";
import type { SchoolCompositionStat } from "@/lib/types";
import ChartCard from "./ChartCard";

const TOP_N_DEFAULT = 6;

type MetricKey = "logins" | "sessions" | "videoViews" | "mcqAttempts";
type ViewMetric = "all" | MetricKey;

interface MetricSpec {
  key: MetricKey;
  label: string;
  color: string;
}

const METRICS: MetricSpec[] = [
  { key: "logins", label: "Logins", color: "#4f46e5" }, // indigo-600
  { key: "sessions", label: "Sessions", color: "#0d9488" }, // teal-600
  { key: "videoViews", label: "Video usage", color: "#d97706" }, // amber-600
  { key: "mcqAttempts", label: "MCQ attempts", color: "#e11d48" }, // rose-600
];

const VIEW_OPTIONS: { key: ViewMetric; label: string }[] = [
  { key: "all", label: "All" },
  { key: "logins", label: "Logins" },
  { key: "sessions", label: "Sessions" },
  { key: "videoViews", label: "Video" },
  { key: "mcqAttempts", label: "MCQ" },
];

function formatVideoHours(ms: number): string {
  if (ms <= 0) return "0 min";
  const min = ms / 60_000;
  if (min < 60) return `${Math.round(min)} min`;
  const hr = ms / 3_600_000;
  if (hr >= 100) return `${hr.toFixed(0)} hrs`;
  return `${hr.toFixed(1)} hrs`;
}

function metricValueLabel(
  row: SchoolCompositionStat,
  metric: MetricKey,
): string {
  if (metric === "videoViews") return formatVideoHours(row.videoDurationMs);
  return formatNumber(row[metric] as number);
}

function metricRawCount(row: SchoolCompositionStat, metric: MetricKey): number {
  return row[metric] as number;
}

interface Props {
  onSchoolClick?: (school: string) => void;
}

export default function SchoolCompositionChart({ onSchoolClick }: Props) {
  const { filter } = useFilter();
  const stats = useMemo(() => computeSchoolComposition(filter), [filter]);
  const [showAll, setShowAll] = useState(false);
  const [view, setView] = useState<ViewMetric>("all");
  const [hoverMetric, setHoverMetric] = useState<MetricKey | null>(null);

  const sorted = useMemo(() => {
    if (view === "all") return stats;
    if (view === "videoViews") {
      return [...stats].sort((a, b) => b.videoDurationMs - a.videoDurationMs);
    }
    return [...stats].sort(
      (a, b) => (b[view] as number) - (a[view] as number),
    );
  }, [stats, view]);

  const visible = useMemo(
    () => (showAll ? sorted : sorted.slice(0, TOP_N_DEFAULT)),
    [sorted, showAll],
  );

  const focusedMetric = view === "all" ? null : view;
  const focusedColor =
    focusedMetric === null
      ? null
      : METRICS.find((m) => m.key === focusedMetric)?.color || null;
  const maxFocusedValue = useMemo(() => {
    if (focusedMetric === null) return 0;
    if (focusedMetric === "videoViews") {
      return visible.reduce((m, r) => Math.max(m, r.videoDurationMs), 0);
    }
    return visible.reduce(
      (m, r) => Math.max(m, r[focusedMetric] as number),
      0,
    );
  }, [visible, focusedMetric]);

  const subtitle =
    stats.length > 0
      ? view === "all"
        ? `${stats.length} school${stats.length === 1 ? "" : "s"} — logins, sessions, video watch time (hrs) and MCQ attempts`
        : view === "videoViews"
          ? `${stats.length} school${stats.length === 1 ? "" : "s"} — ranked by video watch time (hrs)`
          : `${stats.length} school${stats.length === 1 ? "" : "s"} — ranked by ${VIEW_OPTIONS.find((v) => v.key === view)?.label.toLowerCase()}`
      : "No activity in this period";

  return (
    <ChartCard
      title="Activity composition by school"
      subtitle={subtitle}
      right={
        <>
          <div className="flex items-center gap-1 rounded-full bg-slate-100 p-1 text-xs">
            {VIEW_OPTIONS.map((v) => (
              <button
                key={v.key}
                onClick={() => setView(v.key)}
                className={clsx(
                  "rounded-full px-2.5 py-1 font-medium transition sm:px-3",
                  view === v.key
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700",
                )}
              >
                {v.label}
              </button>
            ))}
          </div>

          {stats.length > TOP_N_DEFAULT && (
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
                All {stats.length}
              </button>
            </div>
          )}
        </>
      }
    >
      {stats.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {view === "all" && (
            <Legend hoverMetric={hoverMetric} onHover={setHoverMetric} />
          )}

          <div
            className={clsx(
              "rounded-xl border border-slate-100",
              view === "all" ? "mt-4" : "mt-0",
            )}
          >
            <div className="grid grid-cols-[minmax(0,1fr)_88px] items-center gap-3 border-b border-slate-100 bg-slate-50/70 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <div>
                {view === "all"
                  ? "School · activity breakdown"
                  : view === "videoViews"
                    ? "School · video watch time (hrs)"
                    : `School · ${VIEW_OPTIONS.find((v) => v.key === view)?.label.toLowerCase()}`}
              </div>
              <div className="text-right">Courses</div>
            </div>
            <ul className="divide-y divide-slate-100">
              {visible.map((row) => (
                <SchoolRow
                  key={row.school}
                  row={row}
                  hoverMetric={hoverMetric}
                  focusedMetric={focusedMetric}
                  focusedColor={focusedColor}
                  maxFocusedValue={maxFocusedValue}
                  onClick={() => onSchoolClick?.(row.school)}
                />
              ))}
            </ul>
          </div>

          <p className="mt-3 text-[11.5px] text-slate-400">
            {view === "all"
              ? "Tip: bar widths reflect activity counts; labels show actual values. Hover a colour to focus, click a row for student-level details."
              : "Tip: bars are scaled to the school with the highest value. Click a row for student-level details."}
          </p>
        </>
      )}
    </ChartCard>
  );
}

interface LegendProps {
  hoverMetric: MetricKey | null;
  onHover: (m: MetricKey | null) => void;
}

function Legend({ hoverMetric, onHover }: LegendProps) {
  return (
    <div
      className="flex flex-wrap gap-2"
      onMouseLeave={() => onHover(null)}
    >
      {METRICS.map((m) => {
        const isOn = hoverMetric === m.key;
        const isOff = hoverMetric && !isOn;
        return (
          <button
            key={m.key}
            type="button"
            onMouseEnter={() => onHover(m.key)}
            className={clsx(
              "inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1.5 text-[12px] font-medium transition",
              isOn
                ? "border-slate-300 text-slate-900 shadow-sm"
                : isOff
                  ? "border-slate-100 text-slate-400"
                  : "border-slate-200 text-slate-700 hover:border-slate-300 hover:text-slate-900",
            )}
          >
            <span
              className="h-2.5 w-2.5 rounded-full transition"
              style={{ background: m.color, opacity: isOff ? 0.3 : 1 }}
            />
            <span>{m.label}</span>
          </button>
        );
      })}
    </div>
  );
}

interface RowProps {
  row: SchoolCompositionStat;
  hoverMetric: MetricKey | null;
  focusedMetric: MetricKey | null;
  focusedColor: string | null;
  maxFocusedValue: number;
  onClick: () => void;
}

function SchoolRow({
  row,
  hoverMetric,
  focusedMetric,
  focusedColor,
  maxFocusedValue,
  onClick,
}: RowProps) {
  const hasData = row.total > 0;
  const focusedValue =
    focusedMetric === null
      ? 0
      : focusedMetric === "videoViews"
        ? row.videoDurationMs
        : (row[focusedMetric] as number);
  const focusedLabel =
    focusedMetric === null
      ? ""
      : focusedMetric === "videoViews"
        ? formatVideoHours(row.videoDurationMs)
        : formatNumber(focusedValue);
  const [tip, setTip] = useState<{ x: number; y: number } | null>(null);

  const handleMove = (e: React.MouseEvent) => {
    setTip({ x: e.clientX, y: e.clientY });
  };

  return (
    <li className="relative">
      <button
        type="button"
        onClick={() => {
          setTip(null);
          onClick();
        }}
        onMouseEnter={handleMove}
        onMouseMove={handleMove}
        onMouseLeave={() => setTip(null)}
        className="grid w-full grid-cols-[minmax(0,1fr)_88px] items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <span className="break-words text-[12.5px] font-semibold text-slate-900">
              {row.school}
            </span>
            <span className="num shrink-0 text-[11px] text-slate-500">
              {focusedMetric === null
                ? `${formatNumber(row.total)} activities`
                : focusedLabel}
            </span>
          </div>

          <div className="mt-2">
            {focusedMetric !== null ? (
              <SingleMetricBar
                value={focusedValue}
                max={maxFocusedValue}
                color={focusedColor || "#64748b"}
              />
            ) : hasData ? (
              <CompositionBar row={row} hoverMetric={hoverMetric} />
            ) : (
              <div className="flex h-2.5 items-center justify-center rounded-full bg-slate-100 text-[10px] text-slate-400">
                no activity
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end leading-tight">
          <span className="num text-[18px] font-bold text-slate-900">
            {row.courses}
          </span>
          <span className="text-[10.5px] text-slate-500">
            {row.courses === 1 ? "course" : "courses"}
          </span>
        </div>
      </button>

      {tip && hasData && (
        <RowTooltip
          row={row}
          focusedMetric={focusedMetric}
          x={tip.x}
          y={tip.y}
        />
      )}
    </li>
  );
}

interface TooltipProps {
  row: SchoolCompositionStat;
  focusedMetric: MetricKey | null;
  x: number;
  y: number;
}

function RowTooltip({ row, focusedMetric, x, y }: TooltipProps) {
  const W = 280;
  const H = 170;
  const PAD = 12;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1024;
  const vh = typeof window !== "undefined" ? window.innerHeight : 768;

  // Prefer right + below cursor; flip if it would overflow.
  let left = x + 14;
  let top = y + 14;
  if (left + W + PAD > vw) left = Math.max(PAD, x - W - 14);
  if (top + H + PAD > vh) top = Math.max(PAD, y - H - 14);

  return (
    <div
      className="pointer-events-none fixed z-50"
      style={{ left, top, width: W }}
    >
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white text-[12px] shadow-cardHover">
        <div className="border-b border-slate-100 px-3 py-1.5 text-[11px] font-semibold text-slate-700">
          {row.school}
        </div>
        <ul className="space-y-1 px-3 py-2">
          {METRICS.map((m) => {
            const dim = focusedMetric !== null && focusedMetric !== m.key;
            const value = metricValueLabel(row, m.key);
            const zero =
              m.key === "videoViews"
                ? row.videoDurationMs <= 0
                : metricRawCount(row, m.key) <= 0;
            return (
              <li
                key={m.key}
                className={clsx(
                  "flex items-center gap-2 transition",
                  dim && "opacity-40",
                )}
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: m.color, opacity: zero ? 0.3 : 1 }}
                />
                <span className={clsx(zero ? "text-slate-400" : "text-slate-600")}>
                  {m.label}
                </span>
                <span
                  className={clsx(
                    "num ml-auto font-semibold",
                    zero ? "text-slate-400" : "text-slate-900",
                  )}
                >
                  {value}
                </span>
              </li>
            );
          })}
        </ul>
        <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/70 px-3 py-1.5 text-[11px]">
          <span className="text-slate-500">
            Total{" "}
            <span className="num font-semibold text-slate-800">
              {formatNumber(row.total)}
            </span>
          </span>
          <span className="text-slate-500">
            Courses{" "}
            <span className="num font-semibold text-slate-800">
              {row.courses}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

interface SingleBarProps {
  value: number;
  max: number;
  color: string;
}

function SingleMetricBar({ value, max, color }: SingleBarProps) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  );
}

interface BarProps {
  row: SchoolCompositionStat;
  hoverMetric: MetricKey | null;
}

function CompositionBar({ row, hoverMetric }: BarProps) {
  const segments = METRICS.map((m) => {
    const count = metricRawCount(row, m.key);
    const pct = row.total > 0 ? (count / row.total) * 100 : 0;
    const valueLabel = metricValueLabel(row, m.key);
    const zero =
      m.key === "videoViews" ? row.videoDurationMs <= 0 : count <= 0;
    return { ...m, count, pct, valueLabel, zero };
  });

  return (
    <div className="space-y-1.5">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
        {segments
          .filter((s) => s.pct > 0)
          .map((s) => {
            const dim = hoverMetric && hoverMetric !== s.key;
            return (
              <div
                key={s.key}
                style={{
                  width: `${s.pct}%`,
                  background: s.color,
                  opacity: dim ? 0.2 : 1,
                }}
                className="h-full transition-opacity"
              />
            );
          })}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10.5px]">
        {segments.map((s) => {
          const dim = hoverMetric && hoverMetric !== s.key;
          return (
            <span
              key={s.key}
              className={clsx(
                "inline-flex items-center gap-1 transition",
                dim && "opacity-40",
              )}
              title={
                s.zero ? `No ${s.label.toLowerCase()} in this period` : undefined
              }
            >
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: s.color, opacity: s.zero ? 0.4 : 1 }}
              />
              <span
                className={clsx(
                  "num font-semibold",
                  s.zero ? "text-slate-700" : "text-slate-700",
                )}
              >
                {s.valueLabel}
              </span>
              <span className={clsx(s.zero ? "text-slate-400" : "text-slate-500")}>
                {s.label}
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-[280px] flex-col items-center justify-center text-center text-slate-400">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 3v18h18" />
          <rect x="7" y="11" width="3" height="7" />
          <rect x="13" y="7" width="3" height="11" />
        </svg>
      </div>
      <div className="mt-3 text-sm font-medium text-slate-600">
        Nothing to show yet
      </div>
      <div className="text-xs text-slate-400">
        Try changing the month or school filter above.
      </div>
    </div>
  );
}
