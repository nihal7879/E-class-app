// =============================================================================
// AUTH FLOW (institute credentials, validated by the backend)
// -----------------------------------------------------------------------------
// 1. AuthProvider wraps the app (see App.tsx) and holds the current `user`.
// 2. On first render it hydrates `user` from localStorage, so a signed-in
//    session survives page reloads.
// 3. LoginPage calls `login(username, password)`. These are forwarded to
//    POST /api/auth/login, which validates them against the upstream
//    Authenticate API and resolves the matching institute in our DB.
// 4. On success the user object (scoped to that institute) is stored in state
//    (and mirrored to localStorage by the effect below), which unblocks the
//    RequireAuth gate in App.tsx and routes the user to the dashboard.
// 5. `logout()` clears state (and localStorage), sending the user back to
//    /login (see Topbar.handleLogout).
// =============================================================================
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "./api";

export interface AuthUser {
  loginType: "I" | "S";      // which dropdown option signed in
  instituteId?: number;      // set when loginType === "I"
  instituteName?: string;
  schoolId?: number;         // set when loginType === "S"
  schoolName?: string;
  username: string;
  name: string; // display name derived from the username/email
  role: string; // shown under the name in the topbar
}

// What login() reports back so the caller can route appropriately (a school
// sign-in jumps straight to that school's page).
type LoginResult =
  | { ok: true; loginType: "I" }
  | { ok: true; loginType: "S"; schoolName: string }
  | { ok: false; error: string };

interface AuthContextValue {
  user: AuthUser | null;
  // Sign in with institute ("I") or school ("S") credentials; the backend
  // validates them upstream and resolves the matching institute/school.
  login: (
    username: string,
    password: string,
    type: "I" | "S",
  ) => Promise<LoginResult>;
  logout: () => void;
}

// localStorage key under which the signed-in user is persisted across reloads.
const STORAGE_KEY = "eclass.auth.user";
// localStorage key holding the epoch-ms timestamp of the last user activity.
// Used to enforce the idle timeout across reloads / reopened tabs.
const ACTIVITY_KEY = "eclass.auth.lastActivity";
// Auto-logout after this much inactivity (no mouse/keyboard/scroll/touch).
const IDLE_TIMEOUT_MS = 20 * 60 * 1000; // 20 minutes

// True if the stored last-activity timestamp is older than the idle window.
function isIdleExpired(): boolean {
  const raw = localStorage.getItem(ACTIVITY_KEY);
  if (!raw) return false; // no record yet — treat as fresh
  const last = Number(raw);
  if (!Number.isFinite(last)) return false;
  return Date.now() - last > IDLE_TIMEOUT_MS;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Lazy initializer: rehydrate the session from localStorage on first render
  // so a refresh doesn't bounce the user back to /login. Falls back to null
  // (logged out) if nothing is stored or the JSON is corrupt.
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      // If the tab was left idle (or closed) past the timeout, don't restore
      // the session — force a fresh login.
      if (isIdleExpired()) {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(ACTIVITY_KEY);
        return null;
      }
      return JSON.parse(raw) as AuthUser;
    } catch {
      return null;
    }
  });

  // Keep localStorage in sync with `user`: persist on login, clear on logout.
  useEffect(() => {
    if (user) localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    else localStorage.removeItem(STORAGE_KEY);
  }, [user]);

  // Sign-in: forwards credentials to the backend, which validates them upstream
  // and returns the matching institute. Returns a discriminated result so the
  // caller can show inline errors instead of throwing.
  const login = useCallback<AuthContextValue["login"]>(async (username, password, type) => {
    if (!username.trim() || !password) {
      return { ok: false, error: "Please enter your username and password." };
    }
    try {
      const res = await api.login(username.trim(), password, type);
      if (res.type === "S") {
        setUser({
          loginType: "S",
          schoolId: res.schoolId,
          schoolName: res.schoolName,
          username: username.trim(),
          name: res.schoolName,
          role: "School",
        });
        return { ok: true, loginType: "S", schoolName: res.schoolName };
      }
      setUser({
        loginType: "I",
        instituteId: res.instituteId,
        instituteName: res.instituteName,
        username: username.trim(),
        name: res.instituteName,
        role: "Admin",
      });
      return { ok: true, loginType: "I" };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Sign in failed. Please try again." };
    }
  }, []);

  // Clearing the user triggers the sync effect (wipes localStorage) and makes
  // RequireAuth redirect to /login on the next render.
  const logout = useCallback(() => {
    localStorage.removeItem(ACTIVITY_KEY);
    setUser(null);
  }, []);

  // Idle auto-logout: while signed in, watch for user activity and reset a
  // 20-minute countdown on each event. If the countdown elapses with no
  // activity, sign the user out. The last-activity timestamp is mirrored to
  // localStorage so the timeout also holds across reloads / reopened tabs
  // (see the lazy initializer and isIdleExpired above).
  useEffect(() => {
    if (!user) return;

    let timer: ReturnType<typeof setTimeout>;
    const expire = () => logout();

    const bump = () => {
      localStorage.setItem(ACTIVITY_KEY, String(Date.now()));
      clearTimeout(timer);
      timer = setTimeout(expire, IDLE_TIMEOUT_MS);
    };

    // Seed the timer + timestamp for this session.
    bump();

    // Throttle: at most one timestamp write / timer reset per second, since
    // mousemove/scroll fire rapidly.
    let last = 0;
    const onActivity = () => {
      const now = Date.now();
      if (now - last < 1000) return;
      last = now;
      bump();
    };

    const events: (keyof WindowEventMap)[] = [
      "mousemove",
      "mousedown",
      "keydown",
      "scroll",
      "touchstart",
      "click",
    ];
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));

    // Re-check when the tab regains focus/visibility: if it was hidden past the
    // timeout, log out immediately rather than waiting for the stale timer.
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        if (isIdleExpired()) logout();
        else bump();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, onActivity));
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [user, logout]);

  const value = useMemo<AuthContextValue>(() => ({ user, login, logout }), [user, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Convenience hook for consuming the auth context. Throws if used outside the
// provider so the mistake surfaces immediately rather than as a null-deref.
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
