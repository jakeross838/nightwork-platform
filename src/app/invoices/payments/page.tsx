"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { formatCents, formatDate } from "@/lib/utils/format";
import AppShell from "@/components/app-shell";
import FinancialViewTabs from "@/components/financial-view-tabs";
import PaymentBatchByVendorPanel from "@/components/payment-batch-by-vendor-panel";

interface PaymentInvoice {
  id: string;
  vendor_name_raw: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  received_date: string | null;
  total_amount: number;
  status: string;
  payment_status: string;
  payment_date: string | null;
  payment_amount: number | null;
  payment_method: string | null;
  payment_reference: string | null;
  scheduled_payment_date: string | null;
  jobs: { id: string; name: string } | null;
  vendors: { id: string; name: string } | null;
}

type AgingBucket = "current" | "31_60" | "61_90" | "90_plus";

export default function PaymentsPage() {
  const [invoices, setInvoices] = useState<PaymentInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"tracking" | "batch" | "aging">("tracking");

  // Filters
  const [statusFilter, setStatusFilter] = useState<"all" | "unpaid" | "scheduled" | "paid" | "partial">("all");
  const [jobFilter, setJobFilter] = useState("");
  const [vendorFilter, setVendorFilter] = useState("");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [payMethod, setPayMethod] = useState<"check" | "ach" | "wire" | "credit_card">("check");

  async function refresh() {
    const { data } = await supabase
      .from("invoices")
      .select(
        `id, vendor_name_raw, invoice_number, invoice_date, received_date, total_amount, status,
         payment_status, payment_date, payment_amount, payment_method, payment_reference, scheduled_payment_date,
         jobs:job_id (id, name), vendors:vendor_id (id, name)`
      )
      .is("deleted_at", null)
      .in("status", ["qa_approved", "pushed_to_qb", "in_draw", "paid"])
      .order("created_at", { ascending: false });
    if (data) setInvoices(data as unknown as PaymentInvoice[]);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  const jobOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const i of invoices) if (i.jobs) seen.set(i.jobs.id, i.jobs.name);
    return Array.from(seen.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [invoices]);
  const vendorOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const i of invoices) if (i.vendors) seen.set(i.vendors.id, i.vendors.name);
    return Array.from(seen.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [invoices]);

  const filtered = useMemo(() => {
    return invoices.filter((i) => {
      if (statusFilter !== "all" && i.payment_status !== statusFilter) return false;
      if (jobFilter && i.jobs?.id !== jobFilter) return false;
      if (vendorFilter && i.vendors?.id !== vendorFilter) return false;
      if (dateStart && (i.received_date ?? "") < dateStart) return false;
      if (dateEnd && (i.received_date ?? "") > dateEnd) return false;
      return true;
    });
  }, [invoices, statusFilter, jobFilter, vendorFilter, dateStart, dateEnd]);

  // Summary cards
  const stats = useMemo(() => {
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();
    const thisMonthPaid = invoices
      .filter((i) => {
        if (i.payment_status !== "paid" || !i.payment_date) return false;
        const d = new Date(i.payment_date + "T00:00:00");
        return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
      })
      .reduce((s, i) => s + (i.payment_amount ?? i.total_amount), 0);

    const unpaidAmt = invoices
      .filter((i) => i.payment_status === "unpaid")
      .reduce((s, i) => s + i.total_amount, 0);
    const unpaidCount = invoices.filter((i) => i.payment_status === "unpaid").length;

    // Scheduled in the next 14 days.
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + 14);
    const cutoffIso = cutoff.toISOString().slice(0, 10);
    const soonScheduled = invoices
      .filter(
        (i) =>
          i.payment_status === "scheduled" &&
          i.scheduled_payment_date &&
          i.scheduled_payment_date <= cutoffIso
      )
      .reduce((s, i) => s + i.total_amount, 0);

    return { thisMonthPaid, unpaidAmt, unpaidCount, soonScheduled };
  }, [invoices]);

  // Aging calculation — based on approval date (~ received_date fallback).
  const aging = useMemo(() => {
    const buckets: Record<AgingBucket, { count: number; amount: number; rows: PaymentInvoice[] }> = {
      current: { count: 0, amount: 0, rows: [] },
      "31_60": { count: 0, amount: 0, rows: [] },
      "61_90": { count: 0, amount: 0, rows: [] },
      "90_plus": { count: 0, amount: 0, rows: [] },
    };
    const today = new Date();
    for (const inv of invoices) {
      if (inv.payment_status === "paid") continue;
      const ref = inv.received_date ?? inv.invoice_date;
      if (!ref) continue;
      const days = Math.floor((today.getTime() - new Date(ref + "T00:00:00").getTime()) / (1000 * 60 * 60 * 24));
      let b: AgingBucket;
      if (days <= 30) b = "current";
      else if (days <= 60) b = "31_60";
      else if (days <= 90) b = "61_90";
      else b = "90_plus";
      buckets[b].count++;
      buckets[b].amount += inv.total_amount;
      buckets[b].rows.push(inv);
    }
    return buckets;
  }, [invoices]);

  async function bulk(action: "schedule" | "mark_paid") {
    if (selected.size === 0) return;
    setBulkBusy(true);
    const body: Record<string, unknown> = { ids: Array.from(selected), action };
    if (action === "mark_paid") {
      body.payment_date = payDate;
      body.payment_method = payMethod;
    }
    const res = await fetch("/api/invoices/payments/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      setSelected(new Set());
      await refresh();
    }
    setBulkBusy(false);
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((i) => i.id)));
  }

  return (
    <AppShell>
      <main className="max-w-[1600px] mx-auto px-4 md:px-6 py-8">
        <FinancialViewTabs active="payments" />
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div>
            <span
              className="block mb-2 text-[10px] uppercase"
              style={{
                fontFamily: "var(--font-jetbrains-mono)",
                letterSpacing: "0.14em",
                color: "var(--text-tertiary)",
              }}
            >
              Financial · Payments
            </span>
            <h2
              className="m-0"
              style={{
                fontFamily: "var(--font-space-grotesk)",
                fontWeight: 500,
                fontSize: "30px",
                letterSpacing: "-0.02em",
                color: "var(--text-primary)",
              }}
            >
              Payment Tracking
            </h2>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
              Schedule payments, mark invoices paid, and keep the aging report honest.
            </p>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Card label="Unpaid" value={formatCents(stats.unpaidAmt)} sub={`${stats.unpaidCount} invoices`} />
          <Card label="Scheduled (14 days)" value={formatCents(stats.soonScheduled)} />
          <Card label="Paid This Month" value={formatCents(stats.thisMonthPaid)} />
          <Card
            label="Overdue 30+ Days"
            value={formatCents(aging["31_60"].amount + aging["61_90"].amount + aging["90_plus"].amount)}
            sub={`${aging["31_60"].count + aging["61_90"].count + aging["90_plus"].count} invoices`}
            danger
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-5 bg-brand-surface border border-brand-border p-1 w-fit">
          <button
            onClick={() => setTab("tracking")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              tab === "tracking" ? "bg-brand-elevated text-cream" : "text-cream-dim hover:text-cream"
            }`}
          >
            Tracking
          </button>
          <button
            onClick={() => setTab("batch")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              tab === "batch" ? "bg-brand-elevated text-cream" : "text-cream-dim hover:text-cream"
            }`}
          >
            Batch Payments
          </button>
          <button
            onClick={() => setTab("aging")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              tab === "aging" ? "bg-brand-elevated text-cream" : "text-cream-dim hover:text-cream"
            }`}
          >
            Aging Report
          </button>
        </div>

        {loading ? (
          <div className="py-16 text-center">
            <div className="w-8 h-8 border-2 border-teal/30 border-t-teal animate-spin mx-auto" />
          </div>
        ) : tab === "batch" ? (
          <PaymentBatchByVendorPanel invoices={invoices} onRefresh={refresh} />
        ) : tab === "tracking" ? (
          <>
            {/* Filters */}
            <div className="flex flex-wrap gap-3 mb-4">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                className="px-3 py-2 bg-brand-surface border border-brand-border text-sm text-cream focus:border-teal focus:outline-none"
              >
                <option value="all">All Payment Status</option>
                <option value="unpaid">Unpaid</option>
                <option value="scheduled">Scheduled</option>
                <option value="partial">Partial</option>
                <option value="paid">Paid</option>
              </select>
              <select
                value={jobFilter}
                onChange={(e) => setJobFilter(e.target.value)}
                className="px-3 py-2 bg-brand-surface border border-brand-border text-sm text-cream focus:border-teal focus:outline-none"
              >
                <option value="">All Jobs</option>
                {jobOptions.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.name}
                  </option>
                ))}
              </select>
              <select
                value={vendorFilter}
                onChange={(e) => setVendorFilter(e.target.value)}
                className="px-3 py-2 bg-brand-surface border border-brand-border text-sm text-cream focus:border-teal focus:outline-none"
              >
                <option value="">All Vendors</option>
                {vendorOptions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={dateStart}
                onChange={(e) => setDateStart(e.target.value)}
                className="px-3 py-2 bg-brand-surface border border-brand-border text-sm text-cream focus:border-teal focus:outline-none"
                placeholder="From"
              />
              <input
                type="date"
                value={dateEnd}
                onChange={(e) => setDateEnd(e.target.value)}
                className="px-3 py-2 bg-brand-surface border border-brand-border text-sm text-cream focus:border-teal focus:outline-none"
                placeholder="To"
              />
            </div>

            {/* Bulk actions */}
            {selected.size > 0 && (
              <div className="flex flex-wrap items-center gap-3 mb-3 p-3 bg-teal/5 border border-teal/30 animate-fade-up">
                <span className="text-sm text-cream">{selected.size} selected</span>
                <div className="flex-1" />
                <input
                  type="date"
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  className="px-2 py-1.5 bg-brand-surface border border-brand-border text-sm text-cream"
                />
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value as typeof payMethod)}
                  className="px-2 py-1.5 bg-brand-surface border border-brand-border text-sm text-cream"
                >
                  <option value="check">Check</option>
                  <option value="ach">ACH</option>
                  <option value="wire">Wire</option>
                  <option value="credit_card">Credit Card</option>
                </select>
                <button
                  onClick={() => bulk("schedule")}
                  disabled={bulkBusy}
                  className="px-3 py-1.5 border border-teal text-teal hover:bg-teal/10 disabled:opacity-50 text-sm font-medium"
                >
                  Schedule
                </button>
                <button
                  onClick={() => bulk("mark_paid")}
                  disabled={bulkBusy}
                  className="px-3 py-1.5 bg-teal hover:bg-teal-hover disabled:opacity-50 text-white text-sm font-medium"
                >
                  Mark as Paid
                </button>
              </div>
            )}

            {filtered.length === 0 ? (
              <div className="border border-brand-border p-10 text-center text-cream-dim text-sm">
                No invoices match your filters.
              </div>
            ) : (
              <div className="overflow-x-auto border border-brand-border">
                <table className="w-full min-w-[1100px] text-sm">
                  <thead>
                    <tr className="bg-brand-surface text-left">
                      <th className="py-3 px-4 w-10">
                        <input
                          type="checkbox"
                          checked={selected.size === filtered.length}
                          onChange={toggleAll}
                          className="rounded w-5 h-5 accent-teal"
                        />
                      </th>
                      <Th>Vendor</Th>
                      <Th>Invoice #</Th>
                      <Th>Job</Th>
                      <Th right>Amount</Th>
                      <Th>Status</Th>
                      <Th>Scheduled</Th>
                      <Th>Paid Date</Th>
                      <Th>Method</Th>
                      <Th>Reference</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((inv) => (
                      <tr key={inv.id} className="border-t border-brand-row-border hover:bg-brand-elevated/40 transition-colors">
                        <td className="py-3 px-4">
                          <input
                            type="checkbox"
                            checked={selected.has(inv.id)}
                            onChange={() => toggle(inv.id)}
                            className="rounded"
                          />
                        </td>
                        <td className="py-3 px-4 text-cream cursor-pointer" onClick={() => (window.location.href = `/invoices/${inv.id}`)}>
                          {inv.vendor_name_raw ?? "Unknown"}
                        </td>
                        <td className="py-3 px-4 text-cream-muted font-mono text-xs">
                          {inv.invoice_number ?? "—"}
                        </td>
                        <td className="py-3 px-4 text-cream-muted text-xs">{inv.jobs?.name ?? "—"}</td>
                        <td className="py-3 px-4 text-cream text-right font-display font-medium">
                          {formatCents(inv.total_amount)}
                          {inv.payment_status === "partial" && (
                            <div className="text-[10px] text-brass">
                              paid {formatCents(inv.payment_amount ?? 0)}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium border ${payStatusBadge(inv.payment_status)}`}>
                            {inv.payment_status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-cream-muted text-xs">{formatDate(inv.scheduled_payment_date)}</td>
                        <td className="py-3 px-4 text-cream-muted text-xs">{formatDate(inv.payment_date)}</td>
                        <td className="py-3 px-4 text-cream-muted text-xs">{inv.payment_method ?? "—"}</td>
                        <td className="py-3 px-4 text-cream-muted text-xs font-mono">{inv.payment_reference ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          /* AGING REPORT */
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <AgingCard label="Current (0–30)" {...aging.current} />
              <AgingCard label="31–60 Days" {...aging["31_60"]} warn />
              <AgingCard label="61–90 Days" {...aging["61_90"]} warn />
              <AgingCard label="90+ Days" {...aging["90_plus"]} danger />
            </div>
            {(["31_60", "61_90", "90_plus"] as AgingBucket[]).map((b) => (
              <div key={b}>
                <p className="text-[11px] font-medium text-cream-dim uppercase tracking-wider mb-2 mt-4">
                  {b.replace("_", "–")} Days — {aging[b].count} invoice(s) — {formatCents(aging[b].amount)}
                </p>
                {aging[b].rows.length > 0 && (
                  <div className="overflow-x-auto border border-brand-border">
                    <table className="w-full min-w-[700px] text-sm">
                      <thead>
                        <tr className="bg-brand-surface text-left">
                          <Th>Vendor</Th>
                          <Th>Invoice #</Th>
                          <Th>Received</Th>
                          <Th>Days Old</Th>
                          <Th right>Amount</Th>
                          <Th>Status</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {aging[b].rows.map((inv) => {
                          const ref = inv.received_date ?? inv.invoice_date;
                          const days = ref
                            ? Math.floor((Date.now() - new Date(ref + "T00:00:00").getTime()) / (1000 * 60 * 60 * 24))
                            : 0;
                          const color = b === "90_plus" ? "text-status-danger" : "text-brass";
                          return (
                            <tr key={inv.id} className="border-t border-brand-row-border hover:bg-brand-elevated/30 cursor-pointer" onClick={() => (window.location.href = `/invoices/${inv.id}`)}>
                              <td className="py-3 px-4 text-cream">{inv.vendor_name_raw ?? "Unknown"}</td>
                              <td className="py-3 px-4 text-cream-muted font-mono text-xs">{inv.invoice_number ?? "—"}</td>
                              <td className="py-3 px-4 text-cream-muted text-xs">{formatDate(ref)}</td>
                              <td className={`py-3 px-4 ${color} text-xs font-medium`}>{days} days</td>
                              <td className="py-3 px-4 text-cream text-right font-display font-medium">
                                {formatCents(inv.total_amount)}
                              </td>
                              <td className="py-3 px-4">
                                <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium border ${payStatusBadge(inv.payment_status)}`}>
                                  {inv.payment_status}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </AppShell>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th className={`py-3 px-4 text-[11px] text-cream font-bold uppercase tracking-wider ${right ? "text-right" : ""}`}>
      {children}
    </th>
  );
}

function Card({
  label,
  value,
  sub,
  danger,
}: {
  label: string;
  value: string;
  sub?: string;
  danger?: boolean;
}) {
  return (
    <div className={`bg-brand-card border ${danger ? "border-status-danger/40" : "border-brand-border"} px-4 py-3`}>
      <p className="text-[11px] font-medium text-cream-dim uppercase tracking-wider">{label}</p>
      <p className={`text-xl font-display font-medium mt-1 ${danger ? "text-status-danger" : "text-cream"}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-cream-dim mt-0.5">{sub}</p>}
    </div>
  );
}

function AgingCard({
  label,
  count,
  amount,
  warn,
  danger,
}: {
  label: string;
  count: number;
  amount: number;
  warn?: boolean;
  danger?: boolean;
}) {
  const color = danger ? "status-danger" : warn ? "brass" : "cream";
  const borderColor = danger ? "border-status-danger/40" : warn ? "border-brass/40" : "border-brand-border";
  return (
    <div className={`bg-brand-card border ${borderColor} px-4 py-3`}>
      <p className="text-[11px] font-medium text-cream-dim uppercase tracking-wider">{label}</p>
      <p className={`text-xl font-display font-medium mt-1 text-${color}`}>{formatCents(amount)}</p>
      <p className="text-xs text-cream-dim mt-0.5">{count} invoice(s)</p>
    </div>
  );
}

function payStatusBadge(s: string): string {
  if (s === "paid") return "bg-transparent text-status-success border border-status-success";
  if (s === "scheduled") return "bg-transparent text-teal border border-teal";
  if (s === "partial") return "bg-transparent text-brass border border-brass";
  return "bg-transparent text-cream-dim border border-brand-border-light";
}
