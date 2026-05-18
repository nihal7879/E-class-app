import { useMemo } from "react";
import { computeKpis } from "@/lib/aggregations";
import { useFilter } from "@/lib/filterContext";
import { formatHours, formatNumber } from "@/lib/parse";
import KpiTile from "./KpiTile";

export default function KpiStrip() {
  const { filter } = useFilter();
  const k = useMemo(() => computeKpis(filter), [filter]);

  const hours = k.totalLearningMs / 3_600_000;

  return (
    <section className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
      <KpiTile
        tone="indigo"
        label="Schools"
        value={formatNumber(k.totalSchools)}
        hint="Active in selection"
        icon={<SchoolIcon />}
      />
      <KpiTile
        tone="violet"
        label="Students"
        value={formatNumber(k.totalStudents)}
        hint="Unique learners"
        icon={<UsersIcon />}
      />
      <KpiTile
        tone="emerald"
        label="Courses"
        value={formatNumber(k.totalCourses)}
        hint="From video activity"
        icon={<BookIcon />}
      />
      <KpiTile
        tone="amber"
        label="Learning hours"
        value={hours >= 10 ? hours.toFixed(0) : hours.toFixed(1)}
        unit="hrs"
        hint={`${formatHours(k.totalLearningMs)} watched`}
        icon={<ClockIcon />}
      />
      <KpiTile
        tone="rose"
        label="Total logins"
        value={formatNumber(k.totalLogins)}
        hint="In selected period"
        icon={<KeyIcon />}
      />
    </section>
  );
}

function SchoolIcon() {
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
      <path d="M3 21h18" />
      <path d="M5 21V8l7-4 7 4v13" />
      <path d="M10 21v-5h4v5" />
    </svg>
  );
}
function UsersIcon() {
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
      <path d="M16 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M8 21v-2a4 4 0 0 1 3-3.87" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
function BookIcon() {
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
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
    </svg>
  );
}
function ClockIcon() {
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
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15 14" />
    </svg>
  );
}
function KeyIcon() {
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
      <circle cx="8" cy="15" r="4" />
      <path d="m10.85 12.15 7.65-7.65" />
      <path d="m18 8 2 2" />
      <path d="m15 5 3 3" />
    </svg>
  );
}
