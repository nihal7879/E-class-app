import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export interface Institute {
  id: string;
  name: string;
  shortName: string;
}

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
}

interface AuthContextValue {
  user: AuthUser | null;
  login: (instituteId: string, username: string, password: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  logout: () => void;
}

const STORAGE_KEY = "eclass.auth.user";

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as AuthUser) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (user) localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    else localStorage.removeItem(STORAGE_KEY);
  }, [user]);

  const login = useCallback<AuthContextValue["login"]>(async (instituteId, username, password) => {
    const institute = INSTITUTES.find((i) => i.id === instituteId);
    if (!institute) return { ok: false, error: "Please choose an institute." };
    if (!username.trim()) return { ok: false, error: "Username is required." };
    if (password.length < 4) return { ok: false, error: "Password must be at least 4 characters." };

    // Simulated network delay so the UI shows loading feedback.
    await new Promise((r) => setTimeout(r, 450));
    setUser({ instituteId: institute.id, instituteName: institute.name, username: username.trim() });
    return { ok: true };
  }, []);

  const logout = useCallback(() => setUser(null), []);

  const value = useMemo<AuthContextValue>(() => ({ user, login, logout }), [user, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
