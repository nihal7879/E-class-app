import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import type { ExportScope, FilterState } from "./types";
import { useAuth, type AuthUser } from "./auth";

interface FilterContextValue {
  filter: FilterState;
  setFilter: Dispatch<SetStateAction<FilterState>>;
  reset: () => void;
  hasActive: boolean;
  // Page-scoped override applied ONLY to the Excel download, so a drill-down page
  // (a specific course / subject) exports just that page's data without changing
  // what the dashboard charts show. Pages register it via useExportScope().
  exportScope: ExportScope;
  setExportScope: Dispatch<SetStateAction<ExportScope>>;
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
  const [exportScope, setExportScope] = useState<ExportScope>({});
  const scopeKey = `${user?.instituteId ?? ""}|${user?.schoolName ?? ""}`;
  const value = useMemo<FilterContextValue>(
    () => ({
      filter,
      setFilter,
      exportScope,
      setExportScope,
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
    [filter, exportScope, scopeKey], // eslint-disable-line react-hooks/exhaustive-deps
  );
  return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>;
}

export function useFilter() {
  const ctx = useContext(FilterContext);
  if (!ctx) throw new Error("useFilter must be used within FilterProvider");
  return ctx;
}

/**
 * Registers a page-scoped export override for the lifetime of the calling page,
 * then clears it on unmount. Used by drill-down pages (a specific course /
 * subject) so the Excel download reflects exactly that page's scope. The `scope`
 * fields are merged on top of the global filter when building the export URL.
 */
export function useExportScope(scope: ExportScope): void {
  const { setExportScope } = useFilter();
  // Stringify so the effect only re-runs when the scope's contents actually
  // change, not on every render (a fresh object literal each time otherwise).
  const key = JSON.stringify(scope);
  useEffect(() => {
    setExportScope(scope);
    return () => setExportScope({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, setExportScope]);
}
