import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";

interface MultiSelectProps {
  label: string;
  options: string[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  formatOption?: (opt: string) => string;
}

interface PanelPos {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
}

export default function MultiSelect({
  label,
  options,
  value,
  onChange,
  placeholder = "All",
  searchPlaceholder = "Search…",
  formatOption,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pos, setPos] = useState<PanelPos | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const compute = () => {
      const r = buttonRef.current!.getBoundingClientRect();
      const minWidth = Math.max(r.width, 260);
      const viewportW = window.innerWidth;
      const viewportH = window.innerHeight;
      const spaceBelow = viewportH - r.bottom - 12;
      const spaceAbove = r.top - 12;
      const wantHeight = 360;
      const openUp = spaceBelow < 220 && spaceAbove > spaceBelow;
      const maxHeight = Math.min(wantHeight, openUp ? spaceAbove : spaceBelow);
      const left = Math.min(r.left, viewportW - minWidth - 8);
      const top = openUp ? r.top - maxHeight - 8 : r.bottom + 8;
      setPos({ top, left: Math.max(8, left), width: minWidth, maxHeight });
    };
    compute();
    const onScroll = () => compute();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
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

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [query, options]);

  const toggle = (opt: string) => {
    onChange(value.includes(opt) ? value.filter((v) => v !== opt) : [...value, opt]);
  };

  const summary =
    value.length === 0
      ? placeholder
      : value.length === 1
        ? formatOption?.(value[0]) ?? value[0]
        : `${value.length} selected`;

  return (
    <div ref={rootRef} className="relative">
      <label className="mb-1 block text-xs font-medium text-slate-600">
        {label}
      </label>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          "flex w-full items-center justify-between gap-2 rounded-xl border bg-white px-3 py-2 text-left text-sm shadow-sm transition",
          "hover:border-slate-300",
          open ? "border-accent-500 ring-2 ring-accent-200" : "border-slate-200",
        )}
      >
        <span className={clsx("truncate", value.length === 0 && "text-slate-400")}>
          {summary}
        </span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={clsx("text-slate-500 transition-transform", open && "rotate-180")}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            ref={panelRef}
            data-portal="multiselect"
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              width: pos.width,
              maxHeight: pos.maxHeight,
              zIndex: 1000,
            }}
            className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-cardHover animate-popIn"
          >
            <div className="border-b border-slate-100 p-2">
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-accent-400 focus:ring-2 focus:ring-accent-200"
              />
            </div>
            <div className="flex items-center justify-between px-3 py-1.5 text-xs text-slate-500">
              <span>
                {value.length} of {options.length} selected
              </span>
              <button
                type="button"
                onClick={() => onChange([])}
                className="font-medium text-accent-600 hover:text-accent-700 disabled:text-slate-300"
                disabled={value.length === 0}
              >
                Clear
              </button>
            </div>
            <ul className="flex-1 overflow-auto scrollbar-thin">
              {filtered.length === 0 && (
                <li className="px-3 py-2 text-sm text-slate-400">No matches</li>
              )}
              {filtered.map((opt) => {
                const checked = value.includes(opt);
                return (
                  <li key={opt}>
                    <button
                      type="button"
                      onClick={() => toggle(opt)}
                      className={clsx(
                        "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition",
                        checked ? "bg-accent-50 text-accent-800" : "hover:bg-slate-50",
                      )}
                    >
                      <span
                        className={clsx(
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition",
                          checked
                            ? "border-accent-500 bg-accent-500 text-white"
                            : "border-slate-300 bg-white",
                        )}
                      >
                        {checked && (
                          <svg
                            width="10"
                            height="10"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </span>
                      <span className="truncate">{formatOption?.(opt) ?? opt}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>,
          document.body,
        )}
    </div>
  );
}
