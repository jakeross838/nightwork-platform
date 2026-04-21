"use client";

import { useState } from "react";
import NwEyebrow from "@/components/nw/Eyebrow";
import NwButton from "@/components/nw/Button";
import { toast } from "@/lib/utils/toast";
import LineContextDisplay from "./line-context-display";
import InvoicePdfPreview from "./invoice-pdf-preview";
import type { QueueLine } from "./queue-types";

interface Props {
  line: QueueLine | null;
  onClose: () => void;
  onResolved: (lineId: string) => void;
}

export default function NotesDetailPanel({ line, onClose, onResolved }: Props) {
  const [busy, setBusy] = useState(false);

  if (!line) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center max-w-[320px]">
          <p
            className="text-[16px] text-[var(--text-primary)]"
            style={{ fontFamily: "var(--font-space-grotesk)" }}
          >
            Select a $0 note
          </p>
          <p className="mt-1 text-[12px] text-[var(--text-tertiary)]">
            Dismiss if it&rsquo;s really just a note; reclassify if it&rsquo;s
            actually a priced line we missed.
          </p>
        </div>
      </div>
    );
  }

  const dismissNote = async () => {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/cost-intelligence/extraction-lines/${line.id}/mark-non-item`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transaction_line_type: "zero_dollar_note" }),
        }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? `Status ${res.status}`);
      toast.success("Dismissed");
      onResolved(line.id);
    } catch (err) {
      toast.error(`Save failed: ${err instanceof Error ? err.message : err}`);
    } finally {
      setBusy(false);
    }
  };

  const reclassify = async () => {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/cost-intelligence/extraction-lines/${line.id}/unflag`,
        { method: "POST" }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? `Status ${res.status}`);
      toast.success("Moved back to classification queue");
      onResolved(line.id);
    } catch (err) {
      toast.error(`Save failed: ${err instanceof Error ? err.message : err}`);
    } finally {
      setBusy(false);
    }
  };

  const invoice = line.invoice;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-start justify-between gap-2 px-5 py-3 border-b border-[var(--border-default)] bg-[var(--bg-card)] sticky top-0 z-[5]">
        <div className="min-w-0">
          <div
            className="text-[11px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]"
            style={{ fontFamily: "var(--font-jetbrains-mono)" }}
          >
            {invoice?.vendor_name ?? "(no vendor)"}
          </div>
          <div
            className="mt-0.5 text-[15px] text-[var(--text-primary)] truncate"
            style={{ fontFamily: "var(--font-space-grotesk)" }}
          >
            {invoice?.invoice_number
              ? `Invoice ${invoice.invoice_number}`
              : "Invoice (no number)"}
          </div>
          <div className="text-[11px] text-[var(--text-tertiary)]">
            {invoice?.invoice_date ?? "—"}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 w-[28px] h-[28px] inline-flex items-center justify-center border border-[var(--border-default)] text-[14px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
          aria-label="Close"
          title="Close"
        >
          ×
        </button>
      </div>

      <div className="flex-1 overflow-auto px-5 py-4 space-y-4">
        <div className="flex items-center gap-2">
          <NwEyebrow tone="muted">Zero-dollar note</NwEyebrow>
        </div>
        <p className="text-[12px] text-[var(--text-tertiary)]">
          This line has a $0 total and was auto-flagged as a note. Dismiss if
          it&rsquo;s just a narrative line on the invoice. If it should actually
          carry a cost, use &ldquo;Reclassify&rdquo;.
        </p>
        <InvoicePdfPreview fileUrl={invoice?.original_file_url} invoiceId={invoice?.id} />
        <LineContextDisplay line={line} />
      </div>

      <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--border-default)] bg-[var(--bg-card)]">
        <NwButton variant="ghost" size="sm" onClick={reclassify} disabled={busy}>
          Actually has cost — reclassify →
        </NwButton>
        <NwButton variant="primary" size="sm" onClick={dismissNote} loading={busy}>
          Dismiss — just a note
        </NwButton>
      </div>
    </div>
  );
}
