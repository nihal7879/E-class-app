import type { ReactNode } from "react";
import clsx from "clsx";

interface KpiTileProps {
  label: string;
  value: ReactNode;
  unit?: string;
  hint?: ReactNode;
  icon: ReactNode;
  tone?: ToneKey;
}

type ToneKey = "indigo" | "violet" | "emerald" | "amber" | "rose" | "slate";

const TONES: Record<ToneKey, { iconBg: string; iconFg: string }> = {
  indigo: { iconBg: "bg-indigo-100", iconFg: "text-indigo-600" },
  violet: { iconBg: "bg-violet-100", iconFg: "text-violet-600" },
  emerald: { iconBg: "bg-emerald-100", iconFg: "text-emerald-600" },
  amber: { iconBg: "bg-amber-100", iconFg: "text-amber-600" },
  rose: { iconBg: "bg-rose-100", iconFg: "text-rose-600" },
  slate: { iconBg: "bg-slate-100", iconFg: "text-slate-600" },
};

export default function KpiTile({
  label,
  value,
  unit,
  hint,
  icon,
  tone = "indigo",
}: KpiTileProps) {
  const t = TONES[tone];
  return (
    <div className="card card-hover group relative flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div
          className={clsx(
            "flex h-10 w-10 items-center justify-center rounded-xl",
            t.iconBg,
            t.iconFg,
          )}
        >
          {icon}
        </div>
        <div className="text-right">
          <div className="text-[12px] font-medium text-slate-500">{label}</div>
        </div>
      </div>

      <div className="mt-4 flex items-baseline gap-1.5">
        <div className="num text-[30px] font-bold leading-none tracking-tight text-slate-900">
          {value}
        </div>
        {unit && (
          <div className="text-sm font-medium text-slate-500">{unit}</div>
        )}
      </div>

      {hint && <div className="mt-1.5 text-[12px] text-slate-500">{hint}</div>}
    </div>
  );
}
