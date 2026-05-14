import { NavLink } from "react-router-dom";
import clsx from "clsx";

const NAV = [
  { to: "/dashboard", label: "Institute Summary", icon: BarsIcon, available: true },
];

export default function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-ink-700/40 bg-ink-950 text-slate-200 lg:flex">
      <div className="flex h-16 items-center gap-2 px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-accent-400 to-accent-600 text-white shadow-lg shadow-accent-500/30">
          <BoltIcon />
        </div>
        <div>
          <div className="text-sm font-bold leading-tight text-white">E-class</div>
          <div className="text-[11px] uppercase tracking-wider text-slate-400">
            Analytics
          </div>
        </div>
      </div>

      <nav className="mt-2 flex-1 px-3">
        <div className="px-2 pb-2 pt-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Modules
        </div>
        <ul className="space-y-1">
          {NAV.map((item) => {
            const Icon = item.icon;
            if (!item.available) {
              return (
                <li key={item.label}>
                  <div
                    className="flex cursor-not-allowed items-center justify-between rounded-lg px-3 py-2 text-sm text-slate-400"
                    title="Coming soon"
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon />
                      {item.label}
                    </span>
                    <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-400 ring-1 ring-slate-700">
                      Soon
                    </span>
                  </div>
                </li>
              );
            }
            return (
              <li key={item.label}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    clsx(
                      "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition",
                      isActive
                        ? "bg-accent-500/15 text-white ring-1 ring-accent-500/40"
                        : "text-slate-300 hover:bg-white/5 hover:text-white",
                    )
                  }
                >
                  <Icon />
                  {item.label}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-white/5 p-4">
        <div className="rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
          <div className="text-xs font-semibold text-white">Data Source</div>
          <div className="mt-0.5 text-[11px] leading-relaxed text-slate-400">
            Login History + Video Usage exports
          </div>
        </div>
      </div>
    </aside>
  );
}

function BoltIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
    </svg>
  );
}
function BarsIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <line x1="6" y1="20" x2="6" y2="12" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="18" y1="20" x2="18" y2="9" />
    </svg>
  );
}
