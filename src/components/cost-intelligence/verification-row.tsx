"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import NwBadge from "@/components/nw/Badge";
import NwMoney from "@/components/nw/Money";
import NwButton from "@/components/nw/Button";
import { toast } from "@/lib/utils/toast";
import type { TransactionLineType, ProposedItemData } from "@/lib/cost-intelligence/types";
import VerificationEditPanel, {
  type VerificationLineInput,
} from "@/components/cost-intelligence/verification-edit-panel";

export interface QueueLine {
  id: string;
  raw_description: string;
  raw_quantity: number | null;
  raw_unit_text: string | null;
  raw_unit_price_cents: number | null;
  raw_total_cents: number | null;
  match_tier: string | null;
  match_confidence: number | null;
  match_confidence_score: number | null;
  classification_confidence: number | null;
  match_reasoning: string | null;
  created_at: string;
  is_transaction_line: boolean;
  transaction_line_type: TransactionLineType | null;
  proposed_item: { id: string; canonical_name: string } | null;
  proposed_item_data: ProposedItemData | null;
  invoice: {
    id: string;
    invoice_number: string | null;
    invoice_date: string | null;
    vendor_name: string | null;
  } | null;
  line_tax_cents: number | null;
  overhead_allocated_cents: number | null;
  raw_ocr_text?: string | null;
}

interface Props {
  line: QueueLine;
  expanded: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  onExpand: () => void;
  onCollapse: () => void;
  onRowDone: (id: string) => void;
}

const NON_ITEM_TYPES: Array<{ value: TransactionLineType; label: string }> = [
  { value: "progress_payment", label: "Progress payment" },
  { value: "draw", label: "Draw" },
  { value: "rental_period", label: "Rental period" },
  { value: "service_period", label: "Service period" },
  { value: "change_order_narrative", label: "Change order narrative" },
  { value: "partial_payment", label: "Partial payment" },
  { value: "other", label: "Other" },
];

export default function VerificationRow({
  line,
  expanded,
  selected,
  onToggleSelect,
  onExpand,
  onCollapse,
  onRowDone,
}: Props) {
  const [ocrOpen, setOcrOpen] = useState(false);
  const [nonItemOpen, setNonItemOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [approving, setApproving] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);

  const runApprove = useCallback(async () => {
    setApproving(true);
    try {
      const res = await fetch(`/api/cost-intelligence/lines/${line.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `Status ${res.status}`);
      }
      setRemoving(true);
      setTimeout(() => onRowDone(line.id), 220);
    } catch (err) {
      toast.error(`Approve failed: ${err instanceof Error ? err.message : err}`);
      setApproving(false);
    }
  }, [line.id, onRowDone]);

  const markNonItem = useCallback(
    async (type: TransactionLineType) => {
      setNonItemOpen(false);
      setMoreOpen(false);
      try {
        const res = await fetch(
          `/api/cost-intelligence/extraction-lines/${line.id}/mark-non-item`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ transaction_line_type: type }),
          }
        );
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error ?? `Status ${res.status}`);
        }
        setRemoving(true);
        setTimeout(() => onRowDone(line.id), 220);
      } catch (err) {
        toast.error(`Mark non-item failed: ${err instanceof Error ? err.message : err}`);
      }
    },
    [line.id, onRowDone]
  );

  const editLineInput: VerificationLineInput = {
    id: line.id,
    raw_description: line.raw_description,
    raw_quantity: line.raw_quantity,
    raw_unit_text: line.raw_unit_text,
    raw_unit_price_cents: line.raw_unit_price_cents,
    raw_total_cents: line.raw_total_cents,
    match_tier: line.match_tier,
    match_reasoning: line.match_reasoning,
    proposed_item: line.proposed_item,
    proposed_item_data: line.proposed_item_data,
    invoice_number: line.invoice?.invoice_number ?? null,
    invoice_date: line.invoice?.invoice_date ?? null,
    vendor_name: line.invoice?.vendor_name ?? null,
    line_tax_cents: line.line_tax_cents,
    overhead_allocated_cents: line.overhead_allocated_cents,
  };

  return (
    <div
      ref={rowRef}
      className={`border-b border-[var(--border-default)] last:border-b-0 transition-all duration-200 ${
        removing ? "opacity-0 -translate-y-1" : ""
      } ${expanded ? "bg-[var(--bg-subtle)]" : line.is_transaction_line ? "bg-[var(--bg-subtle)]/40" : ""}`}
    >
      {/* COLLAPSED ROW */}
      <div className="flex items-center gap-3 px-3 py-2.5 text-[12px]">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          disabled={line.is_transaction_line}
          className="h-[16px] w-[16px] shrink-0"
          title={line.is_transaction_line ? "Transaction lines — use Not-an-item instead" : undefined}
        />
        <div
          className="w-[80px] shrink-0 text-[var(--text-tertiary)]"
          style={{ fontFamily: "var(--font-jetbrains-mono)" }}
        >
          {new Date(line.created_at).toLocaleDateString()}
        </div>
        <div className="w-[110px] shrink-0">
          {line.invoice ? (
            <a
              href={`/invoices/${line.invoice.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-nw-gulf-blue hover:underline"
            >
              {line.invoice.invoice_number ?? "(no #)"}
            </a>
          ) : (
            "—"
          )}
        </div>
        <div className="w-[180px] shrink-0 text-[var(--text-secondary)] truncate">
          {line.invoice?.vendor_name ?? "—"}
        </div>
        <div
          className="flex-1 min-w-0 text-[var(--text-primary)] truncate"
          style={{ fontFamily: "var(--font-jetbrains-mono)" }}
          title={line.raw_description}
        >
          {line.raw_description}
        </div>
        <div className="w-[180px] shrink-0">
          <RowBadge line={line} />
        </div>
        <div className="w-[100px] shrink-0 text-right">
          <NwMoney cents={line.raw_total_cents} size="sm" />
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setOcrOpen((p) => !p)}
            className="inline-flex items-center justify-center w-[26px] h-[26px] border border-[var(--border-default)] text-[10px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)]"
            title="Show raw line text"
            aria-label="Show raw line text"
            aria-expanded={ocrOpen}
          >
            ⟐
          </button>

          {line.is_transaction_line ? (
            <div className="relative">
              <NwButton
                variant="primary"
                size="sm"
                onClick={() => setNonItemOpen((p) => !p)}
                disabled={approving}
              >
                Not an item
              </NwButton>
              {nonItemOpen && (
                <NonItemDropdown
                  detectedType={line.transaction_line_type}
                  onPick={markNonItem}
                  onClose={() => setNonItemOpen(false)}
                />
              )}
            </div>
          ) : (
            <>
              <NwButton
                variant="primary"
                size="sm"
                onClick={runApprove}
                loading={approving}
                disabled={expanded}
              >
                Approve
              </NwButton>
              <NwButton
                variant="ghost"
                size="sm"
                onClick={expanded ? onCollapse : onExpand}
                disabled={approving}
              >
                {expanded ? "Close" : "Edit"}
              </NwButton>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMoreOpen((p) => !p)}
                  className="inline-flex items-center justify-center w-[26px] h-[26px] border border-[var(--border-default)] text-[12px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)]"
                  title="More actions"
                  aria-label="More actions"
                  aria-expanded={moreOpen}
                >
                  ⋯
                </button>
                {moreOpen && (
                  <div
                    className="absolute right-0 top-full mt-1 z-20 bg-[var(--bg-card)] border border-[var(--border-default)] shadow-lg min-w-[200px]"
                    style={{
                      boxShadow:
                        "0 12px 24px -6px rgba(0,0,0,0.18), 0 4px 10px -2px rgba(0,0,0,0.08)",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setMoreOpen(false);
                        setNonItemOpen(true);
                      }}
                      className="w-full text-left px-3 py-2 text-[12px] text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
                    >
                      Mark as not an item…
                    </button>
                  </div>
                )}
                {nonItemOpen && (
                  <NonItemDropdown
                    detectedType={line.transaction_line_type}
                    onPick={markNonItem}
                    onClose={() => setNonItemOpen(false)}
                  />
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* OCR strip */}
      {ocrOpen && (
        <div className="px-5 pb-3">
          <div
            className="border border-[var(--border-default)] bg-[var(--bg-card)] p-3 text-[11px] max-h-[200px] overflow-auto text-[var(--text-primary)]"
            style={{ fontFamily: "var(--font-jetbrains-mono)", whiteSpace: "pre-wrap" }}
          >
            <div
              className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)] mb-1"
              style={{ fontFamily: "var(--font-jetbrains-mono)" }}
            >
              Raw line
            </div>
            {line.raw_description}
            {line.raw_ocr_text && line.raw_ocr_text.trim() !== line.raw_description.trim() && (
              <>
                <div
                  className="mt-3 text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)] mb-1"
                  style={{ fontFamily: "var(--font-jetbrains-mono)" }}
                >
                  Invoice OCR
                </div>
                {line.raw_ocr_text}
              </>
            )}
            {line.invoice?.id && (
              <div className="mt-3 text-[10px] text-[var(--text-tertiary)]">
                Full invoice:{" "}
                <Link
                  href={`/invoices/${line.invoice.id}`}
                  target="_blank"
                  className="text-nw-gulf-blue hover:underline"
                >
                  open →
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* EDIT EXPANSION */}
      {expanded && <VerificationEditPanel line={editLineInput} onCancel={onCollapse} onSaved={() => onRowDone(line.id)} />}
    </div>
  );
}

function RowBadge({ line }: { line: QueueLine }) {
  if (line.is_transaction_line) {
    const type = (line.transaction_line_type ?? "other").replace(/_/g, " ").toUpperCase();
    return (
      <NwBadge variant="neutral" size="sm">
        TRANSACTION · {type}
      </NwBadge>
    );
  }
  const matchConf = line.match_confidence_score ?? line.match_confidence ?? 0;
  const itemType = line.proposed_item_data?.item_type ?? null;

  if (line.match_tier === "ai_new_item") {
    return (
      <NwBadge variant="accent" size="sm">
        NEW{itemType ? ` · ${itemType.toUpperCase()}` : ""}
      </NwBadge>
    );
  }
  if (line.match_tier === "alias_match") {
    return <NwBadge variant="success" size="sm">KNOWN</NwBadge>;
  }
  if (line.match_tier === "trigram_match") {
    return (
      <NwBadge variant="success" size="sm">
        SIMILAR · {Math.round(matchConf * 100)}%
      </NwBadge>
    );
  }
  if (line.match_tier === "ai_semantic_match") {
    const variant = matchConf >= 0.85 ? "success" : matchConf >= 0.7 ? "accent" : "warning";
    return (
      <NwBadge variant={variant} size="sm">
        MATCH · {Math.round(matchConf * 100)}%
      </NwBadge>
    );
  }
  return <NwBadge variant="neutral" size="sm">{line.match_tier ?? "—"}</NwBadge>;
}

function NonItemDropdown({
  detectedType,
  onPick,
  onClose,
}: {
  detectedType: TransactionLineType | null;
  onPick: (type: TransactionLineType) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="absolute right-0 top-full mt-1 z-30 bg-[var(--bg-card)] border border-[var(--border-default)] shadow-lg min-w-[220px]"
      style={{
        boxShadow: "0 12px 24px -6px rgba(0,0,0,0.18), 0 4px 10px -2px rgba(0,0,0,0.08)",
      }}
    >
      <div
        className="px-3 py-2 border-b border-[var(--border-default)] text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]"
        style={{ fontFamily: "var(--font-jetbrains-mono)" }}
      >
        Mark as…
      </div>
      {NON_ITEM_TYPES.map((t) => (
        <button
          key={t.value}
          type="button"
          onClick={() => onPick(t.value)}
          className={`w-full text-left px-3 py-2 text-[12px] hover:bg-[var(--bg-subtle)] ${
            detectedType === t.value
              ? "bg-[var(--bg-subtle)] text-[var(--text-primary)]"
              : "text-[var(--text-primary)]"
          }`}
        >
          {t.label}
          {detectedType === t.value && (
            <span
              className="ml-2 text-[10px] uppercase tracking-[0.12em] text-[var(--text-tertiary)]"
              style={{ fontFamily: "var(--font-jetbrains-mono)" }}
            >
              detected
            </span>
          )}
        </button>
      ))}
      <button
        type="button"
        onClick={onClose}
        className="w-full text-left px-3 py-2 text-[11px] text-[var(--text-tertiary)] border-t border-[var(--border-default)] hover:text-[var(--text-primary)]"
      >
        Cancel
      </button>
    </div>
  );
}
