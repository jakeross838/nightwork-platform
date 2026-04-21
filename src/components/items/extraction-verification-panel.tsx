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
  InvoiceExtractionRow,
  InvoiceExtractionLineRow,
} from "@/lib/cost-intelligence/types";

export type ExtractionLineView = InvoiceExtractionLineRow & {
  proposed_item: { id: string; canonical_name: string } | null;
  verified_item: { id: string; canonical_name: string } | null;
};

interface Props {
  invoiceId: string;
  /** Initial data fetched server-side; if omitted component fetches itself. */
  initialExtraction?: InvoiceExtractionRow | null;
  initialLines?: ExtractionLineView[];
}

export default function ExtractionVerificationPanel({
  invoiceId,
  initialExtraction = null,
  initialLines = [],
}: Props) {
  const [extraction, setExtraction] = useState<InvoiceExtractionRow | null>(initialExtraction);
  const [lines, setLines] = useState<ExtractionLineView[]>(initialLines);
  const [loading, setLoading] = useState(!initialExtraction);
  const [busyLineId, setBusyLineId] = useState<string | null>(null);
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

  const approveLine = useCallback(async (lineId: string) => {
    setBusyLineId(lineId);
    try {
      const res = await fetch(`/api/cost-intelligence/lines/${lineId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `Status ${res.status}`);
      }
      toast.success("Line committed to spine");
      await load();
    } catch (err) {
      toast.error(`Approve failed: ${err instanceof Error ? err.message : err}`);
    } finally {
      setBusyLineId(null);
    }
  }, [load]);

  const rejectLine = useCallback(async (lineId: string) => {
    if (!confirm("Reject this line? It will not enter cost intelligence.")) return;
    setBusyLineId(lineId);
    try {
      const res = await fetch(`/api/cost-intelligence/lines/${lineId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject" }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `Status ${res.status}`);
      }
      toast.success("Line rejected");
      await load();
    } catch (err) {
      toast.error(`Reject failed: ${err instanceof Error ? err.message : err}`);
    } finally {
      setBusyLineId(null);
    }
  }, [load]);

  const pendingCount = lines.filter((l) => l.verification_status === "pending").length;
  const verifiedCount = lines.filter((l) => ["verified", "corrected", "auto_committed"].includes(l.verification_status)).length;
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
          <NwEyebrow tone="accent">Extraction Verification · Cost Intelligence</NwEyebrow>
          <h2
            className="mt-2 text-[22px] tracking-[-0.02em] text-[var(--text-primary)]"
            style={{ fontFamily: "var(--font-space-grotesk)" }}
          >
            AI-extracted line items
          </h2>
          <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
            Each line must be verified before it enters the cost intelligence database.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/cost-intelligence/verification"
            className="inline-flex items-center h-[32px] px-3 border border-[var(--border-default)] text-[11px] uppercase tracking-[0.12em] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)]"
            style={{ fontFamily: "var(--font-jetbrains-mono)" }}
          >
            Open verification queue →
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
                  className="absolute inset-y-0 left-0 bg-nw-stone-blue"
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
          {ocrOpen && extraction ? (
            <RawOcrViewer extraction={extraction} />
          ) : null}

          {/* Invoice totals (pre-tax + tax + overhead + total) */}
          <InvoiceTotalsPanel extraction={extraction} lineCount={lines.length} />

          {/* Line list */}
          {lines.length === 0 ? (
            <p className="text-[13px] text-[var(--text-tertiary)]">No lines extracted.</p>
          ) : (
            <ul className="space-y-3">
              {lines.map((line) => (
                <LineRow
                  key={line.id}
                  line={line}
                  busy={busyLineId === line.id}
                  onApprove={() => approveLine(line.id)}
                  onReject={() => rejectLine(line.id)}
                />
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
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
}

function LineRow({ line, busy, onApprove, onReject }: LineRowProps) {
  const status = line.verification_status;
  const tier = line.match_tier;
  const confidence = line.match_confidence ?? 0;
  const isOverhead = line.is_allocated_overhead;

  // Allocated-overhead rows are informational only — they were moved to the
  // invoice-level overhead bucket and allocated proportionally. Show them
  // greyed out with no action buttons so users understand the mechanic
  // without being tempted to verify them individually.
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
              amount{" "}
              <NwMoney cents={line.raw_total_cents} size="sm" variant="emphasized" showCents />
            </span>
          </div>
        </div>
        <div>
          <NwEyebrow tone="muted">Allocated to line items</NwEyebrow>
          <p className="mt-2 text-[12px] italic text-[var(--text-tertiary)] leading-relaxed">
            This {line.overhead_type ?? "overhead"} charge has been redistributed
            proportionally to the real line items below by pre-tax total. No item is
            created for it.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 min-w-[160px]">
          <NwBadge variant="neutral" size="sm">
            {(line.overhead_type ?? "overhead").replace(/_/g, " ")}
          </NwBadge>
          <span
            className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]"
            style={{ fontFamily: "var(--font-jetbrains-mono)" }}
          >
            Allocated
          </span>
        </div>
      </li>
    );
  }

  const statusBadge = (() => {
    if (status === "verified" || status === "corrected" || status === "auto_committed")
      return <NwBadge variant="success">{status}</NwBadge>;
    if (status === "rejected") return <NwBadge variant="danger">rejected</NwBadge>;
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
    const label = tier.replace(/_/g, " ");
    return (
      <NwBadge variant={variant} size="sm">
        {label}
      </NwBadge>
    );
  })();

  const proposedName =
    line.verified_item?.canonical_name ??
    line.proposed_item?.canonical_name ??
    line.proposed_item_data?.canonical_name ??
    "(unclassified)";

  const actionable = status === "pending";
  const overheadShare = line.overhead_allocated_cents ?? 0;
  const lineTax = line.line_tax_cents ?? 0;
  const landed = line.landed_total_cents ?? ((line.raw_total_cents ?? 0) + overheadShare + lineTax);
  const showLanded = overheadShare > 0 || lineTax > 0;

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
                style={{ fontFamily: "var(--font-jetbrains-mono)", fontVariantNumeric: "tabular-nums" }}
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
            total{" "}
            <NwMoney
              cents={line.raw_total_cents}
              size="sm"
              variant="emphasized"
              showCents
            />
          </span>
        </div>
        {showLanded ? (
          <div
            className="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-[var(--text-tertiary)]"
            style={{ fontFamily: "var(--font-jetbrains-mono)" }}
          >
            {overheadShare > 0 ? (
              <span>
                + <NwMoney cents={overheadShare} size="sm" showCents /> overhead
              </span>
            ) : null}
            {lineTax > 0 ? (
              <span>
                + <NwMoney cents={lineTax} size="sm" showCents /> tax
              </span>
            ) : null}
            <span>
              landed{" "}
              <span className="text-[var(--text-secondary)]">
                <NwMoney cents={landed} size="sm" showCents />
              </span>
            </span>
          </div>
        ) : null}
      </div>

      {/* MIDDLE — AI proposal */}
      <div>
        <NwEyebrow tone="accent">AI proposal</NwEyebrow>
        <p className="mt-2 text-[13px] text-[var(--text-primary)] font-medium">{proposedName}</p>
        {line.proposed_item_data ? (
          <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">
            {line.proposed_item_data.item_type}
            {line.proposed_item_data.category ? ` · ${line.proposed_item_data.category}` : ""}
            {line.proposed_item_data.subcategory ? ` · ${line.proposed_item_data.subcategory}` : ""}
          </p>
        ) : null}
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          {tierBadge}
          <span
            className="text-[11px] text-[var(--text-secondary)]"
            style={{ fontFamily: "var(--font-jetbrains-mono)", fontVariantNumeric: "tabular-nums" }}
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

      {/* RIGHT — actions + status */}
      <div className="flex flex-col items-end gap-2 min-w-[160px]">
        {statusBadge}
        <div className="flex flex-col gap-2 w-full">
          <NwButton
            variant="primary"
            size="sm"
            disabled={!actionable || busy}
            loading={busy && actionable}
            onClick={onApprove}
          >
            Approve
          </NwButton>
          <Link
            href="/cost-intelligence/verification"
            className={`inline-flex items-center justify-center h-[30px] px-3 border text-[11px] uppercase tracking-[0.12em] ${
              !actionable
                ? "border-[var(--border-default)] text-[var(--text-tertiary)] pointer-events-none opacity-60"
                : "border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)]"
            }`}
            style={{ fontFamily: "var(--font-jetbrains-mono)" }}
            title="Edit classification in the full verification queue"
          >
            Edit in queue →
          </Link>
          <NwButton
            variant="danger"
            size="sm"
            disabled={!actionable || busy}
            onClick={onReject}
          >
            Reject
          </NwButton>
        </div>
      </div>
    </li>
  );
}

function InvoiceTotalsPanel({
  extraction,
  lineCount,
}: {
  extraction: InvoiceExtractionRow;
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

  // Nothing to show if extraction has no totals captured yet
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
              {taxRate != null ? `${(taxRate * 100).toFixed(2)}% rate` : "rate unknown"} · prorated to taxable lines
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
              {reconcileOk ? " · reconciled" : ` · mismatch ${diff && diff > 0 ? "+" : ""}${((diff ?? 0) / 100).toFixed(2)}`}
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
