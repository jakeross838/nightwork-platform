"use client";

import { useState } from "react";
import NwEyebrow from "@/components/nw/Eyebrow";
import NwButton from "@/components/nw/Button";
import NwBadge from "@/components/nw/Badge";
import { toast } from "@/lib/utils/toast";
import LineContextDisplay from "./line-context-display";
import InvoicePdfPreview from "./invoice-pdf-preview";
import type { QueueLine } from "./queue-types";

interface Props {
  line: QueueLine | null;
  onClose: () => void;
  onResolved: (lineId: string) => void;
}

export default function FlaggedDetailPanel({ line, onClose, onResolved }: Props) {
  const [busy, setBusy] = useState(false);

  if (!line) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center max-w-[320px]">
          <p
            className="text-[16px] text-[var(--text-primary)]"
            style={{ fontFamily: "var(--font-space-grotesk)" }}
          >
            Select a flagged line
          </p>
          <p className="mt-1 text-[12px] text-[var(--text-tertiary)]">
            Confirm it&rsquo;s not an item, or reclassify it back into the queue.
          </p>
        </div>
      </div>
    );
  }

  const confirmNotItem = async () => {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/cost-intelligence/extraction-lines/${line.id}/mark-non-item`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transaction_line_type: line.transaction_line_type ?? "other",
          }),
        }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? `Status ${res.status}`);
      toast.success("Confirmed");
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
      toast.success("Moved back to the classification queue");
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
          <NwEyebrow tone="warn">Flagged</NwEyebrow>
          <NwBadge variant="neutral" size="sm">
            {(line.transaction_line_type ?? "other").replace(/_/g, " ")}
          </NwBadge>
        </div>
        <InvoicePdfPreview fileUrl={invoice?.original_file_url} invoiceId={invoice?.id} />
        <LineContextDisplay line={line} />
      </div>

      <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--border-default)] bg-[var(--bg-card)]">
        <NwButton variant="ghost" size="sm" onClick={reclassify} disabled={busy}>
          Actually a real item — reclassify →
        </NwButton>
        <NwButton variant="primary" size="sm" onClick={confirmNotItem} loading={busy}>
          Confirm not an item
        </NwButton>
      </div>
    </div>
  );
}
