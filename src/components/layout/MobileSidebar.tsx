import { useEffect } from "react";
import { createPortal } from "react-dom";
import { NavLink, useLocation } from "react-router-dom";
import clsx from "clsx";

const NAV = [
  { to: "/dashboard", label: "Institute Summary", icon: BarsIcon, available: true },
  { to: "#", label: "Video Analytics", icon: VideoIcon, available: false },
  { to: "#", label: "MCQ Analytics", icon: QuizIcon, available: false },
  { to: "#", label: "Engagement", icon: SparkIcon, available: false },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function MobileSidebar({ isOpen, onClose }: Props) {
  const { pathname } = useLocation();

  useEffect(() => {
    if (isOpen) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex lg:hidden">
      <button
        type="button"
        aria-label="Close menu"
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px] animate-fadeIn"
      />
      <aside className="relative flex w-64 max-w-[82vw] flex-col overflow-hidden border-r border-ink-700/40 bg-ink-950 text-slate-200 animate-popIn">
        <div className="flex h-16 items-center justify-between gap-2 px-5">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-accent-400 to-accent-600 text-white shadow-lg shadow-accent-500/30">
              <BoltIcon />
            </div>
            <div>
              <div className="text-sm font-bold leading-tight text-white">
                E-class
              </div>
              <div className="text-[11px] uppercase tracking-wider text-slate-400">
                Analytics
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-300 transition hover:bg-white/10"
            aria-label="Close menu"
          >
            <CloseIcon />
          </button>
        </div>

        <nav className="mt-2 flex-1 overflow-y-auto px-3 scrollbar-thin">
          <div className="px-2 pb-2 pt-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Modules
          </div>
          <ul className="space-y-1">
            {NAV.map((item) => {
              const Icon = item.icon;
              if (!item.available) {
                return (
                  <li key={item.label}>
                    <div className="flex cursor-not-allowed items-center justify-between rounded-lg px-3 py-2 text-sm text-slate-400">
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
                    onClick={onClose}
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
    </div>,
    document.body,
  );
}

function BoltIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
    </svg>
  );
}
function CloseIcon() {
  return (
    <svg
      width="16"
      height="16"
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
