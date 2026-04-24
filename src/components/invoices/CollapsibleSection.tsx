"use client";

import { useId, useState, type ReactNode } from "react";

export interface CollapsibleSectionProps {
  title: string;
  badge?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

/**
 * Collapsible card section for the invoice detail page. Visual treatment
 * ported verbatim from the EditHistoryCard precedent at page.tsx:2707+
 * (card with --bg-card surface, --border-default border, eyebrow-styled
 * label, ChevronDown that rotates 180° when expanded, transition-transform
 * per the design system's "minimal motion" rule). Works in both light and
 * dark themes via semantic CSS variables — no dark: prefixes needed.
 */
export default function CollapsibleSection({
  title,
  badge,
  defaultOpen = false,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border-default)] p-5">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-3"
        aria-expanded={open}
        aria-controls={contentId}
      >
        <div className="flex items-baseline gap-3 min-w-0">
          <p className="text-[11px] font-medium text-[color:var(--text-secondary)] uppercase tracking-wider brass-underline">
            {title}
          </p>
          {badge && (
            <span className="text-[11px] text-[color:var(--text-muted)] truncate">
              {badge}
            </span>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-[color:var(--text-secondary)] transition-transform flex-shrink-0 ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div id={contentId} className="mt-4">
          {children}
        </div>
      )}
    </div>
  );
}
