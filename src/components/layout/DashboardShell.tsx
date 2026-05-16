import { useEffect, useRef, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import Topbar from "./Topbar";

export default function DashboardShell({ children }: { children: ReactNode }) {
  const mainRef = useRef<HTMLElement>(null);
  const { pathname } = useLocation();

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [pathname]);

  return (
    <div className="flex h-full min-h-screen flex-col bg-[#f5f7fa]">
      <Topbar />
      <main
        ref={mainRef}
        className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-5 lg:px-8 lg:py-6"
      >
        <div className="mx-auto w-full max-w-[1500px]">{children}</div>
      </main>
    </div>
  );
}
