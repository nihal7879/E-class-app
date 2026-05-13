import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatNumber } from "@/lib/parse";
import type { StudentStat } from "@/lib/types";
import ChartCard from "./ChartCard";
import { CustomTooltip } from "./Tooltip";
import { AXIS_COLOR, AXIS_TICK_STYLE, GRID_COLOR, GRID_DASH } from "./theme";

interface Props {
  students: StudentStat[];
}

export default function StudentSessionChart({ students }: Props) {
  const data = students.map((s) => ({
    enrollmentId: s.enrollmentId,
    sessions: s.sessions,
    logins: s.logins,
    studentName: s.studentName,
  }));

  return (
    <ChartCard
      title="Student Session Count"
      subtitle="Per-student session count by Enrollment ID"
    >
      {data.length === 0 ? (
        <Empty />
      ) : (
        <div className="h-[320px]">
          <ResponsiveContainer>
            <BarChart data={data} margin={{ top: 10, right: 12, bottom: 10, left: -12 }}>
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
                height={50}
                textAnchor="end"
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
                cursor={{ fill: "#f1f5f9" }}
                content={
                  <CustomTooltip
                    formatter={(v) => `${formatNumber(Number(v))} sessions`}
                  />
                }
              />
              <Bar
                dataKey="sessions"
                name="Sessions"
                fill="#4f46e5"
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
    <div className="flex h-[320px] items-center justify-center text-sm text-slate-400">
      No student activity for current filter
    </div>
  );
}
