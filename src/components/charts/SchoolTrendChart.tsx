import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import clsx from "clsx";
import { computeSchoolTrend } from "@/lib/aggregations";
import { useFilter } from "@/lib/filterContext";
import { formatNumber, shortSchoolName } from "@/lib/parse";
import ChartCard from "./ChartCard";
import { CustomTooltip } from "./Tooltip";
import {
  AXIS_COLOR,
  AXIS_TICK_STYLE,
  GRID_COLOR,
  GRID_DASH,
  colorForIndex,
} from "./theme";

const TOP_N_DEFAULT = 6;

interface Props {
  onSchoolClick?: (school: string) => void;
}

export default function SchoolTrendChart({ onSchoolClick }: Props) {
  const { filter } = useFilter();
  const { data, schools, totalLogins } = useMemo(
    () => computeSchoolTrend(filter),
    [filter],
  );
  const [showAll, setShowAll] = useState(false);
  const [highlighted, setHighlighted] = useState<string | null>(null);

  const totals = useMemo(() => {
    const m = new Map<string, number>();
    for (const row of data) {
      for (const s of schools) {
        m.set(s, (m.get(s) || 0) + Number(row[s] || 0));
      }
    }
    return m;
  }, [data, schools]);

  const topSchools = useMemo(() => {
    if (showAll) return schools;
    return [...schools]
      .sort((a, b) => (totals.get(b) || 0) - (totals.get(a) || 0))
      .slice(0, TOP_N_DEFAULT);
  }, [schools, totals, showAll]);

  const colorOf = useMemo(() => {
    const m = new Map<string, string>();
    topSchools.forEach((s, i) => m.set(s, colorForIndex(i)));
    return m;
  }, [topSchools]);

  const formatDate = (d: string) => d.slice(8); // "YYYY-MM-DD" -> "DD"
  const formatDateFull = (d: string) => d; // tooltip keeps the full date

  const subtitle =
    schools.length > 0
      ? `${formatNumber(totalLogins)} logins across ${schools.length} school${schools.length === 1 ? "" : "s"}`
      : "No activity in this period";

  return (
    <ChartCard
      title="Daily logins by school"
      subtitle={subtitle}
      right={
        schools.length > TOP_N_DEFAULT && (
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
              All {schools.length}
            </button>
          </div>
        )
      }
    >
      {data.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="h-[340px] w-full">
            <ResponsiveContainer>
              <LineChart
                data={data}
                margin={{ top: 10, right: 16, bottom: 0, left: -12 }}
              >
                <CartesianGrid
                  stroke={GRID_COLOR}
                  strokeDasharray={GRID_DASH}
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDate}
                  tick={AXIS_TICK_STYLE}
                  stroke={AXIS_COLOR}
                  tickLine={false}
                  axisLine={{ stroke: GRID_COLOR }}
                />
                <YAxis
                  tick={AXIS_TICK_STYLE}
                  stroke={AXIS_COLOR}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  width={36}
                />
                <Tooltip
                  content={
                    <CustomTooltip
                      labelFormatter={formatDateFull}
                      formatter={(v) => `${v} logins`}
                    />
                  }
                  cursor={{ stroke: "#cbd5e1", strokeDasharray: "3 3" }}
                />
                {topSchools.map((s) => {
                  const isFaded = highlighted && highlighted !== s;
                  return (
                    <Line
                      key={s}
                      type="monotone"
                      dataKey={s}
                      stroke={colorOf.get(s)}
                      strokeWidth={highlighted === s ? 2.6 : 2}
                      strokeOpacity={isFaded ? 0.15 : 1}
                      dot={false}
                      activeDot={{
                        r: 4,
                        onClick: () => onSchoolClick?.(s),
                        style: { cursor: "pointer" },
                      }}
                      isAnimationActive
                      animationDuration={500}
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>

          <FriendlyLegend
            schools={topSchools}
            totals={totals}
            colorOf={colorOf}
            highlighted={highlighted}
            onHover={setHighlighted}
            onClick={(s) => onSchoolClick?.(s)}
          />
          <p className="mt-3 text-[11.5px] text-slate-400">
            Tip: hover a school to highlight it, click to see student-level details.
          </p>
        </>
      )}
    </ChartCard>
  );
}

interface LegendProps {
  schools: string[];
  totals: Map<string, number>;
  colorOf: Map<string, string>;
  highlighted: string | null;
  onHover: (s: string | null) => void;
  onClick: (s: string) => void;
}

function FriendlyLegend({
  schools,
  totals,
  colorOf,
  highlighted,
  onHover,
  onClick,
}: LegendProps) {
  return (
    <div
      className="mt-5 flex flex-wrap gap-2"
      onMouseLeave={() => onHover(null)}
    >
      {schools.map((s) => {
        const isOn = highlighted === s;
        const isOff = highlighted && !isOn;
        return (
          <button
            key={s}
            type="button"
            onMouseEnter={() => onHover(s)}
            onClick={() => onClick(s)}
            className={clsx(
              "group inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1.5 text-[12px] font-medium transition",
              isOn
                ? "border-slate-300 text-slate-900 shadow-sm"
                : isOff
                  ? "border-slate-100 text-slate-400"
                  : "border-slate-200 text-slate-700 hover:border-slate-300 hover:text-slate-900",
            )}
            title={s}
          >
            <span
              className="h-2.5 w-2.5 rounded-full transition"
              style={{
                background: colorOf.get(s),
                opacity: isOff ? 0.3 : 1,
              }}
            />
            <span className="max-w-[180px] truncate">
              {shortSchoolName(s, 24)}
            </span>
            <span
              className={clsx(
                "num text-[11px]",
                isOff ? "text-slate-300" : "text-slate-500",
              )}
            >
              {formatNumber(totals.get(s) || 0)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-[340px] flex-col items-center justify-center text-center text-slate-400">
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
          <polyline points="6 14 10 10 14 13 20 6" />
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
