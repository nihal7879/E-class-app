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

// Each tone carries a colour-washed card background, a gradient icon chip
// (white glyph on a saturated gradient), a tinted top border and a coloured
// value — so the strip reads as a row of distinct, vivid stat cards.
const TONES: Record<
  ToneKey,
  { card: string; iconBg: string; iconFg: string; value: string; border: string }
> = {
  indigo: {
    card: "bg-gradient-to-br from-indigo-50 to-white",
    iconBg: "bg-gradient-to-br from-indigo-500 to-indigo-600 shadow-md shadow-indigo-500/30",
    iconFg: "text-white",
    value: "text-indigo-700",
    border: "border-t-indigo-400",
  },
  violet: {
    card: "bg-gradient-to-br from-violet-50 to-white",
    iconBg: "bg-gradient-to-br from-violet-500 to-violet-600 shadow-md shadow-violet-500/30",
    iconFg: "text-white",
    value: "text-violet-700",
    border: "border-t-violet-400",
  },
  emerald: {
    card: "bg-gradient-to-br from-emerald-50 to-white",
    iconBg: "bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-md shadow-emerald-500/30",
    iconFg: "text-white",
    value: "text-emerald-700",
    border: "border-t-emerald-400",
  },
  amber: {
    card: "bg-gradient-to-br from-amber-50 to-white",
    iconBg: "bg-gradient-to-br from-amber-400 to-amber-500 shadow-md shadow-amber-500/30",
    iconFg: "text-white",
    value: "text-amber-700",
    border: "border-t-amber-400",
  },
  rose: {
    card: "bg-gradient-to-br from-rose-50 to-white",
    iconBg: "bg-gradient-to-br from-rose-500 to-rose-600 shadow-md shadow-rose-500/30",
    iconFg: "text-white",
    value: "text-rose-700",
    border: "border-t-rose-400",
  },
  slate: {
    card: "bg-gradient-to-br from-slate-50 to-white",
    iconBg: "bg-gradient-to-br from-slate-500 to-slate-600 shadow-md shadow-slate-500/30",
    iconFg: "text-white",
    value: "text-slate-700",
    border: "border-t-slate-400",
  },
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
    <div
      className={clsx(
        "card card-hover group relative flex flex-col border-t-[3px] p-4 sm:p-5",
        t.card,
        t.border,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div
          className={clsx(
            "flex h-11 w-11 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105 sm:h-12 sm:w-12",
            t.iconBg,
            t.iconFg,
          )}
        >
          {icon}
        </div>
        <div className="text-right">
          <div className="text-[11.5px] font-medium text-slate-500 sm:text-[12px]">
            {label}
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-baseline gap-1.5 sm:mt-4">
        <div
          className={clsx(
            "num text-[24px] font-bold leading-none tracking-tight sm:text-[30px]",
            t.value,
          )}
        >
          {value}
        </div>
        {unit && (
          <div className="text-xs font-medium text-slate-500 sm:text-sm">{unit}</div>
        )}
      </div>

      {hint && (
        <div className="mt-1.5 text-[11.5px] text-slate-500 sm:text-[12px]">{hint}</div>
      )}
    </div>
  );
}
