import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatHours, formatNumber } from "@/lib/parse";
import type { StudentStat } from "@/lib/types";
import ChartCard from "./ChartCard";
import { CustomTooltip } from "./Tooltip";
import { AXIS_COLOR, AXIS_TICK_STYLE, GRID_COLOR, GRID_DASH } from "./theme";

interface Props {
  students: StudentStat[];
}

const SESSIONS_COLOR = "#4f46e5";
const HOURS_COLOR = "#059669";

export default function StudentBreakdownChart({ students }: Props) {
  const data = students.map((s) => ({
    enrollmentId: s.enrollmentId,
    sessions: s.sessions,
    hours: s.totalSessionMs / 3_600_000,
    studentName: s.studentName,
  }));

  return (
    <ChartCard
      title="Student Session Count & Duration"
      subtitle="Per-student sessions and total time logged in, by Enrollment ID"
    >
      {data.length === 0 ? (
        <Empty />
      ) : (
        <div className="h-[360px]">
          <ResponsiveContainer>
            <BarChart
              data={data}
              margin={{ top: 10, right: 8, bottom: 10, left: -8 }}
              barGap={4}
            >
              <CartesianGrid
                stroke={GRID_COLOR}
                strokeDasharray={GRID_DASH}
                vertical={false}
              />
              <XAxis
                dataKey="enrollmentId"
                tick={AXIS_TICK_STYLE}
                stroke={AXIS_COLOR}
                tickLine={false}
                axisLine={{ stroke: GRID_COLOR }}
                interval={0}
                angle={-30}
                height={56}
                textAnchor="end"
              />
              <YAxis
                yAxisId="sessions"
                tick={{ ...AXIS_TICK_STYLE, fill: SESSIONS_COLOR }}
                stroke={AXIS_COLOR}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                width={40}
              />
              <YAxis
                yAxisId="hours"
                orientation="right"
                tick={{ ...AXIS_TICK_STYLE, fill: HOURS_COLOR }}
                stroke={AXIS_COLOR}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${Number(v).toFixed(0)}h`}
                width={40}
              />
              <Tooltip
                cursor={{ fill: "#f1f5f9" }}
                content={
                  <CustomTooltip
                    formatter={(v, name) =>
                      name === "Sessions"
                        ? `${formatNumber(Number(v))} sessions`
                        : formatHours(Number(v) * 3_600_000)
                    }
                  />
                }
              />
              <Legend
                verticalAlign="top"
                align="right"
                height={28}
                wrapperStyle={{ fontSize: 11.5, color: "#475569" }}
                iconType="circle"
                iconSize={8}
              />
              <Bar
                yAxisId="sessions"
                dataKey="sessions"
                name="Sessions"
                fill={SESSIONS_COLOR}
                radius={[4, 4, 0, 0]}
                isAnimationActive
                animationDuration={500}
              />
              <Bar
                yAxisId="hours"
                dataKey="hours"
                name="Usage Hours"
                fill={HOURS_COLOR}
                radius={[4, 4, 0, 0]}
                isAnimationActive
                animationDuration={500}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}

function Empty() {
  return (
    <div className="flex h-[360px] items-center justify-center text-sm text-slate-400">
      No student activity for current filter
    </div>
  );
}
