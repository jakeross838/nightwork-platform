"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";

const ImportContent = dynamic(
  () => import("@/components/po-import-content"),
  { ssr: false, loading: () => (
    <div className="flex items-center justify-center py-32">
      <div className="w-8 h-8 border-2 border-stone-blue/30 border-t-teal animate-spin" />
    </div>
  )}
);

export default function POImportModal({
  open,
  onClose,
  jobId,
}: {
  open: boolean;
  onClose: () => void;
  jobId: string;
}) {
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
    <div className="fixed inset-0 z-50 bg-white-sand flex flex-col animate-fade-in">
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-border-def shrink-0">
        <h2 className="font-display text-lg text-slate-tile">Import Purchase Orders</h2>
        <button onClick={onClose}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-tertiary hover:text-slate-tile border border-border-def hover:bg-brand-elevated transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
          Close
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        <ImportContent jobId={jobId} />
      </div>
    </div>,
    document.body
  );
}
