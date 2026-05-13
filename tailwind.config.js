/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#070b18",
          900: "#0b1224",
          800: "#101a35",
          700: "#1a2547",
          600: "#293560",
          500: "#3b4880",
        },
        accent: {
          50: "#eef4ff",
          100: "#dde9ff",
          200: "#bcd2ff",
          300: "#8eb2ff",
          400: "#5e8aff",
          500: "#3d68ff",
          600: "#2a4ef0",
          700: "#223dc4",
          800: "#1f349b",
          900: "#1d307b",
          950: "#13205a",
        },
        sig: {
          up: "#16a34a",
          down: "#dc2626",
          warn: "#d97706",
        },
      },
      boxShadow: {
        card: "0 1px 0 rgba(15,23,42,.04), 0 4px 16px -8px rgba(15,23,42,.08)",
        cardHover: "0 1px 0 rgba(15,23,42,.05), 0 10px 28px -12px rgba(15,23,42,.18)",
        glow: "0 0 0 1px rgba(99,102,241,.35), 0 8px 24px -10px rgba(99,102,241,.45)",
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        mono: [
          "JetBrains Mono",
          "Menlo",
          "Consolas",
          "Liberation Mono",
          "monospace",
        ],
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        popIn: {
          "0%": { opacity: "0", transform: "translateY(4px) scale(.98)" },
          "100%": { opacity: "1", transform: "none" },
        },
        pulseDot: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(16,185,129,.7)" },
          "50%": { boxShadow: "0 0 0 6px rgba(16,185,129,0)" },
        },
      },
      animation: {
        fadeIn: "fadeIn .25s ease-out both",
        popIn: "popIn .18s ease-out both",
        pulseDot: "pulseDot 2s ease-out infinite",
      },
    },
  },
  plugins: [],
};
