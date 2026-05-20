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
        floatY: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-14px)" },
        },
        floatYDelay: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        floatYSlow: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-22px)" },
        },
        orbDrift: {
          "0%, 100%": { transform: "translate3d(0,0,0) scale(1)" },
          "50%": { transform: "translate3d(40px,-30px,0) scale(1.08)" },
        },
        orbDriftAlt: {
          "0%, 100%": { transform: "translate3d(0,0,0) scale(1)" },
          "50%": { transform: "translate3d(-30px,20px,0) scale(1.05)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "0% 50%" },
          "100%": { backgroundPosition: "200% 50%" },
        },
        tilt3d: {
          "0%, 100%": { transform: "rotateX(14deg) rotateY(-22deg) rotateZ(3deg) translateY(0)" },
          "50%": { transform: "rotateX(10deg) rotateY(-18deg) rotateZ(2deg) translateY(-12px)" },
        },
        tilt3dAlt: {
          "0%, 100%": { transform: "rotateX(10deg) rotateY(18deg) rotateZ(-4deg) translateY(0)" },
          "50%": { transform: "rotateX(8deg) rotateY(14deg) rotateZ(-3deg) translateY(-8px)" },
        },
        spinSlow: {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        ringPulse: {
          "0%, 100%": { opacity: "0.6", transform: "scale(1)" },
          "50%": { opacity: "0.2", transform: "scale(1.4)" },
        },
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        drawLine: {
          "0%": { strokeDashoffset: "400" },
          "100%": { strokeDashoffset: "0" },
        },
        countPulse: {
          "0%, 100%": { transform: "scale(1)", opacity: "1" },
          "50%": { transform: "scale(1.06)", opacity: "0.95" },
        },
        slideInRight: {
          "0%": { opacity: "0", transform: "translateX(48px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        slideInLeft: {
          "0%": { opacity: "0", transform: "translateX(-48px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        slideInUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        loaderSweep: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        chipPop: {
          "0%": { opacity: "0", transform: "scale(0.6)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        cardRise: {
          "0%": { opacity: "0", transform: "translateY(28px) scale(0.96)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
      },
      animation: {
        fadeIn: "fadeIn .25s ease-out both",
        popIn: "popIn .18s ease-out both",
        pulseDot: "pulseDot 2s ease-out infinite",
        floatY: "floatY 7s ease-in-out infinite",
        floatYDelay: "floatYDelay 9s ease-in-out infinite",
        floatYSlow: "floatYSlow 11s ease-in-out infinite",
        orbDrift: "orbDrift 14s ease-in-out infinite",
        orbDriftAlt: "orbDriftAlt 18s ease-in-out infinite",
        shimmer: "shimmer 3s linear infinite",
        tilt3d: "tilt3d 9s ease-in-out infinite",
        tilt3dAlt: "tilt3dAlt 11s ease-in-out infinite",
        spinSlow: "spinSlow 14s linear infinite",
        ringPulse: "ringPulse 3s ease-in-out infinite",
        marquee: "marquee 22s linear infinite",
        drawLine: "drawLine 2.5s ease-out forwards",
        countPulse: "countPulse 2.8s ease-in-out infinite",
        slideInRight: "slideInRight .7s cubic-bezier(.2,.7,.2,1) both",
        slideInLeft: "slideInLeft .7s cubic-bezier(.2,.7,.2,1) both",
        slideInUp: "slideInUp .6s cubic-bezier(.2,.7,.2,1) both",
        loaderSweep: "loaderSweep 1.4s ease-in-out infinite",
        chipPop: "chipPop .55s cubic-bezier(.34,1.56,.64,1) both",
        cardRise: "cardRise .8s cubic-bezier(.2,.7,.2,1) both",
      },
    },
  },
  plugins: [],
};
