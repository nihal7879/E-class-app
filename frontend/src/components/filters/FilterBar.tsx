import { useMemo } from "react";
import { getCatalogue } from "@/lib/aggregations";
import { useFilter } from "@/lib/filterContext";
import { MONTH_LABELS, shortSchoolName } from "@/lib/parse";
import MultiSelect from "./MultiSelect";
import SingleSelect from "./SingleSelect";

export default function FilterBar() {
  const { filter, setFilter, reset, hasActive } = useFilter();
  const cat = useMemo(() => getCatalogue(), []);

  const yearOptions = [
    { value: "all" as const, label: "All years" },
    ...cat.years.map((y) => ({ value: y, label: String(y) })),
  ];

  const monthOptions = [
    { value: "all" as const, label: "All months" },
    ...cat.months.map((m) => ({ value: m, label: MONTH_LABELS[m - 1] })),
  ];

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FilterIcon />
          <h3 className="text-sm font-semibold text-slate-800">Filters</h3>
        </div>
        <button
          type="button"
          onClick={reset}
          disabled={!hasActive && filter.year === (cat.years[0] ?? "all")}
          className="text-xs font-medium text-slate-500 transition hover:text-accent-600 disabled:cursor-not-allowed disabled:text-slate-300"
        >
          Reset filters
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-5">
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
        <MultiSelect
          label="School"
          options={cat.schools}
          value={filter.schools}
          onChange={(next) => setFilter((f) => ({ ...f, schools: next }))}
          placeholder="All schools"
          formatOption={(o) => shortSchoolName(o, 36)}
        />
        <MultiSelect
          label="Course"
          options={cat.courses}
          value={filter.courses}
          onChange={(next) => setFilter((f) => ({ ...f, courses: next }))}
          placeholder={cat.courses.length === 0 ? "No courses in data" : "All courses"}
        />
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            Device type
          </label>
          <div className="flex h-[38px] items-center justify-between rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-3 text-sm text-slate-400">
            <span>All devices</span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
              Soon
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function FilterIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-slate-400"
    >
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}
