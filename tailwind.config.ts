import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Cinzel"', "serif"],
        body: ['"Inter"', "system-ui", "sans-serif"],
      },
      colors: {
        ink: {
          900: "#0c0a07",
          800: "#14110b",
          700: "#1d1810",
          600: "#2a2216",
        },
        parchment: {
          100: "#f3ead0",
          200: "#e9dcb8",
          300: "#d8c79a",
        },
        gold: {
          300: "#e8cf72",
          400: "#d4af37",
          500: "#b8902a",
        },
        ember: {
          400: "#f0764c",
          500: "#e0532b",
        },
        arcane: {
          400: "#9b7bd4",
          500: "#7a55c2",
        },
        moss: {
          400: "#7faa5f",
          500: "#5d8b41",
        },
      },
      boxShadow: {
        rune: "0 0 0 1px rgba(212,175,55,0.25), 0 20px 60px -25px rgba(0,0,0,0.9)",
        glow: "0 0 24px -4px rgba(212,175,55,0.45)",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        flicker: {
          "0%,100%": { opacity: "1" },
          "50%": { opacity: "0.82" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.5s ease-out both",
        flicker: "flicker 3.5s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
