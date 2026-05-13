import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import ChartCard from "./ChartCard";
import { CustomTooltip } from "./Tooltip";
import { AXIS_COLOR, AXIS_TICK_STYLE, GRID_COLOR, GRID_DASH } from "./theme";

interface Props {
  data: { date: string; logins: number; uniqueStudents: number }[];
}

export default function DailyActivityChart({ data }: Props) {
  return (
    <ChartCard
      title="Daily Activity Trend"
      subtitle="Logins and unique active students by day"
    >
      {data.length === 0 ? (
        <div className="flex h-[260px] items-center justify-center text-sm text-slate-400">
          No daily activity for current filter
        </div>
      ) : (
        <div className="h-[260px]">
          <ResponsiveContainer>
            <AreaChart data={data} margin={{ top: 10, right: 12, bottom: 0, left: -12 }}>
              <defs>
                <linearGradient id="loginGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.32} />
                  <stop offset="100%" stopColor="#4f46e5" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="studGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="#7c3aed" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                stroke={GRID_COLOR}
                strokeDasharray={GRID_DASH}
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tickFormatter={(d) => d.slice(5)}
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
                content={<CustomTooltip formatter={(v) => String(v)} />}
                cursor={{ stroke: "#94a3b8", strokeDasharray: "3 3" }}
              />
              <Legend
                wrapperStyle={{ fontSize: 11, paddingTop: 6 }}
                iconType="circle"
                iconSize={8}
              />
              <Area
                type="monotone"
                dataKey="logins"
                name="Logins"
                stroke="#4f46e5"
                strokeWidth={1.8}
                fill="url(#loginGrad)"
                isAnimationActive
                animationDuration={500}
              />
              <Area
                type="monotone"
                dataKey="uniqueStudents"
                name="Active Students"
                stroke="#7c3aed"
                strokeWidth={1.8}
                fill="url(#studGrad)"
                isAnimationActive
                animationDuration={500}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}
