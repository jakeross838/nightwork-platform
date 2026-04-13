import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: "#1a1915",
          surface: "#23221d",
          card: "#2a2923",
          elevated: "#33322b",
          border: "#3d3c34",
          "border-light": "#4a493f",
        },
        cream: {
          DEFAULT: "#f5f0e8",
          muted: "#b8b2a4",
          dim: "#8a8478",
        },
        teal: {
          DEFAULT: "#4a9b8e",
          hover: "#5bb5a6",
          muted: "rgba(74, 155, 142, 0.15)",
          glow: "rgba(74, 155, 142, 0.3)",
        },
        brass: {
          DEFAULT: "#c4a35a",
          muted: "rgba(196, 163, 90, 0.15)",
          glow: "rgba(196, 163, 90, 0.3)",
        },
        status: {
          success: "#5a9b6b",
          "success-muted": "rgba(90, 155, 107, 0.15)",
          warning: "#c4a35a",
          "warning-muted": "rgba(196, 163, 90, 0.15)",
          danger: "#c45a5a",
          "danger-muted": "rgba(196, 90, 90, 0.15)",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "serif"],
        body: ["var(--font-body)", "sans-serif"],
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "slide-in-right": {
          "0%": { opacity: "0", transform: "translateX(16px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s ease-out forwards",
        "fade-in": "fade-in 0.4s ease-out forwards",
        "slide-in-right": "slide-in-right 0.5s ease-out forwards",
        shimmer: "shimmer 2s linear infinite",
      },
    },
  },
  plugins: [],
};
export default config;
