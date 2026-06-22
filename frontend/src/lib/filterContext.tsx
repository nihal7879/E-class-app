import {
  createContext,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import type { FilterState } from "./types";
import { useAuth, type AuthUser } from "./auth";

interface FilterContextValue {
  filter: FilterState;
  setFilter: Dispatch<SetStateAction<FilterState>>;
  reset: () => void;
  hasActive: boolean;
}

// The logged-in scope is sticky — it survives "reset". It is seeded from the
// account that signed in:
//   - institute login → scope by institute_id (a school login has NO institute
//     id, so guarding against undefined avoids sending `institutes=undefined`,
//     which matches zero rows and zeroes out every KPI).
//   - school login → scope by the account's school name instead.
const seedFilter = (user: AuthUser | null): FilterState => {
  return {
    year: "all",
    month: "all",
    institutes: user?.instituteId != null ? [String(user.instituteId)] : [],
    mediums: [],
    schools: user?.loginType === "S" && user.schoolName ? [user.schoolName] : [],
    courses: [],
    divisions: [],
    genders: [],
  };
};

const FilterContext = createContext<FilterContextValue | null>(null);

export function FilterProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [filter, setFilter] = useState<FilterState>(() => seedFilter(user));
  const scopeKey = `${user?.instituteId ?? ""}|${user?.schoolName ?? ""}`;
  const value = useMemo<FilterContextValue>(
    () => ({
      filter,
      setFilter,
      reset: () => setFilter(seedFilter(user)),
      hasActive:
        filter.month !== "all" ||
        filter.mediums.length > 0 ||
        // For a school login the school is the sticky scope, not an active filter.
        (user?.loginType !== "S" && filter.schools.length > 0) ||
        filter.courses.length > 0 ||
        filter.divisions.length > 0 ||
        filter.genders.length > 0 ||
        Boolean(filter.dateFrom) ||
        Boolean(filter.dateTo),
    }),
    // The scope is derived from user; recompute the reset closure if it changes.
    [filter, scopeKey], // eslint-disable-line react-hooks/exhaustive-deps
  );
  return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>;
}

export function useFilter() {
  const ctx = useContext(FilterContext);
  if (!ctx) throw new Error("useFilter must be used within FilterProvider");
  return ctx;
}
