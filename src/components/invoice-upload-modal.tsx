"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

/**
 * Full-screen overlay that hosts the invoice upload flow.
 * Renders on top of the current page (modal behavior) but
 * uses the full viewport (the upload flow needs side-by-side
 * space for document preview + parsed data).
 *
 * Lazy-loads the upload page content to keep the invoices
 * list page bundle small.
 */

// Dynamic import of the upload content — loaded only when
// the modal opens, keeping the list page's initial bundle lean.
import dynamic from "next/dynamic";
const UploadContent = dynamic(
  () => import("@/components/invoice-upload-content"),
  { ssr: false, loading: () => (
    <div className="flex items-center justify-center py-32">
      <div className="w-8 h-8 border-2 border-teal/30 border-t-teal animate-spin" />
    </div>
  )}
);

export default function InvoiceUploadModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 bg-brand-bg flex flex-col animate-fade-in">
      {/* Header bar */}
      <div className="flex items-center justify-between px-6 py-3 bg-brand-card border-b border-brand-border shrink-0">
        <h2 className="font-display text-lg text-cream">Upload Invoices</h2>
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-cream-dim hover:text-cream border border-brand-border hover:bg-brand-elevated transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
          Close
        </button>
      </div>
      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <UploadContent />
      </div>
    </div>,
    document.body
  );
}
