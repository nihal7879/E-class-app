import type { TooltipProps } from "recharts";
import type {
  NameType,
  ValueType,
} from "recharts/types/component/DefaultTooltipContent";

type Formatter = (value: number, name: string) => string;

export function CustomTooltip({
  active,
  payload,
  label,
  formatter,
  labelFormatter,
}: TooltipProps<ValueType, NameType> & {
  formatter?: Formatter;
  labelFormatter?: (label: string) => string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="min-w-[160px] overflow-hidden rounded-xl border border-slate-200 bg-white text-[12px] shadow-cardHover">
      {label !== undefined && (
        <div className="border-b border-slate-100 px-3 py-1.5 text-[11px] font-semibold text-slate-600">
          {labelFormatter ? labelFormatter(String(label)) : String(label)}
        </div>
      )}
      <ul className="space-y-1 px-3 py-2">
        {payload
          .filter((p) => p.value !== undefined && p.value !== null && p.value !== 0)
          .map((p, i) => (
            <li key={i} className="flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: p.color || "#94a3b8" }}
              />
              <span className="max-w-[200px] truncate text-slate-600">{p.name}</span>
              <span className="num ml-auto font-semibold text-slate-900">
                {formatter
                  ? formatter(Number(p.value), String(p.name))
                  : String(p.value)}
              </span>
            </li>
          ))}
      </ul>
    </div>
  );
}
