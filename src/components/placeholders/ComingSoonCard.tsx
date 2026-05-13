import type { ReactNode } from "react";

interface ComingSoonCardProps {
  title: string;
  description: string;
  icon: ReactNode;
}

export default function ComingSoonCard({
  title,
  description,
  icon,
}: ComingSoonCardProps) {
  return (
    <div className="card card-hover relative flex h-full flex-col overflow-hidden p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
          {icon}
        </div>
        <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-700">
          Coming soon
        </span>
      </div>
      <div className="mt-3">
        <h3 className="text-[15px] font-semibold text-slate-900">{title}</h3>
        <p className="mt-1 text-[12.5px] leading-relaxed text-slate-500">
          {description}
        </p>
      </div>
      <div className="mt-auto pt-4">
        <Skeleton />
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="flex h-12 w-full items-end gap-1 opacity-80">
      {[40, 64, 50, 78, 36, 70, 58, 88, 46, 60, 30, 72, 54].map((h, i) => (
        <div
          key={i}
          style={{ height: `${h}%` }}
          className="flex-1 rounded-sm bg-gradient-to-t from-slate-200 to-slate-100"
        />
      ))}
    </div>
  );
}
