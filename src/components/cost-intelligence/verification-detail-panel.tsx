"use client";

import { useEffect, useMemo, useState } from "react";
import NwEyebrow from "@/components/nw/Eyebrow";
import NwButton from "@/components/nw/Button";
import NwMoney from "@/components/nw/Money";
import { toast } from "@/lib/utils/toast";
import InvoicePdfPreview from "./invoice-pdf-preview";
import LineContextDisplay from "./line-context-display";
import CostComponentsEditor from "./cost-components-editor";
import ClassificationForm from "./classification-form";
import ScopeDetailsEditor from "./scope-details-editor";
import BomSection from "./bom-section";
import ScopeSplitControls from "./scope-split-controls";
import ReviewControls from "./review-controls";
import type {
  ClassificationDraft,
  ComponentDraft,
  QueueComponent,
  QueueLine,
} from "./queue-types";
import type { TransactionLineType } from "@/lib/cost-intelligence/types";

type Selection =
  | { kind: "single"; line: QueueLine }
  | { kind: "group"; key: string; lines: QueueLine[] };

interface Props {
  selection: Selection | null;
  onClose: () => void;
  onApproved: (affectedLineIds: string[]) => void;
}

const NON_ITEM_TYPES: Array<{ value: TransactionLineType; label: string }> = [
  { value: "progress_payment", label: "Progress payment" },
  { value: "draw", label: "Draw" },
  { value: "rental_period", label: "Rental period" },
  { value: "service_period", label: "Service period" },
  { value: "change_order_narrative", label: "Change order narrative" },
  { value: "partial_payment", label: "Partial payment" },
  { value: "zero_dollar_note", label: "Zero-dollar note" },
  { value: "other", label: "Other" },
];

function toComponentDraft(c: QueueComponent): ComponentDraft {
  return {
    temp_id: `e-${c.id}`,
    existing_id: c.id,
    component_type: c.component_type,
    amount_cents: c.amount_cents,
    source: c.source,
    notes: c.notes ?? "",
    quantity: c.quantity,
    unit: c.unit ?? "",
    unit_rate_cents: c.unit_rate_cents,
  };
}

function defaultClassificationFromLine(line: QueueLine): ClassificationDraft {
  const existingId = line.proposed_item?.id ?? line.proposed_item_id ?? null;
  const proposal = line.proposed_item_data;
  const pricingModel = line.proposed_pricing_model ?? "unit";
  return {
    mode: existingId ? "existing" : "new",
    existing_item_id: existingId,
    canonical_name: proposal?.canonical_name ?? line.raw_description.slice(0, 120),
    item_type: proposal?.item_type ?? "other",
    unit: proposal?.unit ?? "each",
    category: proposal?.category ?? "",
    subcategory: proposal?.subcategory ?? "",
    specs_json: JSON.stringify(proposal?.specs ?? {}, null, 2),
    pricing_model: pricingModel,
    scope_size_metric: line.proposed_scope_size_metric ?? "",
    scope_size_value:
      line.extracted_scope_size_value != null
        ? String(line.extracted_scope_size_value)
        : "",
    scope_size_source:
      line.extracted_scope_size_source === "invoice_text" ||
      line.extracted_scope_size_source === "implied"
        ? "invoice_extraction"
        : line.extracted_scope_size_source ?? null,
    scope_size_confidence: line.extracted_scope_size_confidence,
    scope_allow_component_split: false,
  };
}

export default function VerificationDetailPanel({
  selection,
  onClose,
  onApproved,
}: Props) {
  const [components, setComponents] = useState<ComponentDraft[]>([]);
  const [classification, setClassification] = useState<ClassificationDraft | null>(null);
  const [nonItemOpen, setNonItemOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const primaryLine: QueueLine | null = useMemo(() => {
    if (!selection) return null;
    return selection.kind === "single" ? selection.line : selection.lines[0];
  }, [selection]);

  // Seed drafts when selection changes
  useEffect(() => {
    if (!primaryLine) {
      setComponents([]);
      setClassification(null);
      setNonItemOpen(false);
      return;
    }
    setNonItemOpen(false);
    setClassification(defaultClassificationFromLine(primaryLine));

    const components =
      primaryLine.components.length > 0
        ? primaryLine.components.map(toComponentDraft)
        : [
            {
              temp_id: `fresh-${primaryLine.id}`,
              existing_id: null,
              component_type: "bundled" as const,
              amount_cents: primaryLine.raw_total_cents ?? 0,
              source: "default_bundled" as const,
              notes: "",
              quantity: null,
              unit: "",
              unit_rate_cents: null,
            },
          ];
    setComponents(components);
  }, [primaryLine]);

  if (!selection || !primaryLine || !classification) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center max-w-[360px]">
          <div
            className="mx-auto mb-3 inline-flex items-center justify-center w-12 h-12 border border-[var(--border-default)] bg-[var(--bg-subtle)] text-[var(--text-tertiary)]"
            aria-hidden="true"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 22 22"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="10" cy="10" r="5" />
              <path d="m14 14 5 5" />
            </svg>
          </div>
          <p
            className="text-[16px] text-[var(--text-primary)]"
            style={{ fontFamily: "var(--font-space-grotesk)" }}
          >
            Select a line to review
          </p>
          <p className="mt-1 text-[12px] text-[var(--text-tertiary)]">
            Choose from the queue to see details and classify
          </p>
        </div>
      </div>
    );
  }

  const isGroup = selection.kind === "group";
  const lineIds = selection.kind === "group" ? selection.lines.map((l) => l.id) : [primaryLine.id];
  const lineTotal =
    selection.kind === "group"
      ? selection.lines.reduce((s, l) => s + (l.raw_total_cents ?? 0), 0)
      : primaryLine.raw_total_cents ?? 0;
  const perLineTotal = primaryLine.raw_total_cents ?? 0;

  const invoice = primaryLine.invoice;

  const save = async () => {
    if (!classification) return;

    if (classification.mode === "existing" && !classification.existing_item_id) {
      toast.error("Pick an existing item or switch to 'Create new'");
      return;
    }
    if (classification.mode === "new" && !classification.canonical_name.trim()) {
      toast.error("Item name is required");
      return;
    }

    let parsedSpecs: Record<string, unknown> = {};
    if (classification.mode === "new") {
      try {
        parsedSpecs = JSON.parse(classification.specs_json || "{}");
      } catch (err) {
        console.warn("[detail-panel] specs JSON.parse failed (F-022):", err);
        toast.error("Specs JSON is invalid");
        return;
      }
    }

    const scopeSize = Number.parseFloat(classification.scope_size_value);
    const scopePayload =
      classification.pricing_model === "scope"
        ? {
            pricing_model: "scope" as const,
            scope_size_metric: classification.scope_size_metric.trim() || null,
            scope_size_value: Number.isFinite(scopeSize) && scopeSize > 0 ? scopeSize : null,
            scope_size_source:
              Number.isFinite(scopeSize) && scopeSize > 0
                ? classification.scope_size_source ?? "manual"
                : null,
            scope_size_confidence:
              classification.scope_size_source === "invoice_extraction"
                ? classification.scope_size_confidence
                : null,
          }
        : null;

    setSaving(true);
    try {
      if (isGroup) {
        // Bulk group approval via new endpoint
        const body = {
          line_ids: lineIds,
          classification:
            classification.mode === "existing"
              ? { item_id: classification.existing_item_id }
              : {
                  new_item: {
                    canonical_name: classification.canonical_name.trim(),
                    item_type: classification.item_type,
                    category: classification.category.trim() || null,
                    subcategory: classification.subcategory.trim() || null,
                    specs: parsedSpecs,
                    unit: classification.unit,
                  },
                },
          components: components.map((c) => ({
            component_type: c.component_type,
            amount_cents: c.amount_cents,
            source: c.source,
            notes: c.notes || null,
            quantity: c.quantity,
            unit: c.unit || null,
            unit_rate_cents: c.unit_rate_cents,
          })),
          scope: scopePayload,
        };
        const res = await fetch(
          "/api/cost-intelligence/extraction-lines/bulk-approve-group",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }
        );
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? `Status ${res.status}`);
        toast.success(
          `Approved ${json.approved} line${json.approved === 1 ? "" : "s"}${
            json.failed ? ` · ${json.failed} failed` : ""
          }`
        );
        onApproved(json.approved_line_ids ?? lineIds);
      } else {
        // Single-line path: persist scope fields, replace components, then approve.
        if (scopePayload) {
          await patchLineScope(primaryLine.id, scopePayload);
        }
        await replaceSingleLineComponents(primaryLine.id, components);

        const body: Record<string, unknown> =
          classification.mode === "existing"
            ? {
                action: "correct",
                corrected_item_id: classification.existing_item_id,
              }
            : {
                action: "correct",
                corrected_proposed_data: {
                  canonical_name: classification.canonical_name.trim(),
                  item_type: classification.item_type,
                  category: classification.category.trim() || null,
                  subcategory: classification.subcategory.trim() || null,
                  specs: parsedSpecs,
                  unit: classification.unit,
                },
              };

        // If user didn't touch anything, fast-path to straight approve
        const proposal = primaryLine.proposed_item_data;
        const isExistingUnchanged =
          classification.mode === "existing" &&
          classification.existing_item_id === (primaryLine.proposed_item?.id ?? null);
        const isNewUnchanged =
          classification.mode === "new" &&
          proposal &&
          classification.canonical_name.trim() === proposal.canonical_name &&
          classification.item_type === proposal.item_type &&
          classification.unit === proposal.unit &&
          (classification.category.trim() || null) === proposal.category &&
          (classification.subcategory.trim() || null) === proposal.subcategory;

        if (isExistingUnchanged || isNewUnchanged) {
          body.action = "approve";
        }

        const res = await fetch(`/api/cost-intelligence/lines/${primaryLine.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error ?? `Status ${res.status}`);
        toast.success("Committed to spine");
        onApproved([primaryLine.id]);
      }
    } catch (err) {
      toast.error(`Save failed: ${err instanceof Error ? err.message : err}`);
    } finally {
      setSaving(false);
    }
  };

  const markNonItem = async (type: TransactionLineType) => {
    setSaving(true);
    try {
      const res = await fetch(
        `/api/cost-intelligence/extraction-lines/${primaryLine.id}/mark-non-item`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transaction_line_type: type }),
        }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? `Status ${res.status}`);
      toast.success(`Marked as ${type.replace(/_/g, " ")}`);
      onApproved([primaryLine.id]);
    } catch (err) {
      toast.error(`Mark failed: ${err instanceof Error ? err.message : err}`);
    } finally {
      setSaving(false);
      setNonItemOpen(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Sticky header */}
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
            {isGroup && (
              <>
                {" · "}
                <span className="text-[var(--nw-stone-blue)]">
                  group of {selection.lines.length}
                </span>
              </>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 w-[28px] h-[28px] inline-flex items-center justify-center border border-[var(--border-default)] text-[14px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)]"
          aria-label="Close detail panel"
          title="Close"
        >
          ×
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-auto px-5 py-4 space-y-5">
        <InvoicePdfPreview
          fileUrl={invoice?.signed_pdf_url}
          invoiceId={invoice?.id}
        />

        <LineContextDisplay line={primaryLine} />

        {primaryLine.line_nature !== "scope" && (
          <ReviewControls
            lineIds={lineIds}
            currentNature={primaryLine.line_nature}
            onReclassified={(ids) => onApproved(ids)}
          />
        )}

        {!isGroup && primaryLine.line_nature === "scope" && (
          <BomSection
            scopeLineId={primaryLine.id}
            extractionId={primaryLine.extraction_id}
          />
        )}

        {!isGroup && primaryLine.line_nature === "scope" && (
          <section className="border border-[var(--border-default)] bg-[var(--bg-card)] p-4 space-y-2">
            <NwEyebrow tone="accent">Cost breakdown</NwEyebrow>
            <p className="text-[12px] text-[var(--text-secondary)]">
              {primaryLine.scope_split_into_components
                ? "This scope has been split into material and labor components."
                : "This scope combines labor and material in a single bundled total. Split only if you have a reliable material estimate."}
            </p>
            <ScopeSplitControls
              lineId={primaryLine.id}
              lineTotalCents={primaryLine.raw_total_cents ?? 0}
              splitActive={primaryLine.scope_split_into_components}
              currentMaterialCents={primaryLine.scope_estimated_material_cents}
              onSplitChanged={() => onApproved([primaryLine.id])}
            />
          </section>
        )}

        {classification.pricing_model === "scope" && (
          <ScopeDetailsEditor
            draft={classification}
            lineTotalCents={perLineTotal}
            onChange={setClassification}
            aiExtractedConfidence={primaryLine.extracted_scope_size_confidence}
          />
        )}

        <CostComponentsEditor
          components={components}
          lineTotalCents={perLineTotal}
          onChange={setComponents}
          scopeMode={classification.pricing_model === "scope"}
          allowScopeSplit={classification.scope_allow_component_split}
          onToggleAllowScopeSplit={(next) =>
            setClassification((prev) =>
              prev ? { ...prev, scope_allow_component_split: next } : prev
            )
          }
        />

        <ClassificationForm draft={classification} onChange={setClassification} />

        {isGroup && (
          <section className="border border-[var(--nw-warn)]/40 bg-[color:var(--nw-warn)]/5 p-3 space-y-2">
            <div className="flex items-baseline gap-2">
              <NwEyebrow tone="warn">Applies to group</NwEyebrow>
              <span className="text-[11px] text-[var(--text-tertiary)]">
                {selection.lines.length} lines
              </span>
            </div>
            <p className="text-[12px] text-[var(--text-secondary)]">
              This classification and component breakdown will be applied to all{" "}
              {selection.lines.length} similar lines below. Group total:{" "}
              <span
                className="text-[var(--text-primary)]"
                style={{
                  fontFamily: "var(--font-jetbrains-mono)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                <NwMoney cents={lineTotal} size="sm" />
              </span>
              .
            </p>
            <ul className="max-h-[120px] overflow-auto text-[11px] text-[var(--text-tertiary)] space-y-1">
              {selection.lines.map((l) => (
                <li
                  key={l.id}
                  className="flex items-center justify-between gap-2 truncate"
                  style={{ fontFamily: "var(--font-jetbrains-mono)" }}
                >
                  <span className="truncate">{l.raw_description}</span>
                  <NwMoney cents={l.raw_total_cents} size="sm" />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {/* Sticky footer */}
      <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--border-default)] bg-[var(--bg-card)]">
        {!isGroup && (
          <div className="relative mr-auto">
            <NwButton
              variant="ghost"
              size="sm"
              onClick={() => setNonItemOpen((v) => !v)}
              disabled={saving}
            >
              Mark as not item
            </NwButton>
            {nonItemOpen && (
              <div
                className="absolute bottom-full left-0 mb-1 z-20 bg-[var(--bg-card)] border border-[var(--border-default)] shadow-lg min-w-[220px]"
                style={{
                  boxShadow:
                    "0 12px 24px -6px rgba(0,0,0,0.18), 0 4px 10px -2px rgba(0,0,0,0.08)",
                }}
              >
                <div
                  className="px-3 py-2 border-b border-[var(--border-default)] text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]"
                  style={{ fontFamily: "var(--font-jetbrains-mono)" }}
                >
                  Not an item…
                </div>
                {NON_ITEM_TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => markNonItem(t.value)}
                    className="w-full text-left px-3 py-2 text-[12px] text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <NwButton variant="ghost" size="sm" onClick={onClose} disabled={saving}>
          Cancel
        </NwButton>
        <NwButton variant="primary" size="sm" onClick={save} loading={saving}>
          {isGroup ? `Save & Approve ${selection.lines.length}` : "Save & Approve"}
        </NwButton>
      </div>
    </div>
  );
}

async function replaceSingleLineComponents(
  lineId: string,
  next: ComponentDraft[]
): Promise<void> {
  const res = await fetch(
    `/api/cost-intelligence/extraction-lines/${lineId}/components`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        components: next.map((c) => ({
          component_type: c.component_type,
          amount_cents: c.amount_cents,
          source: c.source,
          notes: c.notes || null,
          quantity: c.quantity,
          unit: c.unit || null,
          unit_rate_cents: c.unit_rate_cents,
        })),
      }),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `Components save failed: ${res.status}`);
  }
}

interface ScopePayload {
  pricing_model: "scope";
  scope_size_metric: string | null;
  scope_size_value: number | null;
  scope_size_source: string | null;
  scope_size_confidence: number | null;
}

async function patchLineScope(lineId: string, scope: ScopePayload): Promise<void> {
  const res = await fetch(`/api/cost-intelligence/extraction-lines/${lineId}/scope`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(scope),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `Scope save failed: ${res.status}`);
  }
}
