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
  const stats = useMemo(() => computeSchoolStats(filter), [filter]);
  const [metric, setMetric] = useState<Metric>("logins");

  const data = useMemo(
    () =>
      stats
        .map((s) => ({
          school: s.school,
          shortSchool: shortSchoolName(s.school, 22),
          logins: s.logins,
          sessions: s.sessions,
          hours: s.totalSessionMs / 3_600_000,
          totalSessionMs: s.totalSessionMs,
          uniqueStudents: s.uniqueStudents,
        }))
        .sort((a, b) => Number(b[metric]) - Number(a[metric])),
    [stats, metric],
  );

  return (
    <ChartCard
      title="How each school is doing"
      subtitle="Click a school to see its students"
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
        <div className="flex h-[360px] items-center justify-center text-sm text-slate-400">
          No data for this filter
        </div>
      ) : (
        <div style={{ height: Math.max(360, data.length * 24 + 40) }}>
          <ResponsiveContainer>
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 4, right: 32, bottom: 4, left: 8 }}
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
                width={180}
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
