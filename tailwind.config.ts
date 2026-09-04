import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#060913",
          900: "#0a0f1e",
          850: "#0d1326",
          800: "#111a33",
          700: "#1a2547",
        },
        brand: {
          300: "#67e8f9",
          400: "#22d3ee",
          500: "#06b6d4",
          600: "#0891b2",
        },
        violet: {
          400: "#a78bfa",
          500: "#8b5cf6",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 24px rgba(34,211,238,0.25)",
        "glow-rose": "0 0 24px rgba(244,63,94,0.25)",
        card: "0 10px 30px -12px rgba(0,0,0,0.55)",
      },
      backgroundImage: {
        "grid-glow":
          "radial-gradient(60rem 40rem at 110% -10%, rgba(139,92,246,0.18), transparent 60%), radial-gradient(50rem 35rem at -20% 10%, rgba(34,211,238,0.16), transparent 55%)",
      },
      keyframes: {
        "pulse-ring": {
          "0%": { boxShadow: "0 0 0 0 rgba(52,211,153,0.45)" },
          "70%": { boxShadow: "0 0 0 10px rgba(52,211,153,0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(52,211,153,0)" },
        },
        "slide-in": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "pulse-ring": "pulse-ring 2s cubic-bezier(0.4,0,0.6,1) infinite",
        "slide-in": "slide-in 0.35s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
