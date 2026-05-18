import { Area, AreaChart, ResponsiveContainer, Tooltip } from "recharts";

interface SparklineProps {
  data: { date: string; value: number }[];
  color: string;
  gradientId: string;
  height?: number;
}

export default function Sparkline({
  data,
  color,
  gradientId,
  height = 40,
}: SparklineProps) {
  if (data.length === 0) {
    return (
      <div
        style={{ height }}
        className="flex items-end gap-[3px] opacity-60"
        aria-hidden
      >
        {[3, 5, 4, 7, 5, 8, 6, 9, 7, 11].map((h, i) => (
          <div
            key={i}
            className="w-[3px] rounded-sm bg-slate-200"
            style={{ height: `${h * 3}px` }}
          />
        ))}
      </div>
    );
  }

  return (
    <div style={{ height, width: "100%" }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Tooltip content={() => null} cursor={false} />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.6}
            fill={`url(#${gradientId})`}
            isAnimationActive
            animationDuration={500}
            dot={false}
            activeDot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
