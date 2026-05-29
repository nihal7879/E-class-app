import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { INSTITUTES, useAuth } from "@/lib/auth";

const BRAND = "#4338ca"; // indigo button — matches Vertex spec
const PURPLE = "#7c3aed"; // accent for "institute" word

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // Where to go after a successful sign-in: the page RequireAuth bounced the
  // user from (passed via router state), or the dashboard by default.
  const redirectTo = (location.state as { from?: string } | null)?.from ?? "/dashboard";

  const [instituteId, setInstituteId] = useState<string>("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
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
    // First load: card appears under the heading, then chips fly in 120ms apart.
    const firstFlyIn = window.setTimeout(() => setChipsAtCard(true), 1800);

    // ~5s loop: chips idle ~1s → fly out → card morph → chips fly back in.
    const tick = () => {
      setChipsAtCard(false); // fly out (850ms transition)
      swapTimeout = window.setTimeout(() => {
        setCardIndex((i) => (i === 0 ? 1 : 0));
      }, 700);
      returnTimeout = window.setTimeout(() => {
        setChipsAtCard(true);
      }, 1700);
    };
    cycleId = window.setInterval(tick, 5000);

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

  // If the user is already signed in (e.g. navigated to /login manually or
  // rehydrated from localStorage), skip the form and redirect straight away.
  useEffect(() => {
    if (user) navigate(redirectTo, { replace: true });
  }, [user, redirectTo, navigate]);

  const handleMove = (e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setPointer({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  // Submit handler: clears any prior error, flips the busy flag (disables the
  // button + shows the spinner), then delegates to the context's `login`.
  // On failure it surfaces the returned message inline; on success it routes to
  // `redirectTo`. (The effect above would also redirect once `user` is set —
  // this navigate just makes it immediate.)
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
        {/* Logo fades up first */}
        <div
          className="relative z-10 flex items-center gap-3 animate-slideInLeft"
          style={{ animationDelay: "700ms" }}
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

        {/* Education Intelligence badge */}
        <div className="relative z-10 mt-7 max-w-md">
          <span
            className="inline-flex animate-slideInLeft items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/80 ring-1 ring-white/20 backdrop-blur"
            style={{ animationDelay: "820ms" }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulseDot" />
            Education Intelligence
          </span>
          {/* Headline */}
          <h1
            className="mt-4 animate-slideInLeft text-[32px] font-bold leading-[1.08] tracking-tight"
            style={{ animationDelay: "940ms" }}
          >
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
          {/* Subtitle */}
          <p
            className="mt-3 max-w-[420px] animate-slideInLeft text-[13px] leading-relaxed text-white/75"
            style={{ animationDelay: "1060ms" }}
          >
            Sign in to track learning across schools, standards, and subjects —
            unified for instructors and institute leaders.
          </p>
        </div>

        {/* Card stage — first card slides up after the subtitle */}
        <div
          className="relative z-10 mt-6 flex-1 animate-slideInLeft"
          style={{ animationDelay: "1200ms" }}
        >
          <CardStage cardIndex={cardIndex} chipsAtCard={chipsAtCard} />
        </div>

        {/* Footer copyright */}
        <div
          className="relative z-10 mt-4 flex animate-slideInLeft justify-end text-[10px] uppercase tracking-[0.15em] text-white/35"
          style={{ animationDelay: "1400ms" }}
        >
          © 2026 E-class Analytics
        </div>
      </aside>

      {/* ============== RIGHT FORM PANEL ============== */}
      <main
        ref={formPanelRef}
        onMouseMove={handleMove}
        onMouseLeave={() => setPointer(null)}
        className="relative flex w-full animate-slideInRight items-center justify-center overflow-hidden bg-[#f4f6fb] px-4 py-6 sm:px-6 lg:w-1/2"
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

        {/* Decorative blobs */}
        <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-accent-200/40 blur-[90px] animate-orbDriftAlt" />
        <div className="pointer-events-none absolute -bottom-24 -right-16 h-80 w-80 rounded-full bg-fuchsia-200/40 blur-[100px] animate-orbDrift" />

        {/* Dot grid + cursor spotlight */}
        <div
          className="pointer-events-none absolute inset-0 opacity-50"
          style={{
            backgroundImage:
              "radial-gradient(rgba(99,102,241,0.18) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
            maskImage:
              "radial-gradient(ellipse at center, black 30%, transparent 75%)",
          }}
        />
        {pointer && (
          <div
            className="pointer-events-none absolute h-[420px] w-[420px] rounded-full transition-opacity duration-200"
            style={{
              left: pointer.x - 210,
              top: pointer.y - 210,
              background:
                "radial-gradient(circle, rgba(94,138,255,0.18) 0%, rgba(94,138,255,0) 65%)",
              filter: "blur(8px)",
            }}
          />
        )}

        <div className="relative z-10 w-full max-w-[420px]">
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
              <FieldLabel htmlFor="password">Password</FieldLabel>
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

          {/* Trust badge pills */}
          <div
            className="mt-4 flex animate-slideInRight items-center justify-center gap-2"
            style={{ animationDelay: "1260ms" }}
          >
            <TrustBadge icon={<LockIcon small />} label="Encrypted" />
            <TrustBadge icon={<ShieldIcon />} label="SSO ready" />
            <TrustBadge icon={<AuditIcon />} label="Audit log" />
          </div>

          <p
            className="mt-3 animate-slideInRight text-center text-[11.5px] text-slate-500"
            style={{ animationDelay: "1360ms" }}
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

function TrustBadge({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[10.5px] font-medium text-slate-600 ring-1 ring-slate-200/70">
      <span className="text-slate-400">{icon}</span>
      {label}
    </span>
  );
}

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
  // Stagger delay on the fly-in (120ms apart)
  enterDelay: number;
};

const CHIPS: ChipDef[] = [
  {
    label: "Schools",
    iconColor: "#4338ca",
    icon: <DiamondIcon />,
    corner: "tl",
    idle: { top: "10%", left: "10%" },
    float: "animate-floatY",
    enterDelay: 0,
  },
  {
    label: "Subjects",
    iconColor: "#7c3aed",
    icon: <TabletIcon />,
    corner: "tr",
    idle: { top: "8%", right: "10%" },
    float: "animate-floatYDelay",
    enterDelay: 120,
  },
  {
    label: "Standards",
    iconColor: "#0ea5e9",
    icon: <StarIcon />,
    corner: "bl",
    idle: { top: "55%", left: "6%" },
    float: "animate-floatYSlow",
    enterDelay: 240,
  },
  {
    label: "Live Feed",
    iconColor: "#16a34a",
    icon: <PlayIcon />,
    corner: "br",
    idle: { top: "50%", right: "8%" },
    float: "animate-floatY",
    enterDelay: 360,
  },
];

// Direction each chip flies toward its origin corner. Scale 0.5 on exit per spec.
const EXIT_TRANSFORMS: Record<CornerKey, string> = {
  tl: "translate(-260%, -220%) scale(0.5)",
  tr: "translate(260%, -220%) scale(0.5)",
  bl: "translate(-260%, 220%) scale(0.5)",
  br: "translate(260%, 220%) scale(0.5)",
};

function CardStage({
  cardIndex,
  chipsAtCard,
}: {
  cardIndex: number;
  chipsAtCard: boolean;
}) {
  // When cardIndex flips:
  //   0 = AnalyticsCard alone at full size.
  //   1 = AnalyticsCard shrinks and slots into the bottom-right of the
  //       Performance Hub, which fades in around it as the bigger image.
  const embeddedTransform =
    "translate(22%, 34%) scale(0.42) rotate(-3deg)";
  return (
    <div className="relative h-full min-h-[280px] w-full">
      {/* Performance Hub (the bigger image). Fades in behind AnalyticsCard. */}
      <BackdropLayer visible={cardIndex === 1}>
        <FullDashboardCard />
      </BackdropLayer>

      {/* Analytics card — always rendered. Morphs between full size and the
          shrunken "embedded" overlay slot on top of the Performance Hub. */}
      <MorphingAnalyticsLayer
        embeddedTransform={embeddedTransform}
        embedded={cardIndex === 1}
      />

      {/* Chips fly in from the four corners around the active composition */}
      {CHIPS.map((chip) => (
        <FlyingChip key={chip.label} chip={chip} visible={chipsAtCard} />
      ))}
    </div>
  );
}

function BackdropLayer({
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
        transform: visible ? "scale(1)" : "scale(0.94)",
        transformOrigin: "50% 50%",
        transition:
          "opacity 950ms ease, transform 950ms cubic-bezier(.4,.1,.2,1)",
        pointerEvents: visible ? "auto" : "none",
      }}
    >
      {children}
    </div>
  );
}

function MorphingAnalyticsLayer({
  embeddedTransform,
  embedded,
}: {
  embeddedTransform: string;
  embedded: boolean;
}) {
  return (
    <div
      className="absolute inset-0 z-[5]"
      style={{
        transform: embedded ? embeddedTransform : "translate(0,0) scale(1)",
        transformOrigin: "50% 50%",
        transition: "transform 950ms cubic-bezier(.4,.1,.2,1)",
      }}
    >
      <AnalyticsCard />
    </div>
  );
}

function FlyingChip({ chip, visible }: { chip: ChipDef; visible: boolean }) {
  const exit = EXIT_TRANSFORMS[chip.corner];
  // Stagger applies to entry (visible=true); exit fires simultaneously.
  const delay = visible ? `${chip.enterDelay}ms` : "0ms";
  return (
    <div
      className="absolute z-20"
      style={{
        ...chip.idle,
        transform: visible ? "translate(0,0) scale(1)" : exit,
        opacity: visible ? 1 : 0,
        transition:
          "transform 850ms cubic-bezier(.34,1.4,.4,1), opacity 700ms ease",
        transitionDelay: delay,
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

/* ----- Card 1: Performance Hub — a fresh, distinct dashboard image ----- */

function FullDashboardCard() {
  // Donut score
  const score = 78;
  const r = 18;
  const c = 2 * Math.PI * r;
  // Multi-bar weekly trend
  const week = [
    { d: "Mon", v: 62 },
    { d: "Tue", v: 78 },
    { d: "Wed", v: 54 },
    { d: "Thu", v: 88 },
    { d: "Fri", v: 72 },
    { d: "Sat", v: 46 },
    { d: "Sun", v: 64 },
  ];
  // Stacked bar segments
  const stack = [
    { label: "Maths", value: 32, color: BRAND },
    { label: "Physics", value: 26, color: PURPLE },
    { label: "Biology", value: 22, color: "#0ea5e9" },
    { label: "Chem", value: 20, color: "#f59e0b" },
  ];
  return (
    <div className="absolute left-1/2 top-[6%] w-[92%] max-w-[470px] -translate-x-1/2">
      <div className="animate-floatYDelay">
        <div className="relative overflow-hidden rounded-2xl bg-white text-slate-800 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.45),0_12px_24px_-12px_rgba(0,0,0,0.3)] ring-1 ring-black/[0.04]">
          {/* Chrome bar */}
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-rose-400" />
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <span className="ml-2 text-[10px] font-semibold text-slate-700">
                E-class · Performance Hub
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-400">
              <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[8.5px] font-semibold text-slate-500">
                ⌘K
              </span>
              <DotsIcon />
            </div>
          </div>

          <div className="flex">
            {/* Sidebar */}
            <div className="flex w-[40px] flex-col items-center gap-2 border-r border-slate-100 py-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-100 text-indigo-700">
                <ChartIcon />
              </span>
              <span className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400">
                <BookIcon />
              </span>
              <span className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400">
                <StarIcon />
              </span>
              <span className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400">
                <PlayIcon />
              </span>
            </div>

            <div className="flex-1 px-3 py-2.5">
              {/* Top section: donut + KPI stack */}
              <div className="flex items-center gap-3">
                <div className="relative flex h-[68px] w-[68px] shrink-0 items-center justify-center">
                  <svg width="68" height="68" viewBox="0 0 48 48">
                    <circle
                      cx="24"
                      cy="24"
                      r={r}
                      fill="none"
                      stroke="#e2e8f0"
                      strokeWidth="6"
                    />
                    <circle
                      cx="24"
                      cy="24"
                      r={r}
                      fill="none"
                      stroke={BRAND}
                      strokeWidth="6"
                      strokeLinecap="round"
                      strokeDasharray={c}
                      strokeDashoffset={c * (1 - score / 100)}
                      transform="rotate(-90 24 24)"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
                    <span className="text-[14px] font-bold text-slate-900">
                      {score}%
                    </span>
                    <span className="mt-0.5 text-[7.5px] font-medium uppercase tracking-wide text-slate-500">
                      Score
                    </span>
                  </div>
                </div>

                <div className="grid flex-1 grid-cols-2 gap-1.5">
                  <KpiPill label="Users" value="2.4K" trend="+12%" />
                  <KpiPill label="Watch" value="612h" trend="+8%" />
                  <KpiPill label="MCQ" value="78%" trend="+4%" />
                  <KpiPill label="Live" value="312" trend="now" trendColor={BRAND} />
                </div>
              </div>

              {/* Multi-bar weekly trend */}
              <div className="mt-3 rounded-lg border border-slate-200/60 p-2">
                <div className="flex items-center justify-between">
                  <span className="text-[9.5px] font-semibold text-slate-700">
                    Weekly Engagement
                  </span>
                  <span className="text-[8.5px] font-semibold text-emerald-600">
                    ↗ +12%
                  </span>
                </div>
                <div className="mt-1.5 flex h-[36px] items-end gap-1.5">
                  {week.map((d, i) => (
                    <div key={d.d} className="flex flex-1 flex-col items-center gap-1">
                      <div className="flex h-[28px] w-full items-end">
                        <div
                          className="w-full rounded-sm"
                          style={{
                            height: `${d.v}%`,
                            backgroundColor: i === 3 ? PURPLE : BRAND,
                            opacity: i === 3 ? 1 : 0.7,
                          }}
                        />
                      </div>
                      <span className="text-[7.5px] font-medium text-slate-400">
                        {d.d}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Stacked subject bar */}
              <div className="mt-2.5">
                <div className="flex items-center justify-between text-[9px] text-slate-600">
                  <span className="font-semibold text-slate-700">
                    Subject Mix
                  </span>
                  <span className="font-medium text-slate-400">
                    {stack.reduce((s, x) => s + x.value, 0)}h total
                  </span>
                </div>
                <div className="mt-1 flex h-2 w-full overflow-hidden rounded-full">
                  {stack.map((s) => (
                    <div
                      key={s.label}
                      style={{
                        width: `${s.value}%`,
                        backgroundColor: s.color,
                      }}
                    />
                  ))}
                </div>
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[8.5px] text-slate-600">
                  {stack.map((s) => (
                    <span key={s.label} className="inline-flex items-center gap-1">
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: s.color }}
                      />
                      {s.label} {s.value}%
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Live pill (left side, doesn't collide with the embedded Analytics) */}
        <div className="absolute -bottom-3 left-8">
          <div
            className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-semibold text-white shadow-md"
            style={{ backgroundColor: PURPLE }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulseDot" />
            Live · 312 online
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiPill({
  label,
  value,
  trend,
  trendColor = "#16a34a",
}: {
  label: string;
  value: string;
  trend: string;
  trendColor?: string;
}) {
  return (
    <div className="rounded-md bg-slate-50 px-1.5 py-1">
      <div className="text-[7.5px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-0.5 flex items-baseline gap-1">
        <span className="text-[11.5px] font-bold leading-none text-slate-900">
          {value}
        </span>
        <span className="text-[7.5px] font-semibold" style={{ color: trendColor }}>
          {trend}
        </span>
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

/* ===================== Icons ===================== */

function BookIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
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
function DiamondIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2 22 12 12 22 2 12Z" />
    </svg>
  );
}
function TabletIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="2.5" />
      <line x1="12" y1="18" x2="12" y2="18.01" />
    </svg>
  );
}
function ShieldIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}
function AuditIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="9" y1="13" x2="15" y2="13" />
      <line x1="9" y1="17" x2="13" y2="17" />
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
