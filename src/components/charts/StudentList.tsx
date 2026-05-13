import clsx from "clsx";
import type { StudentStat } from "@/lib/types";
import { formatHours, formatNumber } from "@/lib/parse";
import ChartCard from "./ChartCard";

interface Props {
  title: string;
  subtitle?: string;
  students: StudentStat[];
  tone: "emerald" | "rose";
  emptyText?: string;
}

export default function StudentList({
  title,
  subtitle,
  students,
  tone,
  emptyText = "No students for current filter",
}: Props) {
  const badgeBg =
    tone === "emerald"
      ? "bg-emerald-100 text-emerald-700"
      : "bg-rose-100 text-rose-700";

  const maxMs =
    students.reduce((a, s) => (s.totalSessionMs > a ? s.totalSessionMs : a), 0) || 1;

  return (
    <ChartCard title={title} subtitle={subtitle}>
      {students.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-sm text-slate-400">
          {emptyText}
        </div>
      ) : (
        <ol className="space-y-2">
          {students.map((s, i) => {
            const share = s.totalSessionMs / maxMs;
            return (
              <li
                key={s.enrollmentId}
                className="group flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-slate-50"
              >
                <div
                  className={clsx(
                    "flex h-9 w-9 items-center justify-center rounded-full text-[12px] font-bold",
                    badgeBg,
                  )}
                >
                  #{i + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="truncate text-[13.5px] font-semibold text-slate-900">
                      {s.studentName || s.enrollmentId}
                    </div>
                    <div className="num text-[13px] font-semibold text-slate-900">
                      {formatHours(s.totalSessionMs)}
                    </div>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={clsx(
                          "h-full rounded-full transition-all duration-500",
                          tone === "emerald" ? "bg-emerald-400" : "bg-rose-400",
                        )}
                        style={{ width: `${Math.max(4, share * 100)}%` }}
                      />
                    </div>
                    <div className="shrink-0 text-[11px] text-slate-500">
                      <span className="num">{formatNumber(s.sessions)}</span> sessions
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </ChartCard>
  );
}
