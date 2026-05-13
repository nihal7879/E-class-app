import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import clsx from "clsx";
import { availableFilterOptions } from "@/lib/aggregations";
import { useFilter } from "@/lib/filterContext";
import {
  MONTH_LABELS,
  formatCourseLabel,
  schoolId,
  shortSchoolName,
} from "@/lib/parse";
import { useIsSm } from "@/lib/useMediaQuery";
import MultiSelect from "./MultiSelect";
import SingleSelect from "./SingleSelect";

interface Pos {
  top: number;
  left?: number;
  right?: number;
  width?: number;
  maxHeight: number;
}

export default function FilterButton() {
  const { filter, setFilter, reset, hasActive } = useFilter();
  const loc = useLocation();
  const nav = useNavigate();
  const isSm = useIsSm();
  const onDetail = loc.pathname.startsWith("/school/");
  const available = useMemo(() => availableFilterOptions(filter), [filter]);
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<Pos | null>(null);

  const activeCount =
    (filter.month !== "all" ? 1 : 0) +
    filter.schools.length +
    filter.courses.length +
    filter.divisions.length +
    filter.genders.length;

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const compute = () => {
      const r = buttonRef.current!.getBoundingClientRect();
      const viewportH = window.innerHeight;
      const top = r.bottom + 10;
      const maxHeight = Math.min(viewportH - top - 12, 640);
      if (isSm) {
        // Desktop: dropdown anchored under the button (right-aligned).
        setPos({
          top,
          right: Math.max(8, window.innerWidth - r.right),
          width: 420,
          maxHeight,
        });
      } else {
        // Mobile: full-width sheet, ~8px margin each side.
        setPos({ top, left: 8, right: 8, maxHeight });
      }
    };
    compute();
    window.addEventListener("scroll", compute, true);
    window.addEventListener("resize", compute);
    return () => {
      window.removeEventListener("scroll", compute, true);
      window.removeEventListener("resize", compute);
    };
  }, [open, isSm]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (buttonRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
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
    ...available.years.map((y) => ({ value: y, label: String(y) })),
  ];

  const monthOptions = [
    { value: "all" as const, label: "All months" },
    ...available.months.map((m) => ({ value: m, label: MONTH_LABELS[m - 1] })),
  ];

  const handleSchoolChange = (next: string[]) => {
    setFilter((f) => ({ ...f, schools: next }));
    if (onDetail) {
      if (next.length === 1) {
        nav(`/school/${schoolId(next[0])}`);
      } else if (next.length === 0) {
        nav("/dashboard");
      }
    }
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          "relative inline-flex items-center gap-1.5 rounded-full border bg-white px-2.5 py-1.5 text-xs font-semibold transition sm:px-3.5",
          open || hasActive
            ? "border-accent-300 text-accent-700 ring-2 ring-accent-100"
            : "border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50",
        )}
        aria-expanded={open}
        aria-label="Filters"
      >
        <FunnelIcon />
        <span className="hidden sm:inline">Filters</span>
        {activeCount > 0 && (
          <span className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-accent-600 px-1 text-[10px] font-bold text-white sm:ml-1">
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
              left: pos.left,
              right: pos.right,
              width: pos.width,
              maxWidth: "calc(100vw - 16px)",
              maxHeight: pos.maxHeight,
              zIndex: 900,
            }}
            className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-cardHover animate-popIn"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent-50 text-accent-600">
                  <FunnelIcon />
                </span>
                <div className="min-w-0">
                  <div className="text-[13.5px] font-semibold text-slate-900">
                    Filters
                  </div>
                  <div className="truncate text-[11px] text-slate-500">
                    Only showing options that exist in your data
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="shrink-0 rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close"
              >
                <CloseIcon />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-thin">
              <div className="grid grid-cols-1 gap-3 px-4 py-4 sm:grid-cols-2">
                {available.years.length > 0 && (
                  <SingleSelect
                    label="Year"
                    options={yearOptions}
                    value={filter.year}
                    onChange={(v) => setFilter((f) => ({ ...f, year: v }))}
                  />
                )}
                {available.months.length > 0 && (
                  <SingleSelect
                    label="Month"
                    options={monthOptions}
                    value={filter.month}
                    onChange={(v) => setFilter((f) => ({ ...f, month: v }))}
                  />
                )}
                {available.schools.length > 0 && (
                  <div className="sm:col-span-2">
                    <MultiSelect
                      label="School"
                      options={available.schools}
                      value={filter.schools}
                      onChange={handleSchoolChange}
                      placeholder="All schools"
                      formatOption={(o) => shortSchoolName(o, 36)}
                    />
                  </div>
                )}
                {available.courses.length > 0 && (
                  <div className="sm:col-span-2">
                    <MultiSelect
                      label="Course"
                      options={available.courses}
                      value={filter.courses}
                      onChange={(next) =>
                        setFilter((f) => ({ ...f, courses: next }))
                      }
                      placeholder="All courses"
                      formatOption={formatCourseLabel}
                    />
                  </div>
                )}
                {available.divisions.length > 0 && (
                  <MultiSelect
                    label="Division"
                    options={available.divisions}
                    value={filter.divisions}
                    onChange={(next) =>
                      setFilter((f) => ({ ...f, divisions: next }))
                    }
                    placeholder="All divisions"
                  />
                )}
                {available.genders.length > 0 && (
                  <MultiSelect
                    label="Gender"
                    options={available.genders}
                    value={filter.genders}
                    onChange={(next) =>
                      setFilter((f) => ({ ...f, genders: next }))
                    }
                    placeholder="All"
                  />
                )}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/60 px-4 py-2.5">
              <button
                type="button"
                onClick={reset}
                disabled={!hasActive && filter.year === (available.years[0] ?? "all")}
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
