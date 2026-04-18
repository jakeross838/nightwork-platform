"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";

const ImportContent = dynamic(
  () => import("@/components/vendor-import-content"),
  { ssr: false, loading: () => (
    <div className="flex items-center justify-center py-32">
      <div className="w-8 h-8 border-2 border-teal/30 border-t-teal animate-spin" />
    </div>
  )}
);

export default function VendorImportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (open) { document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = ""; }; }
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 bg-brand-bg flex flex-col animate-fade-in">
      <div className="flex items-center justify-between px-6 py-3 bg-brand-card border-b border-brand-border shrink-0">
        <h2 className="font-display text-lg text-cream">Import Vendors</h2>
        <button onClick={onClose}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-cream-dim hover:text-cream border border-brand-border hover:bg-brand-elevated transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
          Close
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        <ImportContent />
      </div>
    </div>,
    document.body
  );
}
