"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import NwEyebrow from "@/components/nw/Eyebrow";
import NwBadge from "@/components/nw/Badge";
import NwButton from "@/components/nw/Button";
import NwMoney from "@/components/nw/Money";
import { toast } from "@/lib/utils/toast";
import RawOcrViewer from "@/components/items/raw-ocr-viewer";
import type {
  DocumentExtractionRow,
  DocumentExtractionLineRow,
  LineCostComponentRow,
  ComponentType,
} from "@/lib/cost-intelligence/types";

export type ExtractionLineView = DocumentExtractionLineRow & {
  proposed_item: { id: string; canonical_name: string } | null;
  verified_item: { id: string; canonical_name: string } | null;
  components: LineCostComponentRow[];
};

interface Props {
  invoiceId: string;
  /** Initial data fetched server-side; if omitted component fetches itself. */
  initialExtraction?: DocumentExtractionRow | null;
  initialLines?: ExtractionLineView[];
}

const COMPONENT_TYPE_LABELS: Record<ComponentType, string> = {
  material: "Material",
  fabrication: "Fabrication",
  installation: "Installation",
  labor: "Labor",
  equipment_rental: "Equipment",
  delivery: "Delivery",
  fuel_surcharge: "Fuel",
  handling: "Handling",
  restocking: "Restocking",
  tax: "Tax",
  waste_disposal: "Waste",
  permit_fee: "Permit",
  bundled: "Bundled",
  labor_and_material: "Labor & material",
  other: "Other",
};

export default function ExtractionVerificationPanel({
  invoiceId,
  initialExtraction = null,
  initialLines = [],
}: Props) {
  const [extraction, setExtraction] = useState<DocumentExtractionRow | null>(initialExtraction);
  const [lines, setLines] = useState<ExtractionLineView[]>(initialLines);
  const [loading, setLoading] = useState(!initialExtraction);
  const [ocrOpen, setOcrOpen] = useState(false);
  const [extractBusy, setExtractBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/cost-intelligence/extractions/${invoiceId}`);
      if (!res.ok) throw new Error(`Load failed: ${res.status}`);
      const json = await res.json();
      setExtraction(json.extraction);
      setLines(json.lines ?? []);
    } catch (err) {
      toast.error(`Load extraction failed: ${err instanceof Error ? err.message : err}`);
    } finally {
      setLoading(false);
    }
  }, [invoiceId]);

  useEffect(() => {
    if (!initialExtraction) void load();
  }, [initialExtraction, load]);

  const triggerExtract = useCallback(async (reextract: boolean) => {
    setExtractBusy(true);
    try {
      const res = await fetch(`/api/cost-intelligence/extractions/${invoiceId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reextract }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `Status ${res.status}`);
      }
      toast.success(reextract ? "Re-extraction complete" : "Extraction complete");
      await load();
    } catch (err) {
      toast.error(`Extraction failed: ${err instanceof Error ? err.message : err}`);
    } finally {
      setExtractBusy(false);
    }
  }, [invoiceId, load]);

  const pendingCount = lines.filter((l) => l.verification_status === "pending").length;
  const verifiedCount = lines.filter((l) =>
    ["verified", "corrected", "auto_committed"].includes(l.verification_status)
  ).length;
  const rejectedCount = lines.filter((l) => l.verification_status === "rejected").length;

  const progressPct = lines.length > 0 ? Math.round((verifiedCount / lines.length) * 100) : 0;

  const bannerVariant = useMemo(() => {
    if (!extraction) return "neutral";
    if (extraction.verification_status === "verified") return "success";
    if (extraction.verification_status === "rejected") return "danger";
    if (extraction.verification_status === "partial") return "warning";
    return "info";
  }, [extraction]);

  return (
    <section className="mt-10 border-t border-[var(--border-default)] pt-8">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <NwEyebrow tone="accent">Extraction · Cost Intelligence</NwEyebrow>
          <h2
            className="mt-2 text-[22px] tracking-[-0.02em] text-[var(--text-primary)]"
            style={{ fontFamily: "var(--font-space-grotesk)" }}
          >
            AI-extracted line items
          </h2>
          <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
            Status and component breakdowns. To classify or edit, open the
            verification queue.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/cost-intelligence/verification?invoice_id=${invoiceId}`}
            className="inline-flex items-center h-[32px] px-3 border border-[var(--nw-stone-blue)] text-[11px] uppercase tracking-[0.12em] text-[var(--nw-stone-blue)] hover:bg-[var(--bg-subtle)]"
            style={{ fontFamily: "var(--font-jetbrains-mono)" }}
          >
            → Verify in full queue
          </Link>
          <NwButton
            variant="ghost"
            size="sm"
            onClick={() => setOcrOpen((s) => !s)}
            disabled={!extraction}
          >
            {ocrOpen ? "Hide raw" : "View raw OCR"}
          </NwButton>
          {extraction ? (
            <NwButton
              variant="secondary"
              size="sm"
              onClick={() => triggerExtract(true)}
              loading={extractBusy}
            >
              Re-extract
            </NwButton>
          ) : (
            <NwButton
              variant="primary"
              size="sm"
              onClick={() => triggerExtract(false)}
              loading={extractBusy}
            >
              Run extraction
            </NwButton>
          )}
        </div>
      </div>

      {loading ? (
        <p className="text-[13px] text-[var(--text-tertiary)]">Loading…</p>
      ) : !extraction ? (
        <div className="border border-[var(--border-default)] p-5 bg-[var(--bg-card)]">
          <p className="text-[13px] text-[var(--text-secondary)]">
            No extraction has been run for this invoice yet. Click{" "}
            <span className="text-[var(--text-primary)] font-medium">Run extraction</span> to stage
            line-by-line item classification.
          </p>
        </div>
      ) : (
        <>
          {/* Status banner */}
          <div className="mb-4 border border-[var(--border-default)] p-4 bg-[var(--bg-card)] flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <NwBadge variant={bannerVariant} size="md">
                {extraction.verification_status}
              </NwBadge>
              <span className="text-[13px] text-[var(--text-secondary)]">
                <span className="font-medium text-[var(--text-primary)]">{verifiedCount}</span> of{" "}
                <span className="font-medium text-[var(--text-primary)]">{lines.length}</span> lines
                verified
                {rejectedCount > 0 ? ` · ${rejectedCount} rejected` : ""}
                {pendingCount > 0 ? ` · ${pendingCount} pending` : ""}
              </span>
            </div>

            {extraction.auto_committed ? (
              <NwBadge variant="accent" size="sm">
                Auto-committed
              </NwBadge>
            ) : null}

            <div className="min-w-[140px]">
              <div className="h-[4px] bg-[var(--bg-subtle)] relative">
                <div
                  className="absolute inset-y-0 left-0 bg-[var(--nw-stone-blue)]"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <div
                className="mt-1 text-right text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]"
                style={{ fontFamily: "var(--font-jetbrains-mono)" }}
              >
                {progressPct}%
              </div>
            </div>
          </div>

          {/* Raw OCR drawer */}
          {ocrOpen && extraction ? <RawOcrViewer extraction={extraction} /> : null}

          {/* Invoice totals */}
          <InvoiceTotalsPanel extraction={extraction} lineCount={lines.length} />

          {/* Line list — read-only */}
          {lines.length === 0 ? (
            <p className="text-[13px] text-[var(--text-tertiary)]">No lines extracted.</p>
          ) : (
            <ul className="space-y-3">
              {lines.map((line) => (
                <LineRow key={line.id} line={line} invoiceId={invoiceId} />
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

interface LineRowProps {
  line: ExtractionLineView;
  invoiceId: string;
}

function LineRow({ line, invoiceId }: LineRowProps) {
  const status = line.verification_status;
  const tier = line.match_tier;
  const confidence = line.match_confidence ?? 0;
  const isOverhead = line.is_allocated_overhead;

  if (isOverhead) {
    return (
      <li className="border border-dashed border-[var(--border-default)] bg-[var(--bg-subtle)] p-4 grid grid-cols-1 lg:grid-cols-[1fr_1fr_auto] gap-4 items-start opacity-80">
        <div>
          <NwEyebrow tone="muted">Invoice-level charge</NwEyebrow>
          <p
            className="mt-2 text-[13px] text-[var(--text-secondary)]"
            style={{ fontFamily: "var(--font-jetbrains-mono)" }}
          >
            {line.raw_description}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-[var(--text-tertiary)]">
            <span>
              amount <NwMoney cents={line.raw_total_cents} size="sm" variant="emphasized" showCents />
            </span>
          </div>
        </div>
        <div>
          <NwEyebrow tone="muted">Allocated</NwEyebrow>
          <p className="mt-2 text-[12px] italic text-[var(--text-tertiary)] leading-relaxed">
            Redistributed proportionally to real line items by pre-tax total. No item is created
            for it.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 min-w-[160px]">
          <NwBadge variant="neutral" size="sm">
            {(line.overhead_type ?? "overhead").replace(/_/g, " ")}
          </NwBadge>
        </div>
      </li>
    );
  }

  const statusBadge = (() => {
    if (status === "verified" || status === "corrected" || status === "auto_committed")
      return <NwBadge variant="success">{status}</NwBadge>;
    if (status === "rejected") return <NwBadge variant="danger">rejected</NwBadge>;
    if (status === "not_item") return <NwBadge variant="neutral">not an item</NwBadge>;
    return <NwBadge variant="warning">pending</NwBadge>;
  })();

  const tierBadge = (() => {
    if (!tier) return null;
    const variant =
      tier === "alias_match" || tier === "trigram_match"
        ? "accent"
        : tier === "ai_semantic_match"
        ? "info"
        : "warning";
    return (
      <NwBadge variant={variant} size="sm">
        {tier.replace(/_/g, " ")}
      </NwBadge>
    );
  })();

  const proposedName =
    line.verified_item?.canonical_name ??
    line.proposed_item?.canonical_name ??
    line.proposed_item_data?.canonical_name ??
    "(unclassified)";

  const components = line.components ?? [];
  const componentsSum = components.reduce((s, c) => s + c.amount_cents, 0);

  return (
    <li className="border border-[var(--border-default)] bg-[var(--bg-card)] p-4 grid grid-cols-1 lg:grid-cols-[1fr_1fr_auto] gap-4 items-start">
      {/* LEFT — raw evidence */}
      <div>
        <NwEyebrow tone="muted">Raw from invoice</NwEyebrow>
        <p
          className="mt-2 text-[13px] text-[var(--text-primary)]"
          style={{ fontFamily: "var(--font-jetbrains-mono)" }}
        >
          {line.raw_description}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-[var(--text-tertiary)]">
          {line.raw_quantity != null && (
            <span>
              qty{" "}
              <span
                className="text-[var(--text-secondary)]"
                style={{
                  fontFamily: "var(--font-jetbrains-mono)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {line.raw_quantity}
              </span>
              {line.raw_unit_text ? ` ${line.raw_unit_text}` : ""}
            </span>
          )}
          {line.raw_unit_price_cents != null && (
            <span>
              unit <NwMoney cents={line.raw_unit_price_cents} size="sm" />
            </span>
          )}
          <span>
            total <NwMoney cents={line.raw_total_cents} size="sm" variant="emphasized" showCents />
          </span>
        </div>

        {components.length > 0 && (
          <div
            className="mt-3 border border-[var(--border-default)] bg-[var(--bg-subtle)] p-2 text-[11px]"
            style={{ fontFamily: "var(--font-jetbrains-mono)" }}
          >
            <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)] mb-1">
              Components
            </div>
            <div className="space-y-0.5">
              {components.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-3 text-[var(--text-secondary)]"
                >
                  <span className="truncate">
                    {COMPONENT_TYPE_LABELS[c.component_type] ?? c.component_type}
                    {c.notes ? (
                      <span className="text-[var(--text-tertiary)] italic"> · {c.notes}</span>
                    ) : null}
                  </span>
                  <span
                    className="text-[var(--text-primary)]"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    <NwMoney cents={c.amount_cents} size="sm" />
                  </span>
                </div>
              ))}
              {Math.abs(componentsSum - (line.raw_total_cents ?? 0)) > 5 && (
                <div className="pt-1 text-[10px] text-[var(--nw-warn)]">
                  Components sum off by $
                  {(Math.abs(componentsSum - (line.raw_total_cents ?? 0)) / 100).toFixed(2)}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* MIDDLE — classification */}
      <div>
        <NwEyebrow tone="accent">Classification</NwEyebrow>
        <p className="mt-2 text-[13px] text-[var(--text-primary)] font-medium">{proposedName}</p>
        {line.proposed_item_data ? (
          <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">
            {line.proposed_item_data.item_type}
            {line.proposed_item_data.category ? ` · ${line.proposed_item_data.category}` : ""}
            {line.proposed_item_data.subcategory
              ? ` · ${line.proposed_item_data.subcategory}`
              : ""}
          </p>
        ) : null}
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          {tierBadge}
          <span
            className="text-[11px] text-[var(--text-secondary)]"
            style={{
              fontFamily: "var(--font-jetbrains-mono)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {Math.round(confidence * 100)}%
          </span>
        </div>
        {line.match_reasoning ? (
          <p className="mt-2 text-[11px] italic text-[var(--text-tertiary)] leading-relaxed">
            {line.match_reasoning}
          </p>
        ) : null}
      </div>

      {/* RIGHT — status only (no actions) */}
      <div className="flex flex-col items-end gap-2 min-w-[180px]">
        {statusBadge}
        {status === "pending" && (
          <Link
            href={`/cost-intelligence/verification?invoice_id=${invoiceId}`}
            className="inline-flex items-center justify-center h-[30px] px-3 border border-[var(--border-default)] text-[11px] uppercase tracking-[0.12em] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)]"
            style={{ fontFamily: "var(--font-jetbrains-mono)" }}
          >
            Verify in queue →
          </Link>
        )}
      </div>
    </li>
  );
}

function InvoiceTotalsPanel({
  extraction,
  lineCount,
}: {
  extraction: DocumentExtractionRow;
  lineCount: number;
}) {
  const subtotal = extraction.invoice_subtotal_cents;
  const tax = extraction.invoice_tax_cents ?? 0;
  const taxRate = extraction.invoice_tax_rate;
  const overhead = Array.isArray(extraction.invoice_overhead) ? extraction.invoice_overhead : [];
  const overheadTotal = overhead.reduce((s, o) => s + (o.amount_cents ?? 0), 0);
  const total = extraction.invoice_total_cents;
  const implied = (subtotal ?? 0) + tax + overheadTotal;
  const diff = total != null && subtotal != null ? total - implied : null;
  const reconcileOk = diff == null || Math.abs(diff) <= 2;

  if (subtotal == null && tax === 0 && overhead.length === 0 && total == null) {
    return null;
  }

  return (
    <div className="mb-4 border border-[var(--border-default)] bg-[var(--bg-card)] p-4">
      <NwEyebrow tone="muted">Invoice totals</NwEyebrow>
      <div
        className="mt-3 grid grid-cols-[auto_1fr_auto] gap-x-6 gap-y-1.5 text-[12px]"
        style={{ fontFamily: "var(--font-jetbrains-mono)", fontVariantNumeric: "tabular-nums" }}
      >
        {subtotal != null ? (
          <>
            <span className="text-[var(--text-tertiary)] uppercase tracking-[0.12em] text-[10px] self-center">
              Subtotal
            </span>
            <span className="text-[var(--text-tertiary)] text-[10px] italic self-center">pre-tax</span>
            <span className="text-right text-[var(--text-primary)] whitespace-nowrap">
              <NwMoney cents={subtotal} size="sm" showCents />
            </span>
          </>
        ) : null}

        {tax > 0 ? (
          <>
            <span className="text-[var(--text-tertiary)] uppercase tracking-[0.12em] text-[10px] self-center">
              Tax
            </span>
            <span className="text-[var(--text-tertiary)] text-[10px] italic self-center">
              {taxRate != null ? `${(taxRate * 100).toFixed(2)}% rate` : "rate unknown"} · prorated
              to taxable lines
            </span>
            <span className="text-right text-[var(--text-primary)] whitespace-nowrap">
              <NwMoney cents={tax} size="sm" showCents />
            </span>
          </>
        ) : null}

        {overhead.map((o, i) => (
          <Fragment key={i}>
            <span className="text-[var(--text-tertiary)] uppercase tracking-[0.12em] text-[10px] self-center">
              {(o.type ?? "overhead").replace(/_/g, " ")}
            </span>
            <span className="text-[var(--text-tertiary)] text-[10px] italic self-center truncate">
              {o.description || "allocated across lines"}
            </span>
            <span className="text-right text-[var(--text-primary)] whitespace-nowrap">
              <NwMoney cents={o.amount_cents ?? 0} size="sm" showCents />
            </span>
          </Fragment>
        ))}

        {total != null ? (
          <>
            <span className="col-span-3 border-t border-[var(--border-default)] pt-0.5" aria-hidden />
            <span className="text-[var(--text-primary)] uppercase tracking-[0.12em] text-[10px] self-center font-medium">
              Total
            </span>
            <span className="text-[var(--text-tertiary)] text-[10px] italic self-center">
              {lineCount} line{lineCount === 1 ? "" : "s"}
              {reconcileOk
                ? " · reconciled"
                : ` · mismatch ${diff && diff > 0 ? "+" : ""}${((diff ?? 0) / 100).toFixed(2)}`}
            </span>
            <span className="text-right text-[var(--text-primary)] font-medium whitespace-nowrap">
              <NwMoney cents={total} size="sm" variant="emphasized" showCents />
            </span>
          </>
        ) : null}
      </div>
    </div>
  );
}
