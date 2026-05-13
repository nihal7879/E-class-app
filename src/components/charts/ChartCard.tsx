import type { ReactNode } from "react";
import clsx from "clsx";

interface ChartCardProps {
  title: string;
  subtitle?: ReactNode;
  right?: ReactNode;
  className?: string;
  children: ReactNode;
}

export default function ChartCard({
  title,
  subtitle,
  right,
  className,
  children,
}: ChartCardProps) {
  return (
    <section className={clsx("card card-hover p-4 sm:p-5", className)}>
      <header className="mb-3 flex flex-wrap items-start justify-between gap-2 sm:mb-4 sm:gap-3">
        <div className="min-w-0">
          <h3 className="text-[14px] font-semibold text-slate-900 sm:text-[15px]">
            {title}
          </h3>
          {subtitle && (
            <p className="mt-0.5 text-[11.5px] text-slate-500">{subtitle}</p>
          )}
        </div>
        {right && <div className="flex flex-wrap items-center gap-2">{right}</div>}
      </header>
      <div className="relative">{children}</div>
    </section>
  );
}
