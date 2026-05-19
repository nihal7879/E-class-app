import type { CSSProperties } from "react";
import clsx from "clsx";

interface SkeletonProps {
  className?: string;
  rounded?: "sm" | "md" | "lg" | "xl" | "full";
  style?: CSSProperties;
}

// Base shimmer block. Use animate-pulse + a neutral fill so it blends with cards.
export function Skeleton({ className, rounded = "md", style }: SkeletonProps) {
  const radius =
    rounded === "full"
      ? "rounded-full"
      : rounded === "xl"
        ? "rounded-xl"
        : rounded === "lg"
          ? "rounded-lg"
          : rounded === "sm"
            ? "rounded-sm"
            : "rounded-md";
  return (
    <div
      className={clsx(
        "animate-pulse bg-slate-200/70",
        radius,
        className,
      )}
      style={style}
      aria-hidden="true"
    />
  );
}

// One KPI tile — matches the layout of KpiTile.tsx so the placeholder doesn't shift.
export function KpiTileSkeleton() {
  return (
    <div className="card flex flex-col p-4 sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <Skeleton className="h-9 w-9 sm:h-10 sm:w-10" rounded="xl" />
        <Skeleton className="h-3 w-16" />
      </div>
      <Skeleton className="mt-4 h-7 w-24" />
      <Skeleton className="mt-2 h-3 w-20" />
    </div>
  );
}

// Five-tile strip used on Dashboard and SchoolDetail.
export function KpiStripSkeleton({ count = 5 }: { count?: number }) {
  return (
    <section className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
      {Array.from({ length: count }).map((_, i) => (
        <KpiTileSkeleton key={i} />
      ))}
    </section>
  );
}

// Skeleton inside a ChartCard body — bars + chart area placeholder.
export function ChartCardBodySkeleton({
  height = 280,
  withStats = false,
  rows = 5,
}: {
  height?: number;
  withStats?: boolean;
  rows?: number;
}) {
  return (
    <div className="space-y-4">
      {withStats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-3.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex flex-col rounded-xl border border-slate-100 bg-white px-3 py-3 sm:px-3.5 sm:py-3.5"
            >
              <Skeleton className="h-3 w-16" rounded="full" />
              <Skeleton className="mt-3 h-5 w-14" />
            </div>
          ))}
        </div>
      )}
      <div style={{ height }} className="space-y-2.5">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <Skeleton className="h-3.5 w-1/3" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton
              className="h-3 w-full"
              rounded="full"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// Single full-width "area chart" placeholder for charts like DailyActivityChart.
export function AreaChartSkeleton({ height = 260 }: { height?: number }) {
  return (
    <div
      style={{ height }}
      className="relative overflow-hidden rounded-lg"
    >
      <div className="absolute inset-0 flex items-end gap-1.5 px-2 pb-2">
        {Array.from({ length: 24 }).map((_, i) => {
          // Pseudo-random but stable heights so it looks chart-like.
          const h = 30 + ((i * 37) % 60);
          return (
            <Skeleton
              key={i}
              className="flex-1"
              rounded="sm"
              style={{ height: `${h}%` }}
            />
          );
        })}
      </div>
      <div
        className="absolute inset-x-2 bottom-0 flex justify-between"
        style={{ top: 4 }}
      >
        {/* keep DOM tidy */}
      </div>
      <style>{`
        .animate-pulse { will-change: opacity; }
      `}</style>
    </div>
  );
}

// Vertical bar chart placeholder for StudentBreakdownChart.
export function BarChartSkeleton({
  height = 360,
  bars = 14,
}: {
  height?: number;
  bars?: number;
}) {
  return (
    <div
      style={{ height }}
      className="flex items-end gap-1.5 px-2 pb-8 pt-3"
    >
      {Array.from({ length: bars }).map((_, i) => {
        const h = 25 + ((i * 53) % 70);
        return (
          <div key={i} className="flex h-full flex-1 items-end">
            <Skeleton
              className="w-full"
              rounded="sm"
              style={{ height: `${h}%` }}
            />
          </div>
        );
      })}
    </div>
  );
}

// Card grid — used for course/subject card listings.
export function CardGridSkeleton({
  count = 6,
  columns = 3,
}: {
  count?: number;
  columns?: 2 | 3;
}) {
  const grid =
    columns === 2
      ? "grid grid-cols-1 gap-4 md:grid-cols-2"
      : "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3";
  return (
    <div className={grid}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card flex flex-col gap-3 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <Skeleton className="h-10 w-10" rounded="xl" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {Array.from({ length: 4 }).map((_, j) => (
              <div
                key={j}
                className="rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2"
              >
                <Skeleton className="h-2.5 w-14" />
                <Skeleton className="mt-2 h-4 w-12" />
              </div>
            ))}
          </div>
          <Skeleton className="h-3 w-24" />
        </div>
      ))}
    </div>
  );
}

// Table placeholder — header row + N body rows of equally sized cells.
export function TableSkeleton({
  rows = 8,
  columns = 6,
  withSearch = false,
}: {
  rows?: number;
  columns?: number;
  withSearch?: boolean;
}) {
  return (
    <div className="card overflow-hidden">
      {withSearch && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-2.5">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-7 w-56" />
        </div>
      )}
      <div className="border-b border-slate-100 bg-slate-50 px-4 py-2.5">
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0,1fr))` }}>
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton key={i} className="h-3 w-16" />
          ))}
        </div>
      </div>
      <div className="divide-y divide-slate-100">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="px-4 py-3">
            <div
              className="grid items-center gap-3"
              style={{ gridTemplateColumns: `repeat(${columns}, minmax(0,1fr))` }}
            >
              {Array.from({ length: columns }).map((_, c) => (
                <Skeleton
                  key={c}
                  className={c === 0 ? "h-4 w-32" : "h-3.5 w-16"}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// "Hero" card (page header card with school/course title).
export function PageHeroSkeleton() {
  return (
    <div className="card p-5">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="mt-2 h-6 w-64" />
      <Skeleton className="mt-2 h-3 w-48" />
    </div>
  );
}

// Section header (title + description) — for cases where the section is purely loading.
export function SectionHeaderSkeleton() {
  return (
    <div className="mb-3 sm:mb-4">
      <Skeleton className="h-4 w-44" />
      <Skeleton className="mt-2 h-3 w-72" />
    </div>
  );
}

// Student list (Top/Low usage) skeleton.
export function StudentListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="card p-4 sm:p-5">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-2 h-3 w-56" />
      <ol className="mt-4 space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <li key={i} className="flex items-center gap-3 px-2 py-2">
            <Skeleton className="h-9 w-9" rounded="full" />
            <div className="flex-1 space-y-2">
              <div className="flex justify-between">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-3.5 w-12" />
              </div>
              <Skeleton className="h-1.5 w-full" rounded="full" />
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
