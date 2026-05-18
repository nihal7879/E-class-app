import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type SyntheticEvent,
} from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import clsx from "clsx";
import { availableFilterOptions } from "@/lib/aggregations";
import { useFilter } from "@/lib/filterContext";
import {
  formatCourseLabel,
  schoolId,
  shortSchoolName,
} from "@/lib/parse";
import { useIsSm } from "@/lib/useMediaQuery";
import MultiSelect from "./MultiSelect";

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
    filter.schools.length +
    filter.courses.length +
    (filter.dateFrom || filter.dateTo ? 1 : 0);

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
                <div className="sm:col-span-2">
                  <DateRangeSection
                    minDate={available.minDate}
                    maxDate={available.maxDate}
                    dateFrom={filter.dateFrom}
                    dateTo={filter.dateTo}
                    onChange={(dateFrom, dateTo) =>
                      setFilter((f) => ({ ...f, dateFrom, dateTo }))
                    }
                  />
                </div>
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
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-4 py-2.5">
              <button
                type="button"
                onClick={reset}
                disabled={!hasActive}
                className="text-xs font-medium text-slate-500 transition hover:text-accent-600 disabled:cursor-not-allowed disabled:text-slate-300"
              >
                Reset all
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

function shiftDays(date: string, days: number): string {
  const d = new Date(date + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

interface DateRangeSectionProps {
  minDate: string;
  maxDate: string;
  dateFrom?: string;
  dateTo?: string;
  onChange: (from?: string, to?: string) => void;
}

function DateRangeSection({
  minDate,
  maxDate,
  dateFrom,
  dateTo,
  onChange,
}: DateRangeSectionProps) {
  const [mode, setMode] = useState<"single" | "range">(
    dateFrom && dateTo && dateFrom === dateTo ? "single" : "range",
  );

  const presets = useMemo(() => {
    if (!maxDate || !minDate) return [] as { label: string; from: string; to: string }[];
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    const todayStr = `${y}-${m}-${d}`;
    const lastDayOfMonth = String(
      new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate(),
    ).padStart(2, "0");
    return [
      {
        label: "Last 7 days",
        from: shiftDays(todayStr, -6),
        to: todayStr,
      },
      {
        label: "Last 30 days",
        from: shiftDays(todayStr, -29),
        to: todayStr,
      },
      {
        label: "This month",
        from: `${y}-${m}-01`,
        to: `${y}-${m}-${lastDayOfMonth}`,
      },
      { label: "All time", from: minDate, to: maxDate },
    ];
  }, [minDate, maxDate]);

  const applyPreset = (from: string, to: string) => {
    setMode("range");
    onChange(from, to);
  };

  const handleSingle = (v: string) => {
    if (!v) {
      onChange(undefined, undefined);
      return;
    }
    onChange(v, v);
  };

  const handleFrom = (v: string) => {
    const next = v || undefined;
    let to = dateTo;
    if (next && to && next > to) to = next;
    onChange(next, to);
  };

  const handleTo = (v: string) => {
    const next = v || undefined;
    let from = dateFrom;
    if (next && from && next < from) from = next;
    onChange(from, next);
  };

  const singleValue = dateFrom && dateFrom === dateTo ? dateFrom : "";
  const hasActive = Boolean(dateFrom || dateTo);

  const openPicker = (e: SyntheticEvent<HTMLInputElement>) => {
    const el = e.currentTarget as HTMLInputElement & { showPicker?: () => void };
    if (typeof el.showPicker === "function") {
      try {
        el.showPicker();
      } catch {
        // Some browsers throw if called without a user gesture — fail silently.
      }
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Date
        </span>
        <div className="flex items-center gap-1 rounded-full bg-white p-0.5 text-[11px] ring-1 ring-slate-200">
          <button
            type="button"
            onClick={() => {
              setMode("single");
              if (dateFrom && dateTo && dateFrom !== dateTo) onChange(dateFrom, dateFrom);
            }}
            className={clsx(
              "rounded-full px-2.5 py-0.5 font-medium transition",
              mode === "single"
                ? "bg-accent-600 text-white"
                : "text-slate-500 hover:text-slate-800",
            )}
          >
            Single date
          </button>
          <button
            type="button"
            onClick={() => setMode("range")}
            className={clsx(
              "rounded-full px-2.5 py-0.5 font-medium transition",
              mode === "range"
                ? "bg-accent-600 text-white"
                : "text-slate-500 hover:text-slate-800",
            )}
          >
            Range
          </button>
        </div>
      </div>

      {presets.length > 0 && mode === "range" && (
        <div className="mb-2.5 flex flex-wrap gap-1.5">
          {presets.map((p) => {
            const isAllTime = p.label === "All time";
            const isActive =
              (dateFrom === p.from && dateTo === p.to) ||
              (isAllTime && !dateFrom && !dateTo);
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => applyPreset(p.from, p.to)}
                className={clsx(
                  "rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition",
                  isActive
                    ? "border-accent-300 bg-accent-50 text-accent-700"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900",
                )}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      )}

      {mode === "single" ? (
        <input
          type="date"
          value={singleValue}
          onChange={(e) => handleSingle(e.target.value)}
          onClick={openPicker}
          className="w-full cursor-pointer rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:border-accent-400 focus:ring-2 focus:ring-accent-100"
        />
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block text-[10.5px] font-medium uppercase tracking-wide text-slate-500">
              From
            </span>
            <input
              type="date"
              value={dateFrom ?? ""}
              onChange={(e) => handleFrom(e.target.value)}
              onClick={openPicker}
              className="w-full cursor-pointer rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:border-accent-400 focus:ring-2 focus:ring-accent-100"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10.5px] font-medium uppercase tracking-wide text-slate-500">
              To
            </span>
            <input
              type="date"
              value={dateTo ?? ""}
              min={dateFrom || undefined}
              onChange={(e) => handleTo(e.target.value)}
              onClick={openPicker}
              className="w-full cursor-pointer rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:border-accent-400 focus:ring-2 focus:ring-accent-100"
            />
          </label>
        </div>
      )}

      {hasActive && (
        <div className="mt-2 flex items-center justify-between text-[11px]">
          <span className="text-slate-500">
            Overrides Year / Month selection
          </span>
          <button
            type="button"
            onClick={() => onChange(undefined, undefined)}
            className="font-medium text-slate-500 transition hover:text-accent-600"
          >
            Clear date
          </button>
        </div>
      )}
    </div>
  );
}
