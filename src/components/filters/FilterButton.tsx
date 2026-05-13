import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { getCatalogue } from "@/lib/aggregations";
import { useFilter } from "@/lib/filterContext";
import { MONTH_LABELS, formatCourseLabel, shortSchoolName } from "@/lib/parse";
import MultiSelect from "./MultiSelect";
import SingleSelect from "./SingleSelect";

export default function FilterButton() {
  const { filter, setFilter, reset, hasActive } = useFilter();
  const cat = useMemo(() => getCatalogue(), []);
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);

  const activeCount =
    (filter.month !== "all" ? 1 : 0) +
    filter.schools.length +
    filter.courses.length;

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const compute = () => {
      const r = buttonRef.current!.getBoundingClientRect();
      setPos({
        top: r.bottom + 10,
        right: Math.max(8, window.innerWidth - r.right),
      });
    };
    compute();
    window.addEventListener("scroll", compute, true);
    window.addEventListener("resize", compute);
    return () => {
      window.removeEventListener("scroll", compute, true);
      window.removeEventListener("resize", compute);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (buttonRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      // If the click is inside a portalled MultiSelect panel (z-index 1000), keep open.
      const portalled = (t as HTMLElement).closest?.('[data-portal="multiselect"]');
      if (portalled) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const yearOptions = [
    { value: "all" as const, label: "All years" },
    ...cat.years.map((y) => ({ value: y, label: String(y) })),
  ];

  const monthOptions = [
    { value: "all" as const, label: "All months" },
    ...cat.months.map((m) => ({ value: m, label: MONTH_LABELS[m - 1] })),
  ];

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          "relative inline-flex items-center gap-1.5 rounded-full border bg-white px-3.5 py-1.5 text-xs font-semibold transition",
          open || hasActive
            ? "border-accent-300 text-accent-700 ring-2 ring-accent-100"
            : "border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50",
        )}
        aria-expanded={open}
      >
        <FunnelIcon />
        Filters
        {activeCount > 0 && (
          <span className="ml-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-accent-600 px-1 text-[10px] font-bold text-white">
            {activeCount}
          </span>
        )}
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            ref={panelRef}
            style={{
              position: "fixed",
              top: pos.top,
              right: pos.right,
              width: 420,
              maxWidth: "calc(100vw - 16px)",
              zIndex: 900,
            }}
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-cardHover animate-popIn"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-50 text-accent-600">
                  <FunnelIcon />
                </span>
                <div>
                  <div className="text-[13.5px] font-semibold text-slate-900">
                    Filters
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Narrow down what you see on the dashboard
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close"
              >
                <CloseIcon />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 px-4 py-4">
              <SingleSelect
                label="Year"
                options={yearOptions}
                value={filter.year}
                onChange={(v) => setFilter((f) => ({ ...f, year: v }))}
              />
              <SingleSelect
                label="Month"
                options={monthOptions}
                value={filter.month}
                onChange={(v) => setFilter((f) => ({ ...f, month: v }))}
              />
              <div className="col-span-2">
                <MultiSelect
                  label="School"
                  options={cat.schools}
                  value={filter.schools}
                  onChange={(next) =>
                    setFilter((f) => ({ ...f, schools: next }))
                  }
                  placeholder="All schools"
                  formatOption={(o) => shortSchoolName(o, 36)}
                />
              </div>
              <div className="col-span-2">
                <MultiSelect
                  label="Course"
                  options={cat.courses}
                  value={filter.courses}
                  onChange={(next) =>
                    setFilter((f) => ({ ...f, courses: next }))
                  }
                  placeholder={
                    cat.courses.length === 0
                      ? "No courses in data"
                      : "All courses"
                  }
                  formatOption={formatCourseLabel}
                />
              </div>
              <div className="col-span-2">
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Device type
                </label>
                <div className="flex h-[38px] items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-400">
                  <span>All devices</span>
                  <span className="rounded-full bg-slate-200/70 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                    Soon
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/60 px-4 py-2.5">
              <button
                type="button"
                onClick={reset}
                disabled={!hasActive && filter.year === (cat.years[0] ?? "all")}
                className="text-xs font-medium text-slate-500 transition hover:text-accent-600 disabled:cursor-not-allowed disabled:text-slate-300"
              >
                Reset all
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full bg-accent-600 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-accent-700"
              >
                Done
              </button>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

function FunnelIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}
function CloseIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
