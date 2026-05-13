// Refined chart palette — Tailwind 600-family for a more grown-up, technical feel.
export const CHART_PALETTE = [
  "#4f46e5", // indigo-600
  "#0891b2", // cyan-600
  "#059669", // emerald-600
  "#d97706", // amber-600
  "#dc2626", // red-600
  "#7c3aed", // violet-600
  "#0ea5e9", // sky-500
  "#65a30d", // lime-600
  "#c026d3", // fuchsia-600
  "#0d9488", // teal-600
  "#ea580c", // orange-600
  "#7e22ce", // purple-700
  "#2563eb", // blue-600
  "#16a34a", // green-600
  "#e11d48", // rose-600
  "#475569", // slate-600
];

export function colorForIndex(i: number): string {
  return CHART_PALETTE[i % CHART_PALETTE.length];
}

export const GRID_COLOR = "#eef2f7";
export const GRID_DASH = "3 3";
export const AXIS_COLOR = "#94a3b8";
export const AXIS_TICK_STYLE = {
  fontSize: 10.5,
  fill: "#64748b",
  fontVariant: "tabular-nums",
} as const;
