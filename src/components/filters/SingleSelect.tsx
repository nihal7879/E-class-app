import clsx from "clsx";

interface Option<T extends string | number> {
  value: T;
  label: string;
}

interface SingleSelectProps<T extends string | number> {
  label: string;
  options: Option<T>[];
  value: T;
  onChange: (next: T) => void;
}

export default function SingleSelect<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: SingleSelectProps<T>) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">
        {label}
      </label>
      <div className="relative">
        <select
          value={String(value)}
          onChange={(e) => {
            const next = options.find((o) => String(o.value) === e.target.value);
            if (next) onChange(next.value);
          }}
          className={clsx(
            "w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 py-2 pr-9 text-sm shadow-sm transition",
            "hover:border-slate-300 focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-200",
          )}
        >
          {options.map((o) => (
            <option key={String(o.value)} value={String(o.value)}>
              {o.label}
            </option>
          ))}
        </select>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
    </div>
  );
}
