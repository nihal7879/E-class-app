// =============================================================================
// AUTH FLOW (client-only, mock auth — no backend involved yet)
// -----------------------------------------------------------------------------
// 1. AuthProvider wraps the app (see App.tsx) and holds the current `user`.
// 2. On first render it hydrates `user` from localStorage, so a signed-in
//    session survives page reloads.
// 3. LoginPage calls `login(institute, username, password)`. Validation is
//    done locally — there is NO server check. Any username + 4+ char password
//    against a known institute "succeeds".
// 4. On success the user object is stored in state (and mirrored to
//    localStorage by the effect below), which unblocks the RequireAuth gate
//    in App.tsx and routes the user to the dashboard.
// 5. `logout()` clears state (and localStorage), sending the user back to
//    /login (see Topbar.handleLogout).
//
// NOTE: This is placeholder auth for the UI. Replace `login` with a real API
// call when the backend auth endpoint exists.
// =============================================================================
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export interface Institute {
  id: string;
  name: string;
  shortName: string;
}

// Hardcoded list of institutes shown in the login dropdown. The chosen id is
// validated in `login` and stored on the user (drives the Topbar label, etc.).
export const INSTITUTES: Institute[] = [
  { id: "millicent", name: "Millicent Group of Schools", shortName: "MGS" },
  { id: "sunshine", name: "Sunshine International Academy", shortName: "SIA" },
  { id: "vidya-bhavan", name: "Vidya Bhavan Trust", shortName: "VBT" },
  { id: "nalanda", name: "Nalanda Education Society", shortName: "NES" },
];

export interface AuthUser {
  instituteId: string;
  instituteName: string;
  username: string;
  name: string; // display name derived from the username/email
  role: string; // shown under the name in the topbar
}

// "nirav.mehta@millicent.in" -> "Nirav Mehta"; "owner" -> "Owner".
function deriveDisplayName(username: string): string {
  const local = username.split("@")[0];
  const parts = local.split(/[._\-\s]+/).filter(Boolean);
  if (parts.length === 0) return username;
  return parts
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(" ");
}

interface AuthContextValue {
  user: AuthUser | null;
  login: (instituteId: string, username: string, password: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  logout: () => void;
}

// localStorage key under which the signed-in user is persisted across reloads.
const STORAGE_KEY = "eclass.auth.user";

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Lazy initializer: rehydrate the session from localStorage on first render
  // so a refresh doesn't bounce the user back to /login. Falls back to null
  // (logged out) if nothing is stored or the JSON is corrupt.
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as AuthUser) : null;
    } catch {
      return null;
    }
  });

  // Keep localStorage in sync with `user`: persist on login, clear on logout.
  useEffect(() => {
    if (user) localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    else localStorage.removeItem(STORAGE_KEY);
  }, [user]);

  // Mock sign-in: validates inputs locally and (on success) sets the user.
  // Returns a discriminated result so the caller can show inline errors
  // instead of throwing. No real credential check happens here.
  const login = useCallback<AuthContextValue["login"]>(async (instituteId, username, password) => {
    const institute = INSTITUTES.find((i) => i.id === instituteId);
    if (!institute) return { ok: false, error: "Please choose an institute." };
    if (!username.trim()) return { ok: false, error: "Username is required." };
    if (password.length < 4) return { ok: false, error: "Password must be at least 4 characters." };

    // Simulated network delay so the UI shows loading feedback.
    await new Promise((r) => setTimeout(r, 450));
    const trimmed = username.trim();
    setUser({
      instituteId: institute.id,
      instituteName: institute.name,
      username: trimmed,
      name: deriveDisplayName(trimmed),
      role: "Admin",
    });
    return { ok: true };
  }, []);

  // Clearing the user triggers the sync effect (wipes localStorage) and makes
  // RequireAuth redirect to /login on the next render.
  const logout = useCallback(() => setUser(null), []);

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
