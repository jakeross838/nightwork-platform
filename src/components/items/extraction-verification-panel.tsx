"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import NwEyebrow from "@/components/nw/Eyebrow";
import NwBadge from "@/components/nw/Badge";
import NwButton from "@/components/nw/Button";
import NwMoney from "@/components/nw/Money";
import { toast } from "@/lib/utils/toast";
import LineCorrectionModal from "@/components/items/line-correction-modal";
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
  const [correctionLine, setCorrectionLine] = useState<ExtractionLineView | null>(null);
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

  const onCorrectionSaved = useCallback(async () => {
    setCorrectionLine(null);
    await load();
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
                  onEdit={() => setCorrectionLine(line)}
                  onReject={() => rejectLine(line.id)}
                />
              ))}
            </ul>
          )}

          {correctionLine ? (
            <LineCorrectionModal
              line={correctionLine}
              onClose={() => setCorrectionLine(null)}
              onSaved={onCorrectionSaved}
            />
          ) : null}
        </>
      )}
    </section>
  );
}

interface LineRowProps {
  line: ExtractionLineView;
  busy: boolean;
  onApprove: () => void;
  onEdit: () => void;
  onReject: () => void;
}

function LineRow({ line, busy, onApprove, onEdit, onReject }: LineRowProps) {
  const status = line.verification_status;
  const tier = line.match_tier;
  const confidence = line.match_confidence ?? 0;

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
          <NwButton
            variant="secondary"
            size="sm"
            disabled={!actionable || busy}
            onClick={onEdit}
          >
            Edit
          </NwButton>
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
