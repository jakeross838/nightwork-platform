"use client";

import { useState } from "react";
import NwButton from "@/components/nw/Button";
import NwEyebrow from "@/components/nw/Eyebrow";
import { toast } from "@/lib/utils/toast";
import type { TransactionLineType } from "@/lib/cost-intelligence/types";

interface NonItemModalProps {
  line: {
    id: string;
    raw_description: string;
    detected_type: TransactionLineType | null;
  };
  onCancel: () => void;
  onSuccess: () => void;
}

const TYPE_OPTIONS: Array<{ value: TransactionLineType; label: string }> = [
  { value: "progress_payment", label: "Progress payment" },
  { value: "draw", label: "Draw" },
  { value: "rental_period", label: "Rental period" },
  { value: "service_period", label: "Service period" },
  { value: "change_order_narrative", label: "Change order narrative" },
  { value: "partial_payment", label: "Partial payment" },
  { value: "other", label: "Other" },
];

export default function NonItemModal({ line, onCancel, onSuccess }: NonItemModalProps) {
  const [type, setType] = useState<TransactionLineType>(line.detected_type ?? "other");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/cost-intelligence/extraction-lines/${line.id}/mark-non-item`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transaction_line_type: type,
            non_item_reason: notes.trim() || null,
          }),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(`Failed: ${err.error ?? res.status}`);
        setBusy(false);
        return;
      }
      toast.success("Marked as non-item");
      onSuccess();
    } catch (err) {
      toast.error(`Failed: ${err instanceof Error ? err.message : err}`);
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div className="w-full max-w-[520px] bg-[var(--bg-card)] border border-[var(--border-default)] shadow-xl p-5">
        <NwEyebrow tone="accent">Verification · Not an item</NwEyebrow>
        <h2
          className="mt-1 text-[20px] tracking-[-0.02em] text-[var(--text-primary)]"
          style={{ fontFamily: "var(--font-space-grotesk)" }}
        >
          Mark this line as not a catalog item?
        </h2>
        <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
          Useful for billing events, draws, rental periods, and service charges that shouldn&apos;t
          be tracked as items.
        </p>

        <div className="mt-4 border border-[var(--border-default)] bg-[var(--bg-subtle)] p-3">
          <div
            className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]"
            style={{ fontFamily: "var(--font-jetbrains-mono)" }}
          >
            Raw line
          </div>
          <div
            className="mt-1 text-[13px] text-[var(--text-primary)]"
            style={{ fontFamily: "var(--font-jetbrains-mono)" }}
          >
            {line.raw_description}
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <label
              htmlFor="non-item-type"
              className="block text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)] mb-1"
              style={{ fontFamily: "var(--font-jetbrains-mono)" }}
            >
              Transaction type
            </label>
            <select
              id="non-item-type"
              value={type}
              onChange={(e) => setType(e.target.value as TransactionLineType)}
              className="w-full px-3 h-[36px] border border-[var(--border-default)] bg-[var(--bg-card)] text-[13px] text-[var(--text-primary)]"
            >
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="non-item-notes"
              className="block text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)] mb-1"
              style={{ fontFamily: "var(--font-jetbrains-mono)" }}
            >
              Notes (optional)
            </label>
            <textarea
              id="non-item-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-[var(--border-default)] bg-[var(--bg-card)] text-[13px] text-[var(--text-primary)] resize-none"
              placeholder="e.g. covers billing period Feb–Mar"
            />
          </div>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <NwButton variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
            Cancel
          </NwButton>
          <NwButton variant="primary" size="sm" onClick={submit} loading={busy}>
            Mark as non-item
          </NwButton>
        </div>
      </div>
    </div>
  );
}
