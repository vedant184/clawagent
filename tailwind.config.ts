import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "#070b16",
          card: "#0f1424",
          soft: "#141a30",
        },
        brand: {
          50: "#e6f0ff",
          100: "#bfd8ff",
          200: "#94beff",
          300: "#669fff",
          400: "#3d83ff",
          500: "#1f6bff",
          600: "#1554d6",
          700: "#0d3fa6",
          800: "#072b75",
          900: "#021847",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      animation: {
        "pulse-slow": "pulse 2.5s cubic-bezier(0.4,0,0.6,1) infinite",
        shimmer: "shimmer 2s linear infinite",
        "browser-glow": "browserGlow 1.6s ease-in-out infinite",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-1000px 0" },
          "100%": { backgroundPosition: "1000px 0" },
        },
        browserGlow: {
          "0%, 100%": {
            boxShadow:
              "0 0 0 1px rgba(61,131,255,0.6), 0 0 30px 4px rgba(61,131,255,0.45), inset 0 0 25px rgba(61,131,255,0.15)",
          },
          "50%": {
            boxShadow:
              "0 0 0 1px rgba(61,131,255,1), 0 0 60px 10px rgba(61,131,255,0.75), inset 0 0 45px rgba(61,131,255,0.3)",
          },
        },
      },
    },
  },
  plugins: [],
};

export default config;
