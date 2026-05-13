import type { ReactNode } from "react";

interface SectionHeaderProps {
  title: string;
  description?: string;
  right?: ReactNode;
}

export default function SectionHeader({
  title,
  description,
  right,
}: SectionHeaderProps) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {description && (
          <p className="mt-0.5 text-[12px] text-slate-500">{description}</p>
        )}
      </div>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </div>
  );
}
