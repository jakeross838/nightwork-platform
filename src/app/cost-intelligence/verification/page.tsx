"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/app-shell";
import NwEyebrow from "@/components/nw/Eyebrow";
import NwBadge from "@/components/nw/Badge";
import NwButton from "@/components/nw/Button";
import NwMoney from "@/components/nw/Money";
import { supabase } from "@/lib/supabase/client";
import { toast } from "@/lib/utils/toast";
import NonItemModal from "@/components/items/non-item-modal";
import type { TransactionLineType } from "@/lib/cost-intelligence/types";

type QueueLine = {
  id: string;
  line_order: number;
  raw_description: string;
  raw_quantity: number | null;
  raw_total_cents: number | null;
  raw_unit_text: string | null;
  match_tier: string | null;
  match_confidence: number | null;
  match_confidence_score: number | null;
  classification_confidence: number | null;
  match_reasoning: string | null;
  verification_status: string;
  is_transaction_line: boolean;
  transaction_line_type: TransactionLineType | null;
  created_at: string;
  extraction_id: string;
  proposed_item: { id: string; canonical_name: string } | null;
  proposed_item_data: { item_type?: string } | null;
  invoice_extractions: {
    id: string;
    invoice_id: string;
    verification_status: string;
    invoices: {
      id: string;
      invoice_number: string | null;
      vendor_name_raw: string | null;
      vendor_id: string | null;
      job_id: string | null;
      vendors: { name: string } | null;
      jobs: { name: string } | null;
    } | null;
  } | null;
};

const BULK_APPROVE_THRESHOLD = 0.95;

type ShowOnlyFilter =
  | "all"
  | "needs_classification"
  | "low_confidence"
  | "transaction_lines";

export default function VerificationQueuePage() {
  const [lines, setLines] = useState<QueueLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [vendorFilter, setVendorFilter] = useState<string>("");
  const [jobFilter, setJobFilter] = useState<string>("");
  const [tierFilter, setTierFilter] = useState<string>("");
  const [confidenceFilter, setConfidenceFilter] = useState<string>("");
  const [hideTransactions, setHideTransactions] = useState<boolean>(true);
  const [showOnly, setShowOnly] = useState<ShowOnlyFilter>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [thresholdBusy, setThresholdBusy] = useState(false);
  const [nonItemTarget, setNonItemTarget] = useState<QueueLine | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("invoice_extraction_lines")
      .select(
        "id, line_order, raw_description, raw_quantity, raw_total_cents, raw_unit_text, match_tier, match_confidence, match_confidence_score, classification_confidence, match_reasoning, verification_status, is_transaction_line, transaction_line_type, created_at, extraction_id, proposed_item_data, proposed_item:items!proposed_item_id(id, canonical_name), invoice_extractions!inner(id, invoice_id, verification_status, invoices!inner(id, invoice_number, vendor_name_raw, vendor_id, job_id, vendors(name), jobs(name)))"
      )
      .eq("verification_status", "pending")
      .eq("is_allocated_overhead", false)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(500);

    setLines((data ?? []) as unknown as QueueLine[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const vendors = useMemo(() => {
    const m = new Map<string, string>();
    for (const l of lines) {
      const v = l.invoice_extractions?.invoices;
      if (v?.vendor_id && v.vendors?.name) m.set(v.vendor_id, v.vendors.name);
    }
    return Array.from(m.entries()).sort(([, a], [, b]) => a.localeCompare(b));
  }, [lines]);

  const jobs = useMemo(() => {
    const m = new Map<string, string>();
    for (const l of lines) {
      const j = l.invoice_extractions?.invoices;
      if (j?.job_id && j.jobs?.name) m.set(j.job_id, j.jobs.name);
    }
    return Array.from(m.entries()).sort(([, a], [, b]) => a.localeCompare(b));
  }, [lines]);

  const filtered = useMemo(() => {
    return lines.filter((l) => {
      const inv = l.invoice_extractions?.invoices;
      if (vendorFilter && inv?.vendor_id !== vendorFilter) return false;
      if (jobFilter && inv?.job_id !== jobFilter) return false;
      if (tierFilter && l.match_tier !== tierFilter) return false;
      if (hideTransactions && l.is_transaction_line) return false;

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
  }, [lines, vendorFilter, jobFilter, tierFilter, confidenceFilter, hideTransactions, showOnly]);

  const avgConfidence = useMemo(() => {
    const eligible = filtered.filter((l) => !l.is_transaction_line && l.match_tier !== "ai_new_item");
    if (eligible.length === 0) return 0;
    return (
      eligible.reduce((s, l) => s + (l.match_confidence_score ?? l.match_confidence ?? 0), 0) /
      eligible.length
    );
  }, [filtered]);

  const highConfidenceSelectable = useMemo(
    () =>
      filtered
        .filter(
          (l) =>
            !l.is_transaction_line &&
            (l.match_confidence_score ?? l.match_confidence ?? 0) >= 0.85 &&
            l.match_tier !== "ai_new_item"
        )
        .map((l) => l.id),
    [filtered]
  );

  const thresholdEligible = useMemo(() => {
    const eligibleTiers = new Set(["alias_match", "trigram_match", "ai_semantic_match"]);
    return filtered.filter(
      (l) =>
        !l.is_transaction_line &&
        l.match_tier != null &&
        eligibleTiers.has(l.match_tier) &&
        (l.match_confidence_score ?? l.match_confidence ?? 0) >= BULK_APPROVE_THRESHOLD
    );
  }, [filtered]);

  const transactionCount = useMemo(
    () => lines.filter((l) => l.is_transaction_line).length,
    [lines]
  );

  const toggleSelect = useCallback((lineId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(lineId)) next.delete(lineId);
      else next.add(lineId);
      return next;
    });
  }, []);

  const selectAllHighConfidence = useCallback(() => {
    setSelected(new Set(highConfidenceSelectable));
  }, [highConfidenceSelectable]);

  const clearSelection = useCallback(() => setSelected(new Set()), []);

  const bulkApprove = useCallback(async () => {
    if (selected.size === 0) return;
    if (!confirm(`Approve ${selected.size} lines and commit to the spine?`)) return;
    setBulkBusy(true);
    const ids = Array.from(selected);
    let ok = 0;
    let fail = 0;
    for (const id of ids) {
      try {
        const res = await fetch(`/api/cost-intelligence/lines/${id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "approve" }),
        });
        if (res.ok) ok++;
        else fail++;
      } catch {
        fail++;
      }
    }
    setBulkBusy(false);
    toast.success(`Bulk approve: ${ok} committed${fail ? `, ${fail} failed` : ""}`);
    setSelected(new Set());
    await fetchData();
  }, [selected, fetchData]);

  const approveAboveThreshold = useCallback(async () => {
    const eligibleCount = thresholdEligible.length;
    if (eligibleCount === 0) {
      toast.info("No lines meet the auto-approve threshold (≥95% confidence, alias/trigram/ai_semantic)");
      return;
    }
    const confirmed = confirm(
      `Approve all ${eligibleCount} line${eligibleCount === 1 ? "" : "s"} at ≥${Math.round(
        BULK_APPROVE_THRESHOLD * 100
      )}% confidence (alias / trigram / ai_semantic)?\n\nai_new_item lines always require manual review.`
    );
    if (!confirmed) return;
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

  const markNonItemSuccess = useCallback(async () => {
    setNonItemTarget(null);
    await fetchData();
  }, [fetchData]);

  return (
    <AppShell>
      <main className="max-w-[1400px] mx-auto px-6 py-8">
        <Link
          href="/cost-intelligence"
          className="text-[11px] text-[var(--text-tertiary)] hover:text-nw-gulf-blue uppercase tracking-[0.12em]"
          style={{ fontFamily: "var(--font-jetbrains-mono)" }}
        >
          ← Cost Intelligence
        </Link>

        <div className="mt-4 flex items-start justify-between gap-4 mb-6">
          <div>
            <NwEyebrow tone="accent">Cost Intelligence · Queue</NwEyebrow>
            <h1
              className="mt-2 text-[28px] tracking-[-0.02em] text-[var(--text-primary)]"
              style={{ fontFamily: "var(--font-space-grotesk)" }}
            >
              Verification Queue
            </h1>
            <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
              Review AI-extracted line items before they enter the cost intelligence database.
            </p>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Kpi label="Pending lines" value={filtered.length.toLocaleString("en-US")} />
          <Kpi
            label="Transaction lines"
            value={transactionCount.toLocaleString("en-US")}
            subtext={transactionCount > 0 ? (hideTransactions ? "hidden" : "showing") : undefined}
          />
          <Kpi
            label="Avg match confidence"
            value={`${Math.round(avgConfidence * 100)}%`}
            subtext="matches only"
          />
          <Kpi label="Selected" value={selected.size.toLocaleString("en-US")} />
        </div>

        {/* Filters row 1 */}
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <select
            value={vendorFilter}
            onChange={(e) => setVendorFilter(e.target.value)}
            className="px-3 h-[36px] border border-[var(--border-default)] bg-[var(--bg-card)] text-[13px] text-[var(--text-primary)]"
          >
            <option value="">All vendors</option>
            {vendors.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
          <select
            value={jobFilter}
            onChange={(e) => setJobFilter(e.target.value)}
            className="px-3 h-[36px] border border-[var(--border-default)] bg-[var(--bg-card)] text-[13px] text-[var(--text-primary)]"
          >
            <option value="">All jobs</option>
            {jobs.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value)}
            className="px-3 h-[36px] border border-[var(--border-default)] bg-[var(--bg-card)] text-[13px] text-[var(--text-primary)]"
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
            className="px-3 h-[36px] border border-[var(--border-default)] bg-[var(--bg-card)] text-[13px] text-[var(--text-primary)]"
          >
            <option value="">Any confidence</option>
            <option value="high">High (≥85%)</option>
            <option value="medium">Medium (70-85%)</option>
            <option value="low">Low (&lt;70%)</option>
          </select>
          <select
            value={showOnly}
            onChange={(e) => setShowOnly(e.target.value as ShowOnlyFilter)}
            className="px-3 h-[36px] border border-[var(--border-default)] bg-[var(--bg-card)] text-[13px] text-[var(--text-primary)]"
          >
            <option value="all">Show all pending</option>
            <option value="needs_classification">Needs classification (new items)</option>
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

        {/* Bulk actions row */}
        <div className="mb-4 flex items-center gap-2 justify-end">
          <NwButton
            variant="primary"
            size="sm"
            onClick={approveAboveThreshold}
            loading={thresholdBusy}
            disabled={thresholdEligible.length === 0 || thresholdBusy || bulkBusy}
            title="Approve every alias / trigram / ai_semantic line at ≥95% confidence"
          >
            Approve ≥95% ({thresholdEligible.length})
          </NwButton>
          <NwButton
            variant="secondary"
            size="sm"
            onClick={selectAllHighConfidence}
            disabled={highConfidenceSelectable.length === 0 || bulkBusy}
          >
            Select high-confidence
          </NwButton>
          <NwButton variant="ghost" size="sm" onClick={clearSelection} disabled={selected.size === 0}>
            Clear
          </NwButton>
          <NwButton
            variant="primary"
            size="sm"
            onClick={bulkApprove}
            loading={bulkBusy}
            disabled={selected.size === 0}
          >
            Approve {selected.size || ""}
          </NwButton>
        </div>

        {/* Table */}
        <div className="border border-[var(--border-default)] bg-[var(--bg-card)]">
          <table className="w-full text-[12px]">
            <thead
              className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]"
              style={{ fontFamily: "var(--font-jetbrains-mono)" }}
            >
              <tr className="border-b border-[var(--border-default)]">
                <th className="text-left px-3 py-2 font-medium w-[30px]"></th>
                <th className="text-left px-3 py-2 font-medium">Created</th>
                <th className="text-left px-3 py-2 font-medium">Invoice</th>
                <th className="text-left px-3 py-2 font-medium">Vendor</th>
                <th className="text-left px-3 py-2 font-medium">Raw line</th>
                <th className="text-left px-3 py-2 font-medium">Proposed</th>
                <th className="text-left px-3 py-2 font-medium">Status / Tier</th>
                <th className="text-right px-3 py-2 font-medium">Total</th>
                <th className="text-right px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-6 text-center text-[var(--text-tertiary)]">
                    Loading…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-6 text-center text-[var(--text-tertiary)]">
                    Queue is clear for current filters. {transactionCount > 0 && hideTransactions ? (
                      <>
                        {transactionCount} transaction line{transactionCount === 1 ? "" : "s"} hidden —{" "}
                        <button
                          type="button"
                          onClick={() => setHideTransactions(false)}
                          className="underline text-nw-gulf-blue"
                        >
                          show them
                        </button>
                        .
                      </>
                    ) : null}
                  </td>
                </tr>
              ) : (
                filtered.map((l) => (
                  <QueueRow
                    key={l.id}
                    line={l}
                    selected={selected.has(l.id)}
                    onToggleSelect={() => toggleSelect(l.id)}
                    onMarkNonItem={() => setNonItemTarget(l)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>

      {nonItemTarget && (
        <NonItemModal
          line={{
            id: nonItemTarget.id,
            raw_description: nonItemTarget.raw_description,
            detected_type: nonItemTarget.transaction_line_type,
          }}
          onCancel={() => setNonItemTarget(null)}
          onSuccess={markNonItemSuccess}
        />
      )}
    </AppShell>
  );
}

function QueueRow({
  line,
  selected,
  onToggleSelect,
  onMarkNonItem,
}: {
  line: QueueLine;
  selected: boolean;
  onToggleSelect: () => void;
  onMarkNonItem: () => void;
}) {
  const inv = line.invoice_extractions?.invoices;
  const matchConf = line.match_confidence_score ?? line.match_confidence ?? 0;
  const classConf = line.classification_confidence;

  return (
    <tr
      className={`border-b border-[var(--border-default)] last:border-b-0 hover:bg-[var(--bg-subtle)] ${
        line.is_transaction_line ? "bg-[var(--bg-subtle)]/50" : ""
      }`}
    >
      <td className="px-3 py-2">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          disabled={line.is_transaction_line}
          className="h-[16px] w-[16px]"
          title={line.is_transaction_line ? "Transaction lines — mark as non-item instead" : undefined}
        />
      </td>
      <td
        className="px-3 py-2 text-[var(--text-tertiary)]"
        style={{ fontFamily: "var(--font-jetbrains-mono)" }}
      >
        {new Date(line.created_at).toLocaleDateString()}
      </td>
      <td className="px-3 py-2">
        {inv ? (
          <Link href={`/invoices/${inv.id}`} className="text-nw-gulf-blue hover:underline">
            {inv.invoice_number ?? "(no #)"}
          </Link>
        ) : (
          "—"
        )}
      </td>
      <td className="px-3 py-2 text-[var(--text-secondary)]">
        {inv?.vendors?.name ?? inv?.vendor_name_raw ?? "—"}
      </td>
      <td
        className="px-3 py-2 text-[var(--text-primary)] max-w-[260px] truncate"
        style={{ fontFamily: "var(--font-jetbrains-mono)" }}
        title={line.raw_description}
      >
        {line.raw_description}
      </td>
      <td className="px-3 py-2 text-[var(--text-secondary)]">
        {line.is_transaction_line
          ? "—"
          : line.proposed_item?.canonical_name ?? "(new item)"}
      </td>
      <td className="px-3 py-2">
        <StatusTierBadge
          line={line}
          matchConfidence={matchConf}
          classConfidence={classConf}
        />
      </td>
      <td className="px-3 py-2 text-right">
        <NwMoney cents={line.raw_total_cents} size="sm" />
      </td>
      <td className="px-3 py-2 text-right">
        <div className="inline-flex items-center gap-1">
          {line.is_transaction_line ? (
            <NwButton variant="primary" size="sm" onClick={onMarkNonItem}>
              Not an item
            </NwButton>
          ) : (
            <>
              <Link
                href={`/invoices/${inv?.id}`}
                className="inline-flex items-center h-[24px] px-2 border border-[var(--border-default)] text-[10px] uppercase tracking-[0.12em] text-[var(--text-secondary)] hover:text-nw-gulf-blue hover:border-nw-gulf-blue"
                style={{ fontFamily: "var(--font-jetbrains-mono)" }}
              >
                Review
              </Link>
              <button
                type="button"
                onClick={onMarkNonItem}
                className="inline-flex items-center h-[24px] px-2 border border-[var(--border-default)] text-[10px] uppercase tracking-[0.12em] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)]"
                style={{ fontFamily: "var(--font-jetbrains-mono)" }}
                title="Mark as non-item (billing event, draw, rental, service charge)"
              >
                Not an item
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

function StatusTierBadge({
  line,
  matchConfidence,
  classConfidence,
}: {
  line: QueueLine;
  matchConfidence: number;
  classConfidence: number | null;
}) {
  // Transaction lines always win the label race.
  if (line.is_transaction_line) {
    const type = line.transaction_line_type ?? "other";
    return (
      <span className="inline-flex items-center gap-1.5">
        <NwBadge variant="neutral" size="sm">
          TRANSACTION · {type.replace(/_/g, " ").toUpperCase()}
        </NwBadge>
      </span>
    );
  }

  const itemType = line.proposed_item_data?.item_type ?? null;

  if (line.match_tier === "ai_new_item") {
    return (
      <span
        className="inline-flex items-center gap-1.5"
        title={
          classConfidence != null
            ? `Classification confidence: ${Math.round(classConfidence * 100)}%`
            : "AI proposes a new item"
        }
      >
        <NwBadge variant="accent" size="sm">
          NEW{itemType ? ` · ${itemType.toUpperCase()}` : ""}
        </NwBadge>
      </span>
    );
  }

  if (line.match_tier === "alias_match") {
    return <NwBadge variant="success" size="sm">KNOWN</NwBadge>;
  }

  if (line.match_tier === "trigram_match") {
    return (
      <NwBadge variant="success" size="sm">
        SIMILAR · {Math.round(matchConfidence * 100)}%
      </NwBadge>
    );
  }

  if (line.match_tier === "ai_semantic_match") {
    const variant =
      matchConfidence >= 0.85 ? "success" : matchConfidence >= 0.7 ? "accent" : "warning";
    return (
      <NwBadge variant={variant} size="sm">
        MATCH · {Math.round(matchConfidence * 100)}%
      </NwBadge>
    );
  }

  return <NwBadge variant="neutral" size="sm">{line.match_tier ?? "—"}</NwBadge>;
}

function Kpi({ label, value, subtext }: { label: string; value: string; subtext?: string }) {
  return (
    <div className="border border-[var(--border-default)] bg-[var(--bg-card)] p-4">
      <div
        className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]"
        style={{ fontFamily: "var(--font-jetbrains-mono)" }}
      >
        {label}
      </div>
      <div
        className="mt-2 text-[22px] text-[var(--text-primary)]"
        style={{ fontFamily: "var(--font-space-grotesk)", letterSpacing: "-0.02em" }}
      >
        {value}
      </div>
      {subtext && (
        <div className="mt-1 text-[11px] text-[var(--text-tertiary)]">{subtext}</div>
      )}
    </div>
  );
}
