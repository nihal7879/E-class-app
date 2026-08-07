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
import type { TooltipProps } from "recharts";
import type {
  NameType,
  ValueType,
} from "recharts/types/component/DefaultTooltipContent";
import { formatHours, formatNumber } from "@/lib/parse";
import type { StudentStat } from "@/lib/types";
import ChartCard from "./ChartCard";
import { BarChartSkeleton } from "@/components/ui/Skeleton";
import { AXIS_COLOR, AXIS_TICK_STYLE, GRID_COLOR, GRID_DASH } from "./theme";

interface Props {
  students: StudentStat[];
  loading?: boolean;
}

const VIDEO_COLOR = "#059669";
const MCQ_COLOR = "#4f46e5";

export default function StudentBreakdownChart({ students, loading = false }: Props) {
  const data = students.map((s) => ({
    enrollmentId: s.enrollmentId,
    videoHours: s.videoWatchMs / 3_600_000,
    mcqAttempts: s.mcqAttempts,
    studentName: s.studentName,
  }));

  return (
    <ChartCard
      title="Student Video Usage & MCQ Attempts"
      subtitle="Per-student video watch time and MCQ attempts, by Enrollment ID"
    >
      {loading && data.length === 0 ? (
        <BarChartSkeleton height={360} bars={14} />
      ) : data.length === 0 ? (
        <Empty />
      ) : (
        <div className="h-[360px]">
          <ResponsiveContainer>
            <BarChart
              data={data}
              margin={{ top: 10, right: 8, bottom: 10, left: -8 }}
              barGap={4}
              // Push categories apart when there are only a few students so
              // the bars don't stretch into huge blocks on desktop.
              barCategoryGap="30%"
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
                yAxisId="video"
                tick={{ ...AXIS_TICK_STYLE, fill: VIDEO_COLOR }}
                stroke={AXIS_COLOR}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${Number(v).toFixed(0)}h`}
                width={40}
              />
              <YAxis
                yAxisId="mcq"
                orientation="right"
                tick={{ ...AXIS_TICK_STYLE, fill: MCQ_COLOR }}
                stroke={AXIS_COLOR}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                width={40}
              />
              <Tooltip cursor={{ fill: "#f1f5f9" }} content={<BreakdownTooltip />} />
              <Legend
                verticalAlign="top"
                align="right"
                height={28}
                wrapperStyle={{ fontSize: 11.5, color: "#475569" }}
                iconType="circle"
                iconSize={8}
              />
              <Bar
                yAxisId="video"
                dataKey="videoHours"
                name="Video Usage"
                fill={VIDEO_COLOR}
                radius={[4, 4, 0, 0]}
                isAnimationActive
                animationDuration={500}
                // Cap pixel width so a 2-student chart doesn't render two giant blocks.
                maxBarSize={48}
              />
              <Bar
                yAxisId="mcq"
                dataKey="mcqAttempts"
                name="MCQ Attempts"
                fill={MCQ_COLOR}
                radius={[4, 4, 0, 0]}
                isAnimationActive
                animationDuration={500}
                maxBarSize={48}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}

/**
 * Local tooltip instead of the shared CustomTooltip: that one drops any series
 * whose value is 0, which would silently hide "MCQ Attempts: 0" — the exact
 * case we want visible here.
 */
function BreakdownTooltip({
  active,
  payload,
  label,
}: TooltipProps<ValueType, NameType>) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload as
    | { videoHours: number; mcqAttempts: number }
    | undefined;
  if (!row) return null;

  return (
    <div className="min-w-[160px] overflow-hidden rounded-xl border border-slate-200 bg-white text-[12px] shadow-cardHover">
      <div className="border-b border-slate-100 px-3 py-1.5 text-[11px] font-semibold text-slate-600">
        {String(label)}
      </div>
      <ul className="space-y-1 px-3 py-2">
        <TooltipRow
          color={VIDEO_COLOR}
          name="Video Usage"
          value={formatHours(row.videoHours * 3_600_000)}
        />
        <TooltipRow
          color={MCQ_COLOR}
          name="MCQ Attempts"
          value={formatNumber(row.mcqAttempts)}
        />
      </ul>
    </div>
  );
}

function TooltipRow({
  color,
  name,
  value,
}: {
  color: string;
  name: string;
  value: string;
}) {
  return (
    <li className="flex items-center gap-2">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      <span className="max-w-[200px] truncate text-slate-600">{name}</span>
      <span className="num ml-auto font-semibold text-slate-900">{value}</span>
    </li>
  );
}

function Empty() {
  return (
    <div className="flex h-[360px] items-center justify-center text-sm text-slate-400">
      No student activity for current filter
    </div>
  );
}
