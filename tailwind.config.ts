import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: "var(--bg-page)",
          surface: "var(--bg-subtle)",
          card: "var(--bg-card)",
          elevated: "var(--bg-muted)",
          border: "var(--border-default)",
          "border-light": "var(--border-strong)",
          "row-border": "var(--border-default)",
        },
        cream: {
          DEFAULT: "var(--text-primary)",
          muted: "var(--text-secondary)",
          dim: "var(--text-tertiary)",
        },
        teal: {
          DEFAULT: "var(--bg-inverse)",
          hover: "var(--bg-inverse-hover)",
          muted: "var(--bg-muted)",
          glow: "rgba(91, 134, 153, 0.15)",
        },
        brass: {
          DEFAULT: "var(--color-warning)",
          muted: "rgba(201, 138, 59, 0.08)",
          glow: "rgba(201, 138, 59, 0.15)",
        },
        status: {
          success: "var(--color-success)",
          "success-muted": "rgba(74, 138, 111, 0.08)",
          warning: "var(--color-warning)",
          "warning-muted": "rgba(201, 138, 59, 0.08)",
          danger: "var(--color-error)",
          "danger-muted": "rgba(176, 85, 78, 0.08)",
        },
        // Slate design system palette
        "slate-tile": "#3B5864",
        "slate-deep": "#1A2830",
        "slate-deeper": "#132028",
        "stone-blue": "#5B8699",
        "gulf-blue": "#4E7A8C",
        oceanside: "#CBD8DB",
        "white-sand": "#F7F5EC",
        "nw-warn": "#C98A3B",
        "nw-success": "#4A8A6F",
        "nw-danger": "#B0554E",
      },
      fontFamily: {
        display: ["var(--font-display)", "Space Grotesk", "sans-serif"],
        sans: ["var(--font-sans)", "Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "ui-monospace", "monospace"],
      },
      borderRadius: {
        none: "0",
        DEFAULT: "0",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "slide-in-left": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.4s ease-out forwards",
        "fade-in": "fade-in 0.3s ease-out forwards",
        "slide-in-left": "slide-in-left 0.2s ease-out",
      },
    },
  },
  plugins: [],
};
export default config;
