interface ErrorStateProps {
  /** What was being loaded, e.g. "KPIs", "MCQ results". */
  title: string;
  /** Raw error string thrown by the fetch helper. */
  error: string;
  /** Optional retry handler from AsyncState.refetch. */
  onRetry?: () => void;
  /** Card height — keep it close to the widget so the layout doesn't jump. */
  height?: number | string;
}

interface ParsedError {
  status: string | null;       // e.g. "500"
  statusText: string | null;   // e.g. "Internal Server Error"
  endpoint: string | null;     // e.g. "/api/kpis"
  detail: string | null;       // body text after the colon, if any
  network: boolean;            // true → fetch could not reach the server
}

// Parse the shape produced by api.ts:
//   "<status> <statusText> — <path>[: <body>]"
// and the browser's network-failure messages.
function parseError(raw: string): ParsedError {
  const network =
    /failed to fetch|networkerror|load failed|fetch failed/i.test(raw);

  const m = raw.match(
    /^(\d{3})\s+([^—\-]+?)\s+[—-]\s+(\/[^\s:]+)(?::\s*([\s\S]+))?$/,
  );
  if (m) {
    return {
      status: m[1],
      statusText: m[2].trim(),
      endpoint: m[3],
      detail: m[4]?.trim() || null,
      network: false,
    };
  }
  return {
    status: null,
    statusText: null,
    endpoint: null,
    detail: raw,
    network,
  };
}

export default function ErrorState({
  title,
  error,
  onRetry,
  height,
}: ErrorStateProps) {
  const p = parseError(error);
  const heading = p.network
    ? `Can't reach the server`
    : p.status
      ? `Couldn't load ${title}`
      : `Something went wrong loading ${title}`;
  const subline = p.network
    ? "The backend at /api isn't responding. Check that the server is running."
    : p.status
      ? `${p.status} ${p.statusText ?? ""}`.trim()
      : "Unexpected error";

  return (
    <div
      role="alert"
      style={typeof height === "number" ? { minHeight: height } : { minHeight: height }}
      className="rounded-xl border border-rose-200 bg-rose-50/60 p-4"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-600">
          <AlertIcon />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold text-rose-900">{heading}</div>
          <div className="mt-0.5 text-[12px] text-rose-700">{subline}</div>

          {(p.endpoint || p.detail) && (
            <div className="mt-2 space-y-1 text-[11.5px]">
              {p.endpoint && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-medium text-rose-600/80">Endpoint</span>
                  <code className="rounded bg-white/70 px-1.5 py-0.5 font-mono text-[11px] text-rose-800 ring-1 ring-rose-200">
                    {p.endpoint}
                  </code>
                </div>
              )}
              {p.detail && (
                <details className="text-rose-700/90">
                  <summary className="cursor-pointer select-none font-medium text-rose-700 hover:text-rose-800">
                    Details
                  </summary>
                  <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-white/60 p-2 font-mono text-[11px] text-rose-800 ring-1 ring-rose-200">
                    {p.detail}
                  </pre>
                </details>
              )}
            </div>
          )}
        </div>

        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-rose-300 bg-white px-2.5 py-1.5 text-[11.5px] font-semibold text-rose-700 transition hover:bg-rose-100"
          >
            <RetryIcon />
            Retry
          </button>
        )}
      </div>
    </div>
  );
}

function AlertIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function RetryIcon() {
  return (
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
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  );
}
