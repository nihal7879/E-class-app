import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatHours } from "@/lib/parse";
import type { StudentStat } from "@/lib/types";
import ChartCard from "./ChartCard";
import { CustomTooltip } from "./Tooltip";
import { AXIS_COLOR, AXIS_TICK_STYLE, GRID_COLOR, GRID_DASH } from "./theme";

interface Props {
  students: StudentStat[];
}

export default function UsageDurationChart({ students }: Props) {
  const data = students.map((s) => ({
    enrollmentId: s.enrollmentId,
    hours: s.totalSessionMs / 3_600_000,
    rawMs: s.totalSessionMs,
    studentName: s.studentName,
  }));

  return (
    <ChartCard
      title="Usage Duration"
      subtitle="Total time logged in per student"
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
                tickFormatter={(v) => `${Number(v).toFixed(0)}h`}
                width={36}
              />
              <Tooltip
                cursor={{ fill: "#f1f5f9" }}
                content={
                  <CustomTooltip
                    formatter={(v) => formatHours(Number(v) * 3_600_000)}
                  />
                }
              />
              <Bar
                dataKey="hours"
                name="Usage Hours"
                fill="#059669"
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
      No usage data for current filter
    </div>
  );
}
