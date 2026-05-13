import {
  createContext,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { getCatalogue } from "./aggregations";
import type { FilterState } from "./types";

interface FilterContextValue {
  filter: FilterState;
  setFilter: Dispatch<SetStateAction<FilterState>>;
  reset: () => void;
  hasActive: boolean;
}

const initialFilter = (): FilterState => {
  const cat = getCatalogue();
  return {
    year: cat.years[0] ?? "all",
    month: "all",
    schools: [],
    courses: [],
  };
};

const FilterContext = createContext<FilterContextValue | null>(null);

export function FilterProvider({ children }: { children: ReactNode }) {
  const [filter, setFilter] = useState<FilterState>(initialFilter);
  const value = useMemo<FilterContextValue>(
    () => ({
      filter,
      setFilter,
      reset: () => setFilter(initialFilter()),
      hasActive:
        filter.month !== "all" ||
        filter.schools.length > 0 ||
        filter.courses.length > 0,
    }),
    [filter],
  );
  return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>;
}

export function useFilter() {
  const ctx = useContext(FilterContext);
  if (!ctx) throw new Error("useFilter must be used within FilterProvider");
  return ctx;
}
