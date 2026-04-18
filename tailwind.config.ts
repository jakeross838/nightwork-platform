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
          card: "var(--color-white)",
          elevated: "var(--bg-muted)",
          border: "var(--border-default)",
          "border-light": "var(--border-strong)",
          "row-border": "var(--border-default)",
        },
        cream: {
          DEFAULT: "var(--text-primary)",
          muted: "var(--text-body)",
          dim: "var(--text-secondary)",
        },
        teal: {
          DEFAULT: "var(--bg-inverse)",
          hover: "#2F4850",
          muted: "rgba(63, 88, 98, 0.08)",
          glow: "rgba(63, 88, 98, 0.15)",
        },
        brass: {
          DEFAULT: "var(--color-warning)",
          muted: "rgba(230, 81, 0, 0.08)",
          glow: "rgba(230, 81, 0, 0.15)",
        },
        status: {
          success: "var(--color-success)",
          "success-muted": "rgba(46, 125, 50, 0.08)",
          warning: "var(--color-warning)",
          "warning-muted": "rgba(230, 81, 0, 0.08)",
          danger: "var(--color-error)",
          "danger-muted": "rgba(192, 57, 43, 0.08)",
        },
        // Nightwork product-chrome palette — additive; existing tokens
        // above are unchanged. Use `bg-nightwork-navy`, `text-nightwork-amber`
        // etc. on NEW chrome work only. Per brand: one amber moment per screen.
        nightwork: {
          navy: "#0F1E36",
          amber: "#E89A2B",
          cream: "#EDE3CE",
        },
      },
      fontFamily: {
        display: ["Century Gothic", "CenturyGothic", "AppleGothic", "sans-serif"],
        body: ["Century Gothic", "CenturyGothic", "AppleGothic", "sans-serif"],
        // Nightwork brand font (wordmark). Available as `font-sans` on
        // new chrome work; existing components keep their font-display /
        // font-body Century Gothic styling.
        sans: ["var(--font-inter)", "Inter", "system-ui", "-apple-system", "sans-serif"],
      },
      borderRadius: {
        none: "0",
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
