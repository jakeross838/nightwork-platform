"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/app-shell";
import FinancialViewTabs from "@/components/financial-view-tabs";
import NwEyebrow from "@/components/nw/Eyebrow";
import NwBadge from "@/components/nw/Badge";
import NwButton from "@/components/nw/Button";
import NwMoney from "@/components/nw/Money";
import { supabase } from "@/lib/supabase/client";
import { toast } from "@/lib/utils/toast";

type QueueLine = {
  id: string;
  line_order: number;
  raw_description: string;
  raw_quantity: number | null;
  raw_total_cents: number | null;
  raw_unit_text: string | null;
  match_tier: string | null;
  match_confidence: number | null;
  match_reasoning: string | null;
  verification_status: string;
  created_at: string;
  extraction_id: string;
  proposed_item: { id: string; canonical_name: string } | null;
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

export default function VerificationQueuePage() {
  const [lines, setLines] = useState<QueueLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [vendorFilter, setVendorFilter] = useState<string>("");
  const [jobFilter, setJobFilter] = useState<string>("");
  const [tierFilter, setTierFilter] = useState<string>("");
  const [confidenceFilter, setConfidenceFilter] = useState<string>("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [thresholdBusy, setThresholdBusy] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("invoice_extraction_lines")
      .select(
        "id, line_order, raw_description, raw_quantity, raw_total_cents, raw_unit_text, match_tier, match_confidence, match_reasoning, verification_status, created_at, extraction_id, proposed_item:items!proposed_item_id(id, canonical_name), invoice_extractions!inner(id, invoice_id, verification_status, invoices!inner(id, invoice_number, vendor_name_raw, vendor_id, job_id, vendors(name), jobs(name)))"
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
      const conf = l.match_confidence ?? 0;
      if (confidenceFilter === "high" && conf < 0.85) return false;
      if (confidenceFilter === "medium" && (conf < 0.7 || conf >= 0.85)) return false;
      if (confidenceFilter === "low" && conf >= 0.7) return false;
      return true;
    });
  }, [lines, vendorFilter, jobFilter, tierFilter, confidenceFilter]);

  const avgConfidence = useMemo(() => {
    if (filtered.length === 0) return 0;
    return filtered.reduce((s, l) => s + (l.match_confidence ?? 0), 0) / filtered.length;
  }, [filtered]);

  const highConfidenceSelectable = useMemo(
    () => filtered.filter((l) => (l.match_confidence ?? 0) >= 0.85).map((l) => l.id),
    [filtered]
  );

  const thresholdEligible = useMemo(() => {
    const eligibleTiers = new Set(["alias_match", "trigram_match", "ai_semantic_match"]);
    return filtered.filter(
      (l) =>
        l.match_tier != null &&
        eligibleTiers.has(l.match_tier) &&
        (l.match_confidence ?? 0) >= BULK_APPROVE_THRESHOLD
    );
  }, [filtered]);

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
        body: JSON.stringify({
          confidence_threshold: BULK_APPROVE_THRESHOLD,
        }),
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
      toast.error(
        `Bulk approve failed: ${err instanceof Error ? err.message : err}`
      );
    } finally {
      setThresholdBusy(false);
    }
  }, [thresholdEligible.length, fetchData]);

  return (
    <AppShell>
      <main className="max-w-[1400px] mx-auto px-6 py-8">
        <FinancialViewTabs active="items" />

        <Link
          href="/items"
          className="text-[11px] text-[var(--text-tertiary)] hover:text-nw-gulf-blue uppercase tracking-[0.12em]"
          style={{ fontFamily: "var(--font-jetbrains-mono)" }}
        >
          ← All items
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
            label="Avg confidence"
            value={`${Math.round(avgConfidence * 100)}%`}
          />
          <Kpi
            label="High confidence (≥85%)"
            value={highConfidenceSelectable.length.toLocaleString("en-US")}
          />
          <Kpi
            label="Selected"
            value={selected.size.toLocaleString("en-US")}
          />
        </div>

        {/* Filters + bulk actions */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
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

          <div className="ml-auto flex items-center gap-2">
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
            <NwButton
              variant="ghost"
              size="sm"
              onClick={clearSelection}
              disabled={selected.size === 0}
            >
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
                <th className="text-left px-3 py-2 font-medium">Tier</th>
                <th className="text-right px-3 py-2 font-medium">Conf.</th>
                <th className="text-right px-3 py-2 font-medium">Total</th>
                <th className="text-right px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-6 text-center text-[var(--text-tertiary)]">
                    Loading…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-6 text-center text-[var(--text-tertiary)]">
                    Queue is clear. All extracted lines have been verified.
                  </td>
                </tr>
              ) : (
                filtered.map((l) => {
                  const inv = l.invoice_extractions?.invoices;
                  const confidence = l.match_confidence ?? 0;
                  const confVariant =
                    confidence >= 0.85 ? "success" : confidence >= 0.7 ? "accent" : "warning";
                  return (
                    <tr
                      key={l.id}
                      className="border-b border-[var(--border-default)] last:border-b-0 hover:bg-[var(--bg-subtle)]"
                    >
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selected.has(l.id)}
                          onChange={() => toggleSelect(l.id)}
                          className="h-[16px] w-[16px]"
                        />
                      </td>
                      <td
                        className="px-3 py-2 text-[var(--text-tertiary)]"
                        style={{ fontFamily: "var(--font-jetbrains-mono)" }}
                      >
                        {new Date(l.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-2">
                        {inv ? (
                          <Link
                            href={`/invoices/${inv.id}`}
                            className="text-nw-gulf-blue hover:underline"
                          >
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
                        title={l.raw_description}
                      >
                        {l.raw_description}
                      </td>
                      <td className="px-3 py-2 text-[var(--text-secondary)]">
                        {l.proposed_item?.canonical_name ?? "(new item)"}
                      </td>
                      <td className="px-3 py-2">
                        {l.match_tier ? (
                          <NwBadge variant="neutral" size="sm">
                            {l.match_tier.replace(/_/g, " ")}
                          </NwBadge>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td
                        className="px-3 py-2 text-right"
                        style={{ fontFamily: "var(--font-jetbrains-mono)", fontVariantNumeric: "tabular-nums" }}
                      >
                        <NwBadge variant={confVariant} size="sm">
                          {Math.round(confidence * 100)}%
                        </NwBadge>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <NwMoney cents={l.raw_total_cents} size="sm" />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Link
                          href={`/invoices/${inv?.id}`}
                          className="inline-flex items-center h-[24px] px-2 border border-[var(--border-default)] text-[10px] uppercase tracking-[0.12em] text-[var(--text-secondary)] hover:text-nw-gulf-blue hover:border-nw-gulf-blue"
                          style={{ fontFamily: "var(--font-jetbrains-mono)" }}
                        >
                          Review
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </main>
    </AppShell>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
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
    </div>
  );
}
