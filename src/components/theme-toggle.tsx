"use client";

import { useTheme } from "./theme-provider";

// Square 32px icon button. Shows a moon when in light mode (click → go dark)
// and a sun when in dark mode (click → go light). Heroicons-style outline,
// 1.5 stroke. Inlined to avoid pulling in @heroicons/react just for two icons.
//
// Not wired into the nav yet — only mounted on /nw-test for verification.
// Part 2c will move it into the final nav placement.
export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const next = theme === "light" ? "dark" : "light";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      className={[
        "inline-flex items-center justify-center",
        "w-8 h-8 border",
        "border-[var(--border-strong)] text-[var(--text-primary)]",
        "bg-transparent hover:border-nw-stone-blue hover:text-nw-stone-blue",
        "transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nw-stone-blue/40 focus-visible:ring-offset-1",
      ].join(" ")}
    >
      {theme === "light" ? (
        // Moon — clicking switches to dark
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      ) : (
        // Sun — clicking switches to light
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      )}
    </button>
  );
}
