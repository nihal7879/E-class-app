import loginsJson from "@/data/loginHistory.json";
import videosJson from "@/data/videoUsage.json";
import mcqJson from "@/data/mcqReport.json";
import type { LoginRow, McqRow, VideoRow } from "./types";

export const LOGIN_ROWS: LoginRow[] = loginsJson as LoginRow[];
export const VIDEO_ROWS: VideoRow[] = videosJson as VideoRow[];
export const MCQ_ROWS: McqRow[] = mcqJson as McqRow[];

export const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export function getYear(dateStr: string): number {
  return Number(dateStr.slice(0, 4));
}

export function getMonth(dateStr: string): number {
  // 1..12
  return Number(dateStr.slice(5, 7));
}

export function formatHours(ms: number): string {
  const hours = ms / 3_600_000;
  if (hours >= 1000) return `${(hours / 1000).toFixed(1)}k hrs`;
  if (hours >= 10) return `${hours.toFixed(0)} hrs`;
  if (hours >= 1) return `${hours.toFixed(1)} hrs`;
  const minutes = ms / 60_000;
  if (minutes >= 1) return `${minutes.toFixed(0)} min`;
  return `${Math.round(ms / 1000)} sec`;
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function shortSchoolName(name: string, max = 28): string {
  const trimmed = name.trim();
  if (trimmed.length <= max) return trimmed;
  return trimmed.slice(0, max - 1).trimEnd() + "…";
}

export function schoolId(name: string): string {
  return encodeURIComponent(name.trim());
}

export function schoolFromId(id: string): string {
  return decodeURIComponent(id);
}

export function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

export function sortAlpha(arr: string[]): string[] {
  return [...arr].sort((a, b) => a.localeCompare(b));
}

// Order: 1st, 2nd, 3rd, ... 10th, then anything without an ordinal alphabetically.
export function sortCourses(arr: string[]): string[] {
  const ord = (s: string): number => {
    // No \b after the suffix — "_" counts as a word char in regex, so \b would never match
    // "10TH_SEMI-ENGLISH_MARATHI". Just anchor at the start.
    const m = s.match(/^(\d+)(ST|ND|RD|TH)/i);
    return m ? parseInt(m[1], 10) : Number.POSITIVE_INFINITY;
  };
  return [...arr].sort((a, b) => {
    const an = ord(a);
    const bn = ord(b);
    if (an !== bn) return an - bn;
    return a.localeCompare(b);
  });
}

// "1ST_SEMI-ENGLISH_MARATHI" -> "1st Semi-English Marathi"
export function formatCourseLabel(raw: string): string {
  return raw
    .split("_")
    .map((part) => {
      const ord = part.match(/^(\d+)(ST|ND|RD|TH)$/i);
      if (ord) return ord[1] + ord[2].toLowerCase();
      return part
        .split("-")
        .map((w) =>
          w.length === 0
            ? w
            : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
        )
        .join("-");
    })
    .join(" ");
}
