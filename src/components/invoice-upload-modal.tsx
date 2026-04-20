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
import NwButton from "@/components/nw/Button";
const UploadContent = dynamic(
  () => import("@/components/invoice-upload-content"),
  { ssr: false, loading: () => (
    <div className="flex items-center justify-center py-32">
      <div
        className="w-8 h-8 border-2 animate-spin"
        style={{
          borderColor: "var(--border-default)",
          borderTopColor: "var(--nw-stone-blue)",
        }}
      />
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
    <div
      className="fixed inset-0 z-50 flex flex-col animate-fade-in"
      style={{ background: "var(--bg-page)" }}
    >
      {/* Header bar */}
      <div
        className="flex items-center justify-between px-6 py-3 border-b shrink-0"
        style={{
          background: "var(--bg-card)",
          borderColor: "var(--border-default)",
        }}
      >
        <h2
          className="m-0"
          style={{
            fontFamily: "var(--font-space-grotesk)",
            fontWeight: 500,
            fontSize: "18px",
            letterSpacing: "-0.01em",
            color: "var(--text-primary)",
          }}
        >
          Upload Invoices
        </h2>
        <NwButton variant="ghost" size="sm" onClick={onClose}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
          Close
        </NwButton>
      </div>
      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <UploadContent />
      </div>
    </div>,
    document.body
  );
}
