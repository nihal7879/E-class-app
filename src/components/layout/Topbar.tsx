import { useLocation, useNavigate } from "react-router-dom";
import { useCommandPalette } from "@/lib/commandPalette";
import FilterButton from "@/components/filters/FilterButton";

export default function Topbar() {
  const loc = useLocation();
  const nav = useNavigate();
  const { setOpen: setPaletteOpen } = useCommandPalette();
  const onDetail = loc.pathname.startsWith("/school/");

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        {onDetail && (
          <button
            onClick={() => nav(-1)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            Back
          </button>
        )}

        <div className="min-w-0">
          <h1 className="truncate text-[15px] font-semibold text-slate-900">
            {onDetail ? "School details" : "Login Summary"}
          </h1>
          <p className="truncate text-[11.5px] text-slate-500">
            {onDetail
              ? "How students at this school are using the platform"
              : "Welcome back — here's what's happening across your schools"}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="hidden items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-500 transition hover:border-slate-300 hover:bg-white hover:text-slate-700 md:flex"
        >
          <SearchIcon />
          <span>Search schools…</span>
          <span className="kbd ml-1">⌘</span>
          <span className="kbd">K</span>
        </button>

        <FilterButton />

        <div className="h-7 w-px bg-slate-200" />

        <div className="flex items-center gap-2">
          <div className="hidden text-right leading-tight sm:block">
            <div className="text-[12.5px] font-semibold text-slate-900">
              Nirav Mehta
            </div>
            <div className="text-[11px] text-slate-500">Admin</div>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-accent-400 to-accent-600 text-[12px] font-bold text-white shadow-sm ring-2 ring-white">
            NM
          </div>
        </div>
      </div>
    </header>
  );
}

function SearchIcon() {
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
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
