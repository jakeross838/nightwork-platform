"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/app-shell";
import NwEyebrow from "@/components/nw/Eyebrow";
import NwButton from "@/components/nw/Button";
import { supabase } from "@/lib/supabase/client";
import { toast } from "@/lib/utils/toast";
import VerificationRow, {
  type QueueLine,
} from "@/components/cost-intelligence/verification-row";

const BULK_APPROVE_THRESHOLD = 0.95;

type ShowOnlyFilter =
  | "all"
  | "needs_classification"
  | "low_confidence"
  | "transaction_lines";

type QueryRow = {
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
  transaction_line_type: QueueLine["transaction_line_type"];
  line_tax_cents: number | null;
  overhead_allocated_cents: number | null;
  proposed_item_data: QueueLine["proposed_item_data"];
  proposed_item: { id: string; canonical_name: string } | null;
  invoice_extractions: {
    id: string;
    raw_ocr_text: string | null;
    invoices: {
      id: string;
      invoice_number: string | null;
      invoice_date: string | null;
      vendor_id: string | null;
      vendors: { name: string } | null;
    } | null;
  } | null;
};

export default function VerificationQueuePage() {
  const [lines, setLines] = useState<QueueLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [vendorFilter, setVendorFilter] = useState<string>("");
  const [tierFilter, setTierFilter] = useState<string>("");
  const [confidenceFilter, setConfidenceFilter] = useState<string>("");
  const [hideTransactions, setHideTransactions] = useState<boolean>(true);
  const [showOnly, setShowOnly] = useState<ShowOnlyFilter>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [thresholdBusy, setThresholdBusy] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("invoice_extraction_lines")
      .select(
        "id, raw_description, raw_quantity, raw_unit_text, raw_unit_price_cents, raw_total_cents, match_tier, match_confidence, match_confidence_score, classification_confidence, match_reasoning, created_at, is_transaction_line, transaction_line_type, line_tax_cents, overhead_allocated_cents, proposed_item_data, proposed_item:items!proposed_item_id(id, canonical_name), invoice_extractions!inner(id, raw_ocr_text, invoices!inner(id, invoice_number, invoice_date, vendor_id, vendors(name)))"
      )
      .eq("verification_status", "pending")
      .eq("is_allocated_overhead", false)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(500);

    const mapped: QueueLine[] = ((data ?? []) as unknown as QueryRow[]).map((r) => ({
      id: r.id,
      raw_description: r.raw_description,
      raw_quantity: r.raw_quantity,
      raw_unit_text: r.raw_unit_text,
      raw_unit_price_cents: r.raw_unit_price_cents,
      raw_total_cents: r.raw_total_cents,
      match_tier: r.match_tier,
      match_confidence: r.match_confidence,
      match_confidence_score: r.match_confidence_score,
      classification_confidence: r.classification_confidence,
      match_reasoning: r.match_reasoning,
      created_at: r.created_at,
      is_transaction_line: r.is_transaction_line,
      transaction_line_type: r.transaction_line_type,
      proposed_item: r.proposed_item,
      proposed_item_data: r.proposed_item_data,
      line_tax_cents: r.line_tax_cents,
      overhead_allocated_cents: r.overhead_allocated_cents,
      raw_ocr_text: r.invoice_extractions?.raw_ocr_text ?? null,
      invoice: r.invoice_extractions?.invoices
        ? {
            id: r.invoice_extractions.invoices.id,
            invoice_number: r.invoice_extractions.invoices.invoice_number,
            invoice_date: r.invoice_extractions.invoices.invoice_date,
            vendor_name: r.invoice_extractions.invoices.vendors?.name ?? null,
          }
        : null,
    }));

    setLines(mapped);
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const vendors = useMemo(() => {
    const m = new Map<string, string>();
    for (const l of lines) {
      if (l.invoice?.vendor_name) {
        m.set(l.invoice.vendor_name, l.invoice.vendor_name);
      }
    }
    return Array.from(m.values()).sort();
  }, [lines]);

  const filtered = useMemo(() => {
    return lines.filter((l) => {
      if (vendorFilter && l.invoice?.vendor_name !== vendorFilter) return false;
      if (tierFilter && l.match_tier !== tierFilter) return false;
      if (hideTransactions && l.is_transaction_line && showOnly !== "transaction_lines")
        return false;

      const matchConf = l.match_confidence_score ?? l.match_confidence ?? 0;
      if (confidenceFilter === "high" && matchConf < 0.85) return false;
      if (confidenceFilter === "medium" && (matchConf < 0.7 || matchConf >= 0.85)) return false;
      if (confidenceFilter === "low" && matchConf >= 0.7) return false;

      if (showOnly === "needs_classification") {
        if (!(l.match_tier === "ai_new_item" && !l.is_transaction_line)) return false;
      } else if (showOnly === "low_confidence") {
        if (!(l.match_tier === "ai_semantic_match" && matchConf < 0.75)) return false;
      } else if (showOnly === "transaction_lines") {
        if (!l.is_transaction_line) return false;
      }
      return true;
    });
  }, [lines, vendorFilter, tierFilter, confidenceFilter, hideTransactions, showOnly]);

  const transactionCount = useMemo(
    () => lines.filter((l) => l.is_transaction_line).length,
    [lines]
  );

  const avgMatchConfidence = useMemo(() => {
    const eligible = filtered.filter(
      (l) => !l.is_transaction_line && l.match_tier !== "ai_new_item"
    );
    if (eligible.length === 0) return 0;
    return (
      eligible.reduce((s, l) => s + (l.match_confidence_score ?? l.match_confidence ?? 0), 0) /
      eligible.length
    );
  }, [filtered]);

  const thresholdEligible = useMemo(() => {
    const tiers = new Set(["alias_match", "trigram_match", "ai_semantic_match"]);
    return filtered.filter(
      (l) =>
        !l.is_transaction_line &&
        l.match_tier != null &&
        tiers.has(l.match_tier) &&
        (l.match_confidence_score ?? l.match_confidence ?? 0) >= BULK_APPROVE_THRESHOLD
    );
  }, [filtered]);

  const handleRowDone = useCallback((id: string) => {
    setLines((prev) => prev.filter((l) => l.id !== id));
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setExpandedId((id2) => (id2 === id ? null : id2));
  }, []);

  const handleExpand = useCallback((id: string) => {
    setExpandedId(id);
  }, []);

  const handleCollapse = useCallback(() => {
    setExpandedId(null);
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const bulkApproveSelected = useCallback(async () => {
    if (selected.size === 0) return;
    if (!confirm(`Approve ${selected.size} selected lines?`)) return;
    setBulkBusy(true);
    let ok = 0;
    let fail = 0;
    for (const id of Array.from(selected)) {
      try {
        const res = await fetch(`/api/cost-intelligence/lines/${id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "approve" }),
        });
        if (res.ok) {
          ok++;
          setLines((prev) => prev.filter((l) => l.id !== id));
        } else fail++;
      } catch {
        fail++;
      }
    }
    setBulkBusy(false);
    toast.success(`Bulk approve: ${ok} committed${fail ? `, ${fail} failed` : ""}`);
    setSelected(new Set());
  }, [selected]);

  const approveAboveThreshold = useCallback(async () => {
    if (thresholdEligible.length === 0) {
      toast.info("No lines meet the ≥95% threshold");
      return;
    }
    if (
      !confirm(
        `Approve all ${thresholdEligible.length} alias / trigram / ai_semantic lines ≥${Math.round(
          BULK_APPROVE_THRESHOLD * 100
        )}% confidence?`
      )
    )
      return;
    setThresholdBusy(true);
    try {
      const res = await fetch(`/api/cost-intelligence/lines/bulk-approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confidence_threshold: BULK_APPROVE_THRESHOLD }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `Status ${res.status}`);
      toast.success(
        `Approved ${json.count_approved}/${json.count_eligible} lines${
          json.count_failed ? ` · ${json.count_failed} failed` : ""
        }`
      );
      await fetchData();
    } catch (err) {
      toast.error(`Bulk approve failed: ${err instanceof Error ? err.message : err}`);
    } finally {
      setThresholdBusy(false);
    }
  }, [thresholdEligible.length, fetchData]);

  return (
    <AppShell>
      <main className="max-w-[1600px] mx-auto px-6 py-8">
        <Link
          href="/cost-intelligence"
          className="text-[11px] text-[var(--text-tertiary)] hover:text-nw-gulf-blue uppercase tracking-[0.12em]"
          style={{ fontFamily: "var(--font-jetbrains-mono)" }}
        >
          ← Cost Intelligence
        </Link>

        <div className="mt-4 flex items-start justify-between gap-4 mb-4">
          <div>
            <NwEyebrow tone="accent">Cost Intelligence · Verification Queue</NwEyebrow>
            <h1
              className="mt-2 text-[28px] tracking-[-0.02em] text-[var(--text-primary)]"
              style={{ fontFamily: "var(--font-space-grotesk)" }}
            >
              Verify extracted line items
            </h1>
            <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
              Review AI-extracted items before they enter the cost intelligence database.
            </p>
          </div>
        </div>

        {/* Inline KPI + bulk action strip */}
        <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px] text-[var(--text-secondary)]">
          <span>
            Pending:{" "}
            <span
              className="text-[var(--text-primary)]"
              style={{ fontFamily: "var(--font-jetbrains-mono)", fontVariantNumeric: "tabular-nums" }}
            >
              {filtered.length.toLocaleString("en-US")}
            </span>
          </span>
          <span>
            Transactions {hideTransactions ? "hidden" : "shown"}:{" "}
            <span
              className="text-[var(--text-primary)]"
              style={{ fontFamily: "var(--font-jetbrains-mono)", fontVariantNumeric: "tabular-nums" }}
            >
              {transactionCount.toLocaleString("en-US")}
            </span>
          </span>
          <span>
            Avg match:{" "}
            <span
              className="text-[var(--text-primary)]"
              style={{ fontFamily: "var(--font-jetbrains-mono)", fontVariantNumeric: "tabular-nums" }}
            >
              {Math.round(avgMatchConfidence * 100)}%
            </span>{" "}
            <span className="text-[var(--text-tertiary)]">(matches only)</span>
          </span>
          <span className="ml-auto flex items-center gap-2">
            {selected.size > 0 && (
              <NwButton variant="secondary" size="sm" onClick={bulkApproveSelected} loading={bulkBusy}>
                Approve {selected.size} selected
              </NwButton>
            )}
            <NwButton
              variant="primary"
              size="sm"
              onClick={approveAboveThreshold}
              loading={thresholdBusy}
              disabled={thresholdEligible.length === 0 || thresholdBusy || bulkBusy}
              title="Bulk approve every alias / trigram / ai_semantic line at ≥95% confidence"
            >
              Approve ≥95% ({thresholdEligible.length})
            </NwButton>
          </span>
        </div>

        {/* Filters */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <select
            value={vendorFilter}
            onChange={(e) => setVendorFilter(e.target.value)}
            className="px-3 h-[32px] border border-[var(--border-default)] bg-[var(--bg-card)] text-[12px] text-[var(--text-primary)]"
          >
            <option value="">All vendors</option>
            {vendors.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value)}
            className="px-3 h-[32px] border border-[var(--border-default)] bg-[var(--bg-card)] text-[12px] text-[var(--text-primary)]"
          >
            <option value="">All match tiers</option>
            <option value="alias_match">Alias</option>
            <option value="trigram_match">Trigram</option>
            <option value="ai_semantic_match">AI semantic</option>
            <option value="ai_new_item">AI new item</option>
          </select>
          <select
            value={confidenceFilter}
            onChange={(e) => setConfidenceFilter(e.target.value)}
            className="px-3 h-[32px] border border-[var(--border-default)] bg-[var(--bg-card)] text-[12px] text-[var(--text-primary)]"
          >
            <option value="">Any confidence</option>
            <option value="high">High (≥85%)</option>
            <option value="medium">Medium (70-85%)</option>
            <option value="low">Low (&lt;70%)</option>
          </select>
          <select
            value={showOnly}
            onChange={(e) => setShowOnly(e.target.value as ShowOnlyFilter)}
            className="px-3 h-[32px] border border-[var(--border-default)] bg-[var(--bg-card)] text-[12px] text-[var(--text-primary)]"
          >
            <option value="all">All pending</option>
            <option value="needs_classification">Needs classification</option>
            <option value="low_confidence">Low confidence matches</option>
            <option value="transaction_lines">Transaction lines only</option>
          </select>
          <label className="flex items-center gap-2 text-[12px] text-[var(--text-secondary)]">
            <input
              type="checkbox"
              checked={hideTransactions}
              onChange={(e) => setHideTransactions(e.target.checked)}
              disabled={showOnly === "transaction_lines"}
              className="h-[14px] w-[14px]"
            />
            Hide transaction lines
          </label>
        </div>

        {/* Queue */}
        <div className="border border-[var(--border-default)] bg-[var(--bg-card)]">
          <div
            className="flex items-center gap-3 px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)] border-b border-[var(--border-default)]"
            style={{ fontFamily: "var(--font-jetbrains-mono)" }}
          >
            <span className="w-[16px] shrink-0"></span>
            <span className="w-[80px] shrink-0">Created</span>
            <span className="w-[110px] shrink-0">Invoice</span>
            <span className="w-[180px] shrink-0">Vendor</span>
            <span className="flex-1 min-w-0">Raw line</span>
            <span className="w-[180px] shrink-0">Status</span>
            <span className="w-[100px] shrink-0 text-right">Total</span>
            <span className="w-[180px] shrink-0 text-right">Actions</span>
          </div>

          {loading ? (
            <div className="p-8 text-center text-[13px] text-[var(--text-tertiary)]">Loading…</div>
          ) : filtered.length === 0 ? (
            <EmptyState
              transactionCount={transactionCount}
              hideTransactions={hideTransactions}
              onShowTransactions={() => setHideTransactions(false)}
              totalPending={lines.length}
            />
          ) : (
            filtered.map((line) => (
              <VerificationRow
                key={line.id}
                line={line}
                expanded={expandedId === line.id}
                selected={selected.has(line.id)}
                onToggleSelect={() => toggleSelect(line.id)}
                onExpand={() => handleExpand(line.id)}
                onCollapse={handleCollapse}
                onRowDone={handleRowDone}
              />
            ))
          )}
        </div>
      </main>
    </AppShell>
  );
}

function EmptyState({
  transactionCount,
  hideTransactions,
  onShowTransactions,
  totalPending,
}: {
  transactionCount: number;
  hideTransactions: boolean;
  onShowTransactions: () => void;
  totalPending: number;
}) {
  const hasPendingButFiltered = totalPending > 0;

  if (hasPendingButFiltered) {
    return (
      <div className="p-10 text-center">
        <p className="text-[14px] text-[var(--text-primary)] font-medium">
          No lines match your filters.
        </p>
        {transactionCount > 0 && hideTransactions && (
          <p className="mt-2 text-[13px] text-[var(--text-secondary)]">
            {transactionCount} transaction line{transactionCount === 1 ? " is" : "s are"} hidden.{" "}
            <button
              type="button"
              onClick={onShowTransactions}
              className="underline text-nw-gulf-blue"
            >
              Show them
            </button>
            .
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="p-12 text-center">
      <div className="inline-flex items-center justify-center w-12 h-12 border border-[var(--border-default)] bg-[var(--bg-subtle)] mb-3">
        <svg
          width="22"
          height="22"
          viewBox="0 0 22 22"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-nw-success"
          aria-hidden="true"
        >
          <path d="M4 12l4 4 10-10" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <NwEyebrow tone="accent">All caught up</NwEyebrow>
      <p
        className="mt-1 text-[22px] tracking-[-0.02em] text-[var(--text-primary)]"
        style={{ fontFamily: "var(--font-space-grotesk)" }}
      >
        Verification queue is clear
      </p>
      <p className="mt-1 text-[13px] text-[var(--text-secondary)] max-w-[480px] mx-auto">
        Upload new invoices to continue building your cost intelligence database.
      </p>
      <Link
        href="/invoices"
        className="mt-4 inline-block h-[36px] px-4 border border-[var(--border-strong)] text-[11px] uppercase tracking-[0.12em] text-[var(--text-primary)] leading-[36px] hover:bg-[var(--bg-subtle)]"
        style={{ fontFamily: "var(--font-jetbrains-mono)" }}
      >
        Go to invoices →
      </Link>
    </div>
  );
}
