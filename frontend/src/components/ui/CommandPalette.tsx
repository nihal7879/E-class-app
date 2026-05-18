import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import clsx from "clsx";
import { useCommandPalette } from "@/lib/commandPalette";
import { getCatalogue } from "@/lib/aggregations";
import { schoolId } from "@/lib/parse";

interface Item {
  kind: "school" | "nav";
  label: string;
  hint?: string;
  onSelect: () => void;
}

export default function CommandPalette() {
  const { open, setOpen } = useCommandPalette();
  const nav = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const cat = useMemo(() => getCatalogue(), []);

  const allItems: Item[] = useMemo(() => {
    const navItems: Item[] = [
      {
        kind: "nav",
        label: "Go to Institute Summary",
        hint: "Dashboard",
        onSelect: () => nav("/dashboard"),
      },
    ];
    const schoolItems: Item[] = cat.schools.map((s) => ({
      kind: "school",
      label: s,
      hint: "School detail",
      onSelect: () => nav(`/school/${schoolId(s)}`),
    }));
    return [...navItems, ...schoolItems];
  }, [cat.schools, nav]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allItems.slice(0, 50);
    return allItems
      .filter((it) => it.label.toLowerCase().includes(q))
      .slice(0, 50);
  }, [allItems, query]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setActive(0);
    }
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  // Keep highlighted row in view.
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-cmd-row="${active}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  if (!open) return null;

  const choose = (i: number) => {
    const it = filtered[i];
    if (!it) return;
    setOpen(false);
    it.onSelect();
  };

  const onKey: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(filtered.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(active);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[1000] flex items-start justify-center px-4 pt-[8vh]"
      onKeyDown={onKey}
    >
      <button
        type="button"
        aria-label="Close palette"
        onClick={() => setOpen(false)}
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm animate-fadeIn"
      />

      <div className="relative w-full max-w-xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-cardHover animate-popIn">
        <div className="flex items-center gap-2 border-b border-slate-100 px-3.5 py-2.5">
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
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Jump to a school or action…"
            className="flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 outline-none"
          />
          <span className="kbd">ESC</span>
        </div>

        <div
          ref={listRef}
          className="max-h-[60vh] overflow-y-auto scrollbar-thin py-1.5"
        >
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-400">
              No matches for "{query}"
            </div>
          ) : (
            <ul>
              {filtered.map((it, i) => (
                <li key={`${it.kind}-${it.label}`}>
                  <button
                    type="button"
                    data-cmd-row={i}
                    onMouseMove={() => setActive(i)}
                    onClick={() => choose(i)}
                    className={clsx(
                      "flex w-full items-center gap-3 px-3.5 py-2 text-left text-[13px] transition",
                      active === i
                        ? "bg-accent-50"
                        : "hover:bg-slate-50",
                    )}
                  >
                    <span
                      className={clsx(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-md ring-1 ring-inset",
                        it.kind === "school"
                          ? "bg-indigo-50 text-indigo-700 ring-indigo-200"
                          : "bg-slate-50 text-slate-700 ring-slate-200",
                      )}
                    >
                      {it.kind === "school" ? (
                        <SchoolGlyph />
                      ) : (
                        <ArrowGlyph />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-slate-900">
                        {it.label}
                      </div>
                      {it.hint && (
                        <div className="truncate text-[11px] text-slate-500">
                          {it.hint}
                        </div>
                      )}
                    </div>
                    {active === i && <span className="kbd">↵</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/60 px-3.5 py-1.5 text-[10.5px] text-slate-500">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1">
              <span className="kbd">↑</span>
              <span className="kbd">↓</span> navigate
            </span>
            <span className="flex items-center gap-1">
              <span className="kbd">↵</span> select
            </span>
          </div>
          <span className="num">
            {filtered.length} of {allItems.length}
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function SchoolGlyph() {
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
      <path d="M3 21h18" />
      <path d="M5 21V8l7-4 7 4v13" />
      <path d="M10 21v-5h4v5" />
    </svg>
  );
}
function ArrowGlyph() {
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
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}
