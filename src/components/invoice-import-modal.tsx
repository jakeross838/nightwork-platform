"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import NwButton from "@/components/nw/Button";

const ImportContent = dynamic(
  () => import("@/components/invoice-import-content"),
  { ssr: false, loading: () => (
    <div className="flex items-center justify-center py-32">
      <div
        className="w-8 h-8 border-2 animate-spin"
        style={{ borderColor: "var(--border-default)", borderTopColor: "var(--nw-stone-blue)" }}
      />
    </div>
  )}
);

export default function InvoiceImportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
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
    <div
      className="fixed inset-0 z-50 flex flex-col animate-fade-in"
      style={{ background: "var(--bg-page)" }}
    >
      <div
        className="flex items-center justify-between px-6 py-3 border-b shrink-0"
        style={{ background: "var(--bg-card)", borderColor: "var(--border-default)" }}
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
          Import Invoices
        </h2>
        <NwButton variant="ghost" size="sm" onClick={onClose}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
          Close
        </NwButton>
      </div>
      <div className="flex-1 overflow-y-auto">
        <ImportContent />
      </div>
    </div>,
    document.body
  );
}
