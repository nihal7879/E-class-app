import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { useCommandPalette } from "@/lib/commandPalette";
import { useFilter } from "@/lib/filterContext";
import { useAuth } from "@/lib/auth";
import FilterButton from "@/components/filters/FilterButton";

export default function Topbar() {
  const loc = useLocation();
  const nav = useNavigate();
  const { setOpen: setPaletteOpen } = useCommandPalette();
  const { reset: resetFilter } = useFilter();
  const { user, logout } = useAuth();
  const onDetail = loc.pathname.startsWith("/school/");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [menuOpen]);

  const initials = (user?.username ?? "")
    .split(/[.\s_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("") || "U";

  const handleBack = () => {
    resetFilter();
    nav("/dashboard");
  };

  const handleLogout = () => {
    setMenuOpen(false);
    resetFilter();
    logout();
    nav("/login", { replace: true });
  };

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 sm:px-6">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <Link
          to="/dashboard"
          className="flex shrink-0 items-center gap-2 rounded-lg pr-1 transition hover:opacity-90"
          aria-label="E-class Analytics — home"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-accent-400 to-accent-600 text-white shadow-md shadow-accent-500/30">
            <BoltIcon />
          </span>
          <span className="hidden leading-tight sm:block">
            <span className="block text-[13.5px] font-bold text-slate-900">
              E-class
            </span>
            <span className="block text-[10.5px] font-medium uppercase tracking-[0.14em] text-slate-500">
              Analytics
            </span>
          </span>
        </Link>

        <div className="hidden h-7 w-px bg-slate-200 sm:block" />

        {onDetail && (
          <button
            onClick={handleBack}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 sm:px-2.5 sm:py-1.5"
            aria-label="Back"
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
            <span className="hidden sm:inline">Back</span>
          </button>
        )}

        <div className="min-w-0">
          <h1 className="truncate text-[14px] font-semibold text-slate-900 sm:text-[15px]">
            {onDetail ? "School details" : "Institute Summary"}
          </h1>
          <p className="hidden truncate text-[11.5px] text-slate-500 sm:block">
            {onDetail
              ? "How students at this school are using the platform"
              : "Welcome back — here's what's happening across your schools"}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="hidden items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-500 transition hover:border-slate-300 hover:bg-white hover:text-slate-700 md:flex"
          aria-label="Search"
        >
          <SearchIcon />
          <span>Search schools…</span>
        </button>

        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:text-slate-900 md:hidden"
          aria-label="Search"
        >
          <SearchIcon />
        </button>

        <FilterButton />

        <div className="hidden h-7 w-px bg-slate-200 sm:block" />

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 rounded-full p-0.5 pr-1 transition hover:bg-slate-100"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <div className="hidden text-right leading-tight md:block">
              <div className="text-[12.5px] font-semibold text-slate-900">
                {user?.username ?? "Guest"}
              </div>
              <div className="truncate text-[11px] text-slate-500">
                {user?.instituteName ?? "—"}
              </div>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-accent-400 to-accent-600 text-[12px] font-bold text-white shadow-sm ring-2 ring-white">
              {initials}
            </div>
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-full z-30 mt-2 w-60 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-cardHover animate-popIn"
            >
              <div className="border-b border-slate-100 px-3.5 py-3">
                <div className="text-[12.5px] font-semibold text-slate-900">
                  {user?.username}
                </div>
                <div className="mt-0.5 truncate text-[11.5px] text-slate-500">
                  {user?.instituteName}
                </div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-[12.5px] font-medium text-slate-700 transition hover:bg-slate-50"
                role="menuitem"
              >
                <LogoutIcon />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function BoltIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
    </svg>
  );
}
function SearchIcon() {
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
    >
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
function LogoutIcon() {
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
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}
