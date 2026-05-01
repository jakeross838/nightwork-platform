import type { Config } from "tailwindcss";

const config: Config = {
  // Activate `dark:*` utilities when <html data-theme="dark"> is set.
  // Theme is server-rendered from the `nw_theme` cookie in layout.tsx
  // and toggled on the client via ThemeProvider.
  darkMode: ["class", '[data-theme="dark"]'],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Slate design-system tokens — the canonical Nightwork palette.
        // Legacy namespaces (brand.*, cream.*, teal.*, brass.*, nightwork.*,
        // status.*) were removed in Phase E wave 7; every consumer now uses
        // bracket-value tailwind with CSS vars directly, e.g.
        //   bg-[var(--bg-card)], text-[color:var(--text-primary)],
        //   border-[var(--border-default)].
        "nw-slate-tile": "var(--nw-slate-tile)",
        "nw-slate-deep": "var(--nw-slate-deep)",
        "nw-slate-deeper": "var(--nw-slate-deeper)",
        "nw-stone-blue": "var(--nw-stone-blue)",
        "nw-gulf-blue": "var(--nw-gulf-blue)",
        "nw-oceanside": "var(--nw-oceanside)",
        "nw-white-sand": "var(--nw-white-sand)",
        "nw-warn": "var(--nw-warn)",
        "nw-success": "var(--nw-success)",
        "nw-danger": "var(--nw-danger)",
      },
      fontFamily: {
        // Nightwork Slate palette fonts:
        //   display → Space Grotesk  (headings, wordmark)
        //   sans    → Inter          (body text)
        //   mono    → JetBrains Mono (eyebrows, metadata, code)
        display: ["var(--font-space-grotesk)", "Space Grotesk", "system-ui", "sans-serif"],
        body: ["var(--font-inter)", "Inter", "system-ui", "-apple-system", "sans-serif"],
        sans: ["var(--font-inter)", "Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "JetBrains Mono", "ui-monospace", "monospace"],
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
