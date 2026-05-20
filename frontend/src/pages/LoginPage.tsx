import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { INSTITUTES, useAuth } from "@/lib/auth";

const BRAND = "#4338ca"; // indigo button — matches Vertex spec
const PURPLE = "#7c3aed"; // accent for "institute" word

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = (location.state as { from?: string } | null)?.from ?? "/dashboard";

  const [instituteId, setInstituteId] = useState<string>("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formPanelRef = useRef<HTMLElement>(null);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);

  // Card cycle: chips fly in from corners → idle floating near card → fly back to corners + card crossfades → repeat.
  const [cardIndex, setCardIndex] = useState(0); // 0 = Course Performance, 1 = Analytics
  const [chipsAtCard, setChipsAtCard] = useState(false); // false = at corner (hidden), true = at card (visible, floating)

  useEffect(() => {
    let cycleId: number | undefined;
    let swapTimeout: number | undefined;
    let returnTimeout: number | undefined;
    // First load: the sub-image (card) appears alone with the heading, then
    // after a clear pause the chips fly in.
    const firstFlyIn = window.setTimeout(() => setChipsAtCard(true), 2400);

    // Each cycle: chips fly out → card swaps and sits alone briefly → chips fly back in.
    const tick = () => {
      setChipsAtCard(false); // fly out (1300ms)
      swapTimeout = window.setTimeout(() => {
        setCardIndex((i) => (i === 0 ? 1 : 0)); // crossfade cards
      }, 1300);
      returnTimeout = window.setTimeout(() => {
        setChipsAtCard(true); // chips fly in to new card after a solo beat
      }, 3300);
    };
    cycleId = window.setInterval(tick, 9000);

    return () => {
      window.clearTimeout(firstFlyIn);
      if (swapTimeout) window.clearTimeout(swapTimeout);
      if (returnTimeout) window.clearTimeout(returnTimeout);
      if (cycleId) window.clearInterval(cycleId);
    };
  }, []);

  const selectedInstitute = useMemo(
    () => INSTITUTES.find((i) => i.id === instituteId) ?? null,
    [instituteId],
  );

  useEffect(() => {
    if (user) navigate(redirectTo, { replace: true });
  }, [user, redirectTo, navigate]);

  const handleMove = (e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setPointer({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const result = await login(instituteId, username, password);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    navigate(redirectTo, { replace: true });
  };

  return (
    <div className="relative flex h-screen w-full overflow-hidden bg-[#08091a] text-white">
      {/* ============== GLOBAL DARK BACKGROUND — spans the whole page ============== */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#1a2547] via-[#1f349b] to-[#08091a]" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(-45deg, rgba(255,255,255,0.9) 0 1px, transparent 1px 18px)",
        }}
      />
      <div className="pointer-events-none absolute -left-32 top-1/4 h-96 w-96 rounded-full bg-fuchsia-500/25 blur-[110px] animate-orbDrift" />
      <div className="pointer-events-none absolute -right-24 top-10 h-80 w-80 rounded-full bg-cyan-400/25 blur-[100px] animate-orbDriftAlt" />
      <div className="pointer-events-none absolute -bottom-28 left-1/3 h-96 w-96 rounded-full bg-accent-500/40 blur-[120px] animate-orbDrift" />
      <div className="pointer-events-none absolute right-[18%] bottom-[10%] h-80 w-80 rounded-full bg-purple-500/25 blur-[110px] animate-orbDriftAlt" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage:
            "radial-gradient(ellipse at center, black 30%, transparent 75%)",
        }}
      />

      {/* ============== LEFT BRAND PANEL ============== */}
      <aside className="relative hidden w-1/2 animate-slideInLeft flex-col overflow-hidden text-white lg:flex lg:px-10 lg:py-8">
        {/* Brand mark — text + image fade in together */}
        <div
          className="relative z-10 flex items-center gap-3 animate-slideInLeft"
          style={{ animationDelay: "400ms" }}
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/30 backdrop-blur-md">
            <BoltIcon />
          </span>
          <div className="leading-tight">
            <div className="text-[14px] font-bold tracking-tight">E-class</div>
            <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/70">
              Analytics
            </div>
          </div>
        </div>

        {/* Headline — fades up together with the brand and image */}
        <div className="relative z-10 mt-7 max-w-md animate-slideInLeft" style={{ animationDelay: "400ms" }}>
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/80 ring-1 ring-white/20 backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulseDot" />
            Education Intelligence
          </span>
          <h1 className="mt-4 text-[32px] font-bold leading-[1.08] tracking-tight">
            Unlock the full power of{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage:
                  "linear-gradient(90deg, #8eb2ff, #c084fc, #f0abfc, #8eb2ff)",
                backgroundSize: "200% 100%",
                animation: "shimmer 6s linear infinite",
              }}
            >
              your classroom
            </span>
          </h1>
          <p className="mt-3 max-w-[420px] text-[13px] leading-relaxed text-white/75">
            Sign in to track learning across schools, standards, and subjects —
            unified for instructors and institute leaders.
          </p>
        </div>

        {/* Card stage — animates in at the same time as the text */}
        <div
          className="relative z-10 mt-6 flex-1 animate-slideInLeft"
          style={{ animationDelay: "400ms" }}
        >
          <CardStage cardIndex={cardIndex} chipsAtCard={chipsAtCard} />
        </div>

        {/* Footer copyright */}
        <div
          className="relative z-10 mt-4 flex animate-slideInLeft justify-end text-[10px] uppercase tracking-[0.15em] text-white/35"
          style={{ animationDelay: "400ms" }}
        >
          © 2026 E-class Analytics
        </div>
      </aside>

      {/* ============== RIGHT FORM PANEL — floating card on dark theme ============== */}
      <main
        ref={formPanelRef}
        onMouseMove={handleMove}
        onMouseLeave={() => setPointer(null)}
        className="relative flex w-full animate-slideInRight items-center justify-center overflow-hidden px-4 py-6 sm:px-6 lg:w-1/2"
        style={{ animationDelay: "500ms" }}
      >
        {/* Top loader sweep */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-[3px] overflow-hidden">
          <span
            className="block h-full w-1/3 animate-loaderSweep"
            style={{
              background: `linear-gradient(90deg, transparent, ${BRAND}, transparent)`,
            }}
          />
        </div>

        {/* Cursor spotlight (subtle, on dark) */}
        {pointer && (
          <div
            className="pointer-events-none absolute h-[420px] w-[420px] rounded-full transition-opacity duration-200"
            style={{
              left: pointer.x - 210,
              top: pointer.y - 210,
              background:
                "radial-gradient(circle, rgba(140,170,255,0.16) 0%, rgba(140,170,255,0) 65%)",
              filter: "blur(8px)",
            }}
          />
        )}

        {/* Floating login card */}
        <div className="relative z-10 w-full max-w-[420px] rounded-[28px] border border-white/10 bg-white p-7 shadow-[0_40px_80px_-30px_rgba(0,0,0,0.7),0_18px_36px_-16px_rgba(0,0,0,0.55)] ring-1 ring-black/[0.03]">
          {/* Mobile logo */}
          <div className="mb-5 flex items-center gap-2 lg:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-accent-400 to-accent-600 text-white shadow-md shadow-accent-500/30">
              <BoltIcon />
            </span>
            <span className="text-[14px] font-bold tracking-tight text-slate-900">
              E-class Analytics
            </span>
          </div>

          {/* Welcome pill */}
          <div
            className="mb-3 inline-flex animate-slideInRight items-center gap-1.5 rounded-full bg-accent-50 px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wide text-accent-700 ring-1 ring-accent-100"
            style={{ animationDelay: "560ms" }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-accent-600 animate-pulseDot" />
            Welcome back
          </div>

          {/* Title */}
          <div className="animate-slideInRight" style={{ animationDelay: "660ms" }}>
            <h2 className="text-[26px] font-bold leading-tight tracking-tight text-slate-900">
              Sign in to your{" "}
              <span style={{ color: PURPLE }}>institute</span>
            </h2>
            <p className="mt-1.5 text-[12.5px] text-slate-500">
              Choose your institute and enter your credentials to continue.
            </p>
          </div>

          <form onSubmit={onSubmit} className="mt-5 space-y-3">
            {/* Institute */}
            <div className="animate-slideInRight" style={{ animationDelay: "760ms" }}>
              <FieldLabel htmlFor="institute">Institute</FieldLabel>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <BuildingIcon />
                </span>
                <select
                  id="institute"
                  value={instituteId}
                  onChange={(e) => setInstituteId(e.target.value)}
                  className="block w-full appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-9 text-[13px] text-slate-900 outline-none transition focus:border-accent-400 focus:ring-2 focus:ring-accent-100"
                  required
                >
                  <option value="" disabled>
                    Select your institute…
                  </option>
                  {INSTITUTES.map((inst) => (
                    <option key={inst.id} value={inst.id}>
                      {inst.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>
            </div>

            {/* Username */}
            <div className="animate-slideInRight" style={{ animationDelay: "860ms" }}>
              <FieldLabel htmlFor="username">Username</FieldLabel>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <PersonIcon />
                </span>
                <input
                  id="username"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="owner@jms.com"
                  className="block w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-[13px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-accent-400 focus:ring-2 focus:ring-accent-100"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="animate-slideInRight" style={{ animationDelay: "960ms" }}>
              <div className="mb-1.5 flex items-center justify-between">
                <FieldLabel htmlFor="password" inline>
                  Password
                </FieldLabel>
                <a
                  href="#"
                  onClick={(e) => e.preventDefault()}
                  className="text-[11px] font-medium transition hover:underline"
                  style={{ color: BRAND }}
                >
                  Forgot password?
                </a>
              </div>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <LockIcon />
                </span>
                <input
                  id="password"
                  type={showPwd ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="block w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-10 text-[13px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-accent-400 focus:ring-2 focus:ring-accent-100"
                  required
                  minLength={4}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  aria-label={showPwd ? "Hide password" : "Show password"}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                >
                  {showPwd ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>

            {/* Keep me signed in */}
            <label
              className="flex animate-slideInRight cursor-pointer select-none items-center gap-2 text-[12.5px] text-slate-700"
              style={{ animationDelay: "1060ms" }}
            >
              <input
                type="checkbox"
                checked={keepSignedIn}
                onChange={(e) => setKeepSignedIn(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-accent-600 accent-accent-600 focus:ring-accent-300"
              />
              Keep me signed in
            </label>

            {error && (
              <div className="animate-fadeIn rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-[12px] font-medium text-rose-700">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={busy}
              style={{
                animationDelay: "1160ms",
                backgroundColor: BRAND,
              }}
              className="group relative mt-1 flex w-full animate-slideInRight items-center justify-center gap-2 overflow-hidden rounded-xl px-5 py-2.5 text-[13.5px] font-semibold text-white shadow-lg shadow-indigo-500/30 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-indigo-500/40 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <span
                className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full"
                aria-hidden="true"
              />
              <span className="relative inline-flex items-center gap-2">
                {busy ? (
                  <>
                    <Spinner /> Signing in…
                  </>
                ) : (
                  <>
                    Sign in <ArrowRightIcon />
                  </>
                )}
              </span>
            </button>
          </form>

          <p
            className="mt-4 animate-slideInRight text-center text-[11.5px] text-slate-500"
            style={{ animationDelay: "1260ms" }}
          >
            Need access?{" "}
            {selectedInstitute ? (
              <span className="font-medium text-slate-700">
                Contact {selectedInstitute.name} administrator.
              </span>
            ) : (
              "Contact your institute administrator."
            )}
          </p>
        </div>
      </main>
    </div>
  );
}

/* ===================== Components ===================== */

function FieldLabel({
  htmlFor,
  children,
  inline,
}: {
  htmlFor: string;
  children: React.ReactNode;
  inline?: boolean;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={
        (inline ? "" : "mb-1.5 ") +
        "block text-[12px] font-medium text-slate-700"
      }
    >
      {children}
    </label>
  );
}

/* ============ Card stage — two cards alternate, four chips fly in/out ============ */

type CornerKey = "tl" | "tr" | "bl" | "br";

type ChipDef = {
  label: string;
  iconColor: string;
  icon: React.ReactNode;
  corner: CornerKey;
  // Idle position (when chips are at the card)
  idle: { top?: string; left?: string; right?: string; bottom?: string };
  // Float animation while idle
  float: "animate-floatY" | "animate-floatYDelay" | "animate-floatYSlow";
};

// Idle positions sit at the card's four corners so the chips visibly cross /
// overlap the sub-image edge — matching the Vertex reference flow.
const CHIPS: ChipDef[] = [
  {
    label: "Schools",
    iconColor: "#4338ca",
    icon: <SchoolIcon />,
    corner: "tl",
    idle: { top: "10%", left: "10%" },
    float: "animate-floatY",
  },
  {
    label: "Subjects",
    iconColor: "#7c3aed",
    icon: <BookIcon />,
    corner: "tr",
    idle: { top: "8%", right: "10%" },
    float: "animate-floatYDelay",
  },
  {
    label: "Standards",
    iconColor: "#0ea5e9",
    icon: <StarIcon />,
    corner: "bl",
    idle: { top: "55%", left: "6%" },
    float: "animate-floatYSlow",
  },
  {
    label: "Live Feed",
    iconColor: "#16a34a",
    icon: <PlayIcon />,
    corner: "br",
    idle: { top: "50%", right: "8%" },
    float: "animate-floatY",
  },
];

// Direction each chip flies toward its origin corner.
const EXIT_TRANSFORMS: Record<CornerKey, string> = {
  tl: "translate(-260%, -220%) scale(0.55)",
  tr: "translate(260%, -220%) scale(0.55)",
  bl: "translate(-260%, 220%) scale(0.55)",
  br: "translate(260%, 220%) scale(0.55)",
};

function CardStage({
  cardIndex,
  chipsAtCard,
}: {
  cardIndex: number;
  chipsAtCard: boolean;
}) {
  return (
    <div className="relative h-full min-h-[280px] w-full">
      {/* Card 0 — Course Performance bar chart */}
      <CardLayer visible={cardIndex === 0}>
        <CoursePerformanceCard />
      </CardLayer>

      {/* Card 1 — Analytics dashboard (line + counters + horizontal bars) */}
      <CardLayer visible={cardIndex === 1}>
        <AnalyticsCard />
      </CardLayer>

      {/* Chips — same four, fly in from corners → idle floating → fly back */}
      {CHIPS.map((chip) => (
        <FlyingChip key={chip.label} chip={chip} visible={chipsAtCard} />
      ))}
    </div>
  );
}

function CardLayer({
  visible,
  children,
}: {
  visible: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className="absolute inset-0"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(18px)",
        transition:
          "opacity 1100ms ease, transform 1100ms cubic-bezier(.2,.7,.2,1)",
        pointerEvents: visible ? "auto" : "none",
      }}
    >
      {children}
    </div>
  );
}

function FlyingChip({ chip, visible }: { chip: ChipDef; visible: boolean }) {
  // When visible: at idle position (transform: none + float).
  // When hidden: translated toward its corner + scaled down + faded.
  const exit = EXIT_TRANSFORMS[chip.corner];
  return (
    <div
      className="absolute z-20"
      style={{
        ...chip.idle,
        transform: visible ? "translate(0,0) scale(1)" : exit,
        opacity: visible ? 1 : 0,
        transition:
          "transform 1300ms cubic-bezier(.34,1.2,.4,1), opacity 1000ms ease",
      }}
    >
      <div className={visible ? chip.float : undefined}>
        <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-800 shadow-[0_10px_24px_-12px_rgba(0,0,0,0.5)]">
          <span
            className="flex h-4 w-4 items-center justify-center"
            style={{ color: chip.iconColor }}
          >
            {chip.icon}
          </span>
          {chip.label}
        </div>
      </div>
    </div>
  );
}

/* ----- Card 0: Course Performance ----- */

function CoursePerformanceCard() {
  const bars = [
    { a: 50, b: 80 },
    { a: 28, b: 44 },
    { a: 38, b: 56 },
    { a: 24, b: 30 },
  ];
  const labels = ["Std 8", "Std 9", "Std 10", "Std 11"];
  return (
    <div className="absolute left-1/2 top-[14%] w-[86%] max-w-[440px] -translate-x-1/2 rounded-2xl bg-white p-4 text-slate-800 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.45),0_12px_24px_-12px_rgba(0,0,0,0.3)]">
      <div className="animate-floatYDelay">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-100">
              <ChartIcon />
            </span>
            <span className="text-[12px] font-semibold text-slate-900">
              Course Performance
            </span>
          </div>
          <span className="text-slate-400">
            <DotsIcon />
          </span>
        </div>
        <div className="mt-3 flex items-end gap-3">
          <div className="flex flex-1 items-end gap-3">
            {bars.map((bar, i) => (
              <div
                key={i}
                className="flex flex-1 flex-col items-center gap-1.5"
              >
                <div className="flex h-[80px] w-full items-end gap-1">
                  <div
                    className="flex-1 rounded-sm bg-slate-800"
                    style={{ height: `${bar.a}%` }}
                  />
                  <div
                    className="flex-1 rounded-sm"
                    style={{ height: `${bar.b}%`, backgroundColor: BRAND }}
                  />
                </div>
                <div className="truncate text-[9px] font-medium text-slate-500">
                  {labels[i]}
                </div>
              </div>
            ))}
          </div>
          <div className="ml-2 flex flex-col gap-1.5 text-[10px]">
            <LegendRow color={BRAND} label="Watch hrs" value="612" />
            <LegendRow color="#0f172a" label="MCQ avg" value="78%" />
            <LegendRow color="#94a3b8" label="Attempts" value="9.1K" />
          </div>
        </div>
        <div className="absolute -bottom-3 right-10">
          <div
            className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-semibold text-white shadow-md"
            style={{ backgroundColor: BRAND }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulseDot" />
            Live · 42 students
          </div>
        </div>
      </div>
    </div>
  );
}

/* ----- Card 1: Analytics dashboard ----- */

function AnalyticsCard() {
  // Mini line chart points (normalized 0–100 within 200×60 viewBox).
  const linePoints = [
    [0, 42],
    [22, 35],
    [44, 48],
    [66, 22],
    [88, 30],
    [110, 14],
    [132, 24],
    [154, 10],
    [176, 18],
    [200, 6],
  ];
  const linePath = linePoints
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p[0]} ${p[1]}`)
    .join(" ");
  const areaPath = `${linePath} L 200 60 L 0 60 Z`;

  const hBars = [
    { label: "Maths", value: 92, color: BRAND },
    { label: "Physics", value: 86, color: "#7c3aed" },
    { label: "Biology", value: 74, color: "#0ea5e9" },
    { label: "Chemistry", value: 68, color: "#f59e0b" },
  ];

  return (
    <div className="absolute left-1/2 top-[14%] w-[86%] max-w-[440px] -translate-x-1/2 rounded-2xl bg-white p-4 text-slate-800 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.45),0_12px_24px_-12px_rgba(0,0,0,0.3)]">
      <div className="animate-floatYDelay">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className="flex h-6 w-6 items-center justify-center rounded-md text-white"
              style={{ backgroundColor: BRAND }}
            >
              <ChartIcon />
            </span>
            <span className="text-[12px] font-semibold text-slate-900">
              Analytics Dashboard
            </span>
          </div>
          <span className="text-slate-400">
            <DotsIcon />
          </span>
        </div>

        {/* Line chart */}
        <div className="mt-2.5 h-[58px] w-full">
          <svg
            viewBox="0 0 200 60"
            preserveAspectRatio="none"
            className="h-full w-full"
          >
            <defs>
              <linearGradient id="lineFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={BRAND} stopOpacity="0.35" />
                <stop offset="100%" stopColor={BRAND} stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={areaPath} fill="url(#lineFill)" />
            <path
              d={linePath}
              fill="none"
              stroke={BRAND}
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {linePoints.map((p, i) => (
              <circle
                key={i}
                cx={p[0]}
                cy={p[1]}
                r={i === linePoints.length - 1 ? 2.4 : 1.4}
                fill={i === linePoints.length - 1 ? BRAND : "#fff"}
                stroke={BRAND}
                strokeWidth="1"
              />
            ))}
          </svg>
        </div>

        {/* Stat counters */}
        <div className="mt-2 grid grid-cols-3 gap-2 rounded-lg bg-slate-50 px-2 py-2">
          <Counter label="Views" value="12.4K" />
          <Counter label="MCQ" value="78%" />
          <Counter label="HRS" value="612" />
        </div>

        {/* Horizontal bar chart */}
        <div className="mt-2.5 space-y-1.5">
          {hBars.map((row) => (
            <div key={row.label} className="flex items-center gap-2">
              <span className="w-[58px] text-[9.5px] font-medium text-slate-600">
                {row.label}
              </span>
              <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{ width: `${row.value}%`, backgroundColor: row.color }}
                />
              </div>
              <span className="w-[26px] text-right text-[9.5px] font-semibold text-slate-700">
                {row.value}%
              </span>
            </div>
          ))}
        </div>

        <div className="absolute -bottom-3 right-10">
          <div
            className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-semibold text-white shadow-md"
            style={{ backgroundColor: BRAND }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulseDot" />
            Live · 86% engaged
          </div>
        </div>
      </div>
    </div>
  );
}

function Counter({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-[14px] font-bold leading-none tracking-tight text-slate-900">
        {value}
      </span>
      <span className="mt-0.5 text-[8.5px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </span>
    </div>
  );
}

function LegendRow({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-slate-500">{label}</span>
      <span className="ml-auto font-semibold text-slate-700">{value}</span>
    </div>
  );
}

/* ===================== Icons ===================== */

function BookIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}
function SchoolIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 3 2 8l10 5 10-5-10-5zm0 7L4 6.5v4.7c0 .3.2.6.5.7L12 16l7.5-4.1c.3-.1.5-.4.5-.7V6.5L12 10z" />
    </svg>
  );
}
function PlayIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="6,4 20,12 6,20" />
    </svg>
  );
}
function QuizIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 1.5-2.5 2-2.5 3.5" />
      <line x1="12" y1="17" x2="12" y2="17.01" />
    </svg>
  );
}
function EyeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function EyeOffIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a19.79 19.79 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 7 11 7a19.66 19.66 0 0 1-3.17 4.16" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}
function ChevronDown({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}
function Spinner() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="animate-spin">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
function ChartIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <line x1="6" y1="20" x2="6" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="18" y1="20" x2="18" y2="14" />
    </svg>
  );
}
function DotsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="19" cy="12" r="1.6" />
    </svg>
  );
}
function BoltIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
    </svg>
  );
}
function StarIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="12,2 15,9 22,9.3 17,14 18.5,21 12,17.5 5.5,21 7,14 2,9.3 9,9" />
    </svg>
  );
}
function BuildingIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <line x1="9" y1="6" x2="9" y2="6.01" />
      <line x1="15" y1="6" x2="15" y2="6.01" />
      <line x1="9" y1="10" x2="9" y2="10.01" />
      <line x1="15" y1="10" x2="15" y2="10.01" />
      <line x1="9" y1="14" x2="9" y2="14.01" />
      <line x1="15" y1="14" x2="15" y2="14.01" />
      <path d="M10 22v-4h4v4" />
    </svg>
  );
}
function PersonIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
function LockIcon({ small }: { small?: boolean }) {
  const s = small ? 12 : 15;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}
function ArrowRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}
