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
import { computeSchoolStats } from "@/lib/aggregations";
import { useFilter } from "@/lib/filterContext";
import { formatHours, formatNumber, shortSchoolName } from "@/lib/parse";
import { useIsSm } from "@/lib/useMediaQuery";
import ChartCard from "./ChartCard";
import { CustomTooltip } from "./Tooltip";
import {
  AXIS_COLOR,
  AXIS_TICK_STYLE,
  GRID_COLOR,
  GRID_DASH,
  colorForIndex,
} from "./theme";
import clsx from "clsx";

type Metric = "logins" | "sessions" | "hours";

const METRIC_OPTIONS: { key: Metric; label: string }[] = [
  { key: "logins", label: "Logins" },
  { key: "sessions", label: "Sessions" },
  { key: "hours", label: "Hours" },
];

interface Props {
  onSchoolClick?: (school: string) => void;
}

export default function SchoolSessionBar({ onSchoolClick }: Props) {
  const { filter } = useFilter();
  const isSm = useIsSm();
  const stats = useMemo(() => computeSchoolStats(filter), [filter]);
  const [metric, setMetric] = useState<Metric>("logins");

  const labelMax = isSm ? 22 : 14;
  const yAxisWidth = isSm ? 180 : 110;
  const rowHeight = isSm ? 24 : 20;
  const baseHeight = isSm ? 360 : 280;

  const data = useMemo(
    () =>
      stats
        .map((s) => ({
          school: s.school,
          shortSchool: shortSchoolName(s.school, labelMax),
          logins: s.logins,
          sessions: s.sessions,
          hours: s.totalSessionMs / 3_600_000,
          totalSessionMs: s.totalSessionMs,
          uniqueStudents: s.uniqueStudents,
        }))
        .sort((a, b) => Number(b[metric]) - Number(a[metric])),
    [stats, metric, labelMax],
  );

  return (
    <ChartCard
      title="How each school is doing"
      subtitle="Tap a bar to see the school's students"
      right={
        <div className="flex items-center gap-1 rounded-full bg-slate-100 p-1 text-xs">
          {METRIC_OPTIONS.map((m) => (
            <button
              key={m.key}
              onClick={() => setMetric(m.key)}
              className={clsx(
                "rounded-full px-3 py-1 font-medium transition",
                metric === m.key
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700",
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      }
    >
      {data.length === 0 ? (
        <div className="flex h-[280px] items-center justify-center text-sm text-slate-400 sm:h-[360px]">
          No data for this filter
        </div>
      ) : (
        <div style={{ height: Math.max(baseHeight, data.length * rowHeight + 40) }}>
          <ResponsiveContainer>
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 4, right: isSm ? 32 : 12, bottom: 4, left: 4 }}
              barCategoryGap={6}
            >
              <CartesianGrid
                stroke={GRID_COLOR}
                strokeDasharray={GRID_DASH}
                horizontal={false}
              />
              <XAxis
                type="number"
                tickFormatter={(v) =>
                  metric === "hours" ? `${Number(v).toFixed(0)}h` : formatNumber(v)
                }
                tick={AXIS_TICK_STYLE}
                stroke={AXIS_COLOR}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <YAxis
                type="category"
                dataKey="shortSchool"
                tick={AXIS_TICK_STYLE}
                stroke={AXIS_COLOR}
                tickLine={false}
                axisLine={{ stroke: GRID_COLOR }}
                width={yAxisWidth}
              />
              <Tooltip
                cursor={{ fill: "#f1f5f9" }}
                content={
                  <CustomTooltip
                    formatter={(v, name) => {
                      if (name === "hours") return formatHours(Number(v) * 3_600_000);
                      return formatNumber(Number(v));
                    }}
                  />
                }
              />
              <Bar
                dataKey={metric}
                radius={[0, 8, 8, 0]}
                onClick={(d: { school?: string }) => d.school && onSchoolClick?.(d.school)}
                cursor="pointer"
                isAnimationActive
                animationDuration={500}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={colorForIndex(i)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}
