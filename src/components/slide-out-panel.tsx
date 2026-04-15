"use client";

import { useEffect } from "react";

/**
 * Right-side slide-out panel used by budget drill-downs and similar detail
 * views. Overlay covers the viewport; the panel occupies ~40–50% width on
 * desktop and full-width on mobile. Click outside or press Esc to dismiss.
 */
export default function SlideOutPanel({
  open,
  onClose,
  title,
  subtitle,
  children,
  widthClass = "md:w-[55vw] lg:w-[50vw] min-w-[360px] max-w-[900px]",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  widthClass?: string;
}) {
  // Esc to close.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* Overlay */}
      <button
        type="button"
        className="flex-1 bg-black/40 cursor-default"
        aria-label="Close panel"
        onClick={onClose}
      />
      {/* Panel */}
      <aside
        className={`w-full ${widthClass} bg-brand-card border-l border-brand-border shadow-2xl flex flex-col animate-slide-in-right`}
      >
        <header className="flex items-start justify-between gap-3 p-5 border-b border-brand-border">
          <div className="min-w-0">
            <h2 className="font-display text-lg text-cream truncate">{title}</h2>
            {subtitle && (
              <p className="mt-0.5 text-xs text-cream-dim truncate">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 w-8 h-8 flex items-center justify-center text-cream-dim hover:text-cream hover:bg-brand-surface transition-colors"
            aria-label="Close"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </aside>
      <style jsx>{`
        @keyframes slide-in-right {
          from {
            transform: translateX(100%);
            opacity: 0.8;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slide-in-right {
          animation: slide-in-right 180ms ease-out;
        }
      `}</style>
    </div>
  );
}
