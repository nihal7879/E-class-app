import { NavLink } from "react-router-dom";
import clsx from "clsx";

const NAV = [
  { to: "/dashboard", label: "Login Summary", icon: BarsIcon, available: true },
  { to: "#", label: "Video Analytics", icon: VideoIcon, available: false },
  { to: "#", label: "MCQ Analytics", icon: QuizIcon, available: false },
  { to: "#", label: "Engagement", icon: SparkIcon, available: false },
];

export default function Sidebar() {
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
      <div className="flex h-16 items-center gap-2.5 border-b border-slate-100 px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-accent-500 to-accent-700 text-white shadow-sm">
          <BoltIcon />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold text-slate-900">E-class</div>
          <div className="text-[11px] text-slate-500">Analytics</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 scrollbar-thin">
        <ul className="space-y-1">
          {NAV.map((item) => {
            const Icon = item.icon;
            if (!item.available) {
              return (
                <li key={item.label}>
                  <div className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-400">
                    <Icon />
                    <span className="flex-1">{item.label}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
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
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
                      isActive
                        ? "bg-accent-50 font-semibold text-accent-700"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                    )
                  }
                >
                  <Icon />
                  <span>{item.label}</span>
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-slate-100 p-3">
        <div className="rounded-xl bg-gradient-to-br from-accent-50 to-violet-50 p-3 ring-1 ring-accent-100">
          <div className="flex items-start gap-2">
            <span className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-md bg-white text-accent-600 shadow-sm">
              <HelpIcon />
            </span>
            <div className="min-w-0">
              <div className="text-[12.5px] font-semibold text-slate-900">
                Need a hand?
              </div>
              <div className="mt-0.5 text-[11px] leading-relaxed text-slate-600">
                Press{" "}
                <span className="kbd">⌘</span>{" "}
                <span className="kbd">K</span> to jump to any school.
              </div>
            </div>
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
function VideoIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="6" width="14" height="12" rx="2" />
      <polygon points="17 10 22 7 22 17 17 14 17 10" />
    </svg>
  );
}
function QuizIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2-3 4" />
      <line x1="12" y1="17" x2="12" y2="17.01" />
    </svg>
  );
}
function SparkIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" />
    </svg>
  );
}
function HelpIcon() {
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
      <circle cx="12" cy="12" r="10" />
      <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2-3 4" />
      <line x1="12" y1="17" x2="12" y2="17.01" />
    </svg>
  );
}
