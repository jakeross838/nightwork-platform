"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import NavBar from "@/components/nav-bar";
import JobTabs from "@/components/job-tabs";
import JobFinancialBar from "@/components/job-financial-bar";
import Breadcrumbs from "@/components/breadcrumbs";
import { supabase } from "@/lib/supabase/client";
import { formatCents, formatDate } from "@/lib/utils/format";
import EmptyState, { EmptyIcons } from "@/components/empty-state";
import BudgetCostsSubTabs from "@/components/budget-costs-sub-tabs";

interface Job {
  id: string;
  name: string;
  address: string | null;
}

interface PurchaseOrder {
  id: string;
  po_number: string | null;
  description: string | null;
  amount: number;
  invoiced_total: number;
  status: string;
  issued_date: string | null;
  vendors: { id: string; name: string } | null;
  budget_lines: { cost_codes: { code: string } | null } | null;
}

const STATUS_STYLES: Record<string, string> = {
  draft: "text-cream-dim border-cream-dim/40",
  issued: "text-status-success border-status-success/40",
  partially_invoiced: "text-brass border-brass/40",
  fully_invoiced: "text-teal border-teal/40",
  closed: "text-cream-muted border-brand-border",
  void: "text-status-danger border-status-danger/40 line-through",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  issued: "Issued",
  partially_invoiced: "Partially Invoiced",
  fully_invoiced: "Fully Invoiced",
  closed: "Closed",
  void: "Void",
};

export default function PurchaseOrdersPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(null);
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    const res = await fetch(`/api/jobs/${params.id}/purchase-orders`);
    const data = await res.json();
    if (res.ok) setPos((data.purchase_orders ?? []) as PurchaseOrder[]);
  }

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace(`/login?redirect=/jobs/${params.id}/purchase-orders`); return; }

      const { data: j } = await supabase
        .from("jobs")
        .select("id, name, address")
        .eq("id", params.id)
        .is("deleted_at", null)
        .single();
      if (j) setJob(j as Job);

      await reload();
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id, router]);

  async function updateStatus(poId: string, status: string, note?: string) {
    setBusyId(poId);
    setError(null);
    try {
      const res = await fetch(`/api/purchase-orders/${poId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, note }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusyId(null);
    }
  }

  const totals = useMemo(() => {
    const open = pos.filter((p) => ["issued", "partially_invoiced"].includes(p.status));
    return {
      count: pos.filter((p) => p.status !== "void").length,
      committed: pos
        .filter((p) => ["issued", "partially_invoiced", "fully_invoiced"].includes(p.status))
        .reduce((s, p) => s + p.amount, 0),
      invoiced: pos.reduce((s, p) => s + p.invoiced_total, 0),
      openRemaining: open.reduce((s, p) => s + (p.amount - p.invoiced_total), 0),
    };
  }, [pos]);

  if (loading) {
    return (
      <div className="min-h-screen">
        <NavBar />
        <main className="max-w-[1600px] mx-auto px-6 py-20 text-center">
          <div className="w-8 h-8 border-2 border-teal/30 border-t-teal animate-spin mx-auto" />
        </main>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen">
        <NavBar />
        <main className="max-w-[1600px] mx-auto px-6 py-20 text-center">
          <p className="text-cream">Job not found</p>
          <Link href="/jobs" className="text-teal hover:underline text-sm">Back to jobs</Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <NavBar />
      <main className="max-w-[1600px] mx-auto px-4 md:px-6 py-8">
        <Breadcrumbs
          items={[
            { label: "Jobs", href: "/jobs" },
            { label: job.name, href: `/jobs/${job.id}` },
            { label: "Purchase Orders" },
          ]}
        />
        <div className="flex items-start justify-between mb-4 flex-wrap gap-4">
          <div>
            <h2 className="font-display text-2xl text-cream">{job.name}</h2>
            <p className="text-sm text-cream-dim mt-1">{job.address ?? "No address"}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/jobs/${job.id}/purchase-orders/import`}
              className="px-4 py-2 border border-teal text-teal hover:bg-teal hover:text-white text-sm font-medium transition-colors"
            >
              Import POs
            </Link>
            <Link
              href={`/jobs/${job.id}/purchase-orders/new`}
              className="px-4 py-2 bg-teal hover:bg-teal-hover text-white text-sm font-medium transition-colors"
            >
              + New Purchase Order
            </Link>
          </div>
        </div>
        <JobTabs jobId={job.id} active="budget" />
        <JobFinancialBar jobId={job.id} />
        <BudgetCostsSubTabs jobId={job.id} active="pos" />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Stat label="Total POs" value={String(totals.count)} />
          <Stat label="Committed" value={formatCents(totals.committed)} highlight />
          <Stat label="Invoiced" value={formatCents(totals.invoiced)} />
          <Stat label="Open Remaining" value={formatCents(totals.openRemaining)} />
        </div>

        {error && (
          <div className="mb-4 border border-status-danger/40 bg-status-danger/5 px-4 py-3 text-sm text-status-danger">
            {error}
          </div>
        )}

        {pos.length === 0 ? (
          <EmptyState
            icon={<EmptyIcons.Cart />}
            title="No purchase orders yet"
            message="Create a PO to lock in vendor pricing and track committed spend against this job's budget."
            primaryAction={{ label: "+ Create PO", href: `/jobs/${job.id}/purchase-orders/new` }}
          />
        ) : (
          <div className="bg-brand-card border border-brand-border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-brand-border text-[11px] uppercase tracking-wider text-cream-dim">
                  <th className="text-left px-4 py-3 font-medium">PO #</th>
                  <th className="text-left px-4 py-3 font-medium">Vendor</th>
                  <th className="text-left px-4 py-3 font-medium">Cost Code</th>
                  <th className="text-left px-4 py-3 font-medium">Description</th>
                  <th className="text-right px-4 py-3 font-medium">Amount</th>
                  <th className="text-right px-4 py-3 font-medium">Invoiced</th>
                  <th className="text-right px-4 py-3 font-medium">Remaining</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-right px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pos.map((po) => {
                  const remaining = po.amount - po.invoiced_total;
                  const over = remaining < 0;
                  return (
                    <tr key={po.id} className="border-b border-brand-row-border last:border-0 hover:bg-brand-surface/40">
                      <td className="px-4 py-3 font-mono text-cream">
                        <Link href={`/purchase-orders/${po.id}`} className="text-teal hover:underline">
                          {po.po_number ?? "—"}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-cream">{po.vendors?.name ?? <span className="text-cream-dim">—</span>}</td>
                      <td className="px-4 py-3 text-cream-muted font-mono text-xs">{po.budget_lines?.cost_codes?.code ?? "—"}</td>
                      <td className="px-4 py-3 text-cream-muted max-w-md truncate">{po.description ?? "—"}</td>
                      <td className="px-4 py-3 text-right text-cream tabular-nums">{formatCents(po.amount)}</td>
                      <td className="px-4 py-3 text-right text-cream-muted tabular-nums">{formatCents(po.invoiced_total)}</td>
                      <td className={`px-4 py-3 text-right tabular-nums font-medium ${over ? "text-status-danger" : "text-status-success"}`}>
                        {formatCents(remaining)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 text-[11px] uppercase tracking-wider border ${STATUS_STYLES[po.status] ?? ""}`}>
                          {STATUS_LABELS[po.status] ?? po.status}
                        </span>
                        <StaleBadge status={po.status} issuedDate={po.issued_date} invoicedTotal={po.invoiced_total} />
                        {po.issued_date && (
                          <p className="text-[10px] text-cream-dim mt-0.5">Issued {formatDate(po.issued_date)}</p>
                        )}
                        {po.amount > 0 && remaining >= 0 && remaining / po.amount < 0.10 && po.status !== "void" && po.status !== "closed" && (
                          <p className="text-[10px] text-status-warning mt-0.5">90%+ consumed</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <PoActions
                          po={po}
                          busy={busyId === po.id}
                          onStatus={(s, note) => updateStatus(po.id, s, note)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`border p-4 ${highlight ? "border-teal bg-teal-muted" : "border-brand-border bg-brand-card"}`}>
      <p className="text-[11px] uppercase tracking-wider text-cream-dim font-medium">{label}</p>
      <p className="text-lg text-cream mt-1 tabular-nums">{value}</p>
    </div>
  );
}

function PoActions({
  po,
  busy,
  onStatus,
}: {
  po: PurchaseOrder;
  busy: boolean;
  onStatus: (status: string, note?: string) => void;
}) {
  if (po.status === "void" || po.status === "fully_invoiced" || po.status === "closed") {
    return <span className="text-[11px] text-cream-dim">—</span>;
  }
  return (
    <div className="flex items-center justify-end gap-2">
      {po.status === "draft" && (
        <button
          disabled={busy}
          onClick={() => onStatus("issued")}
          className="px-3 py-1 text-xs border border-teal text-teal hover:bg-teal hover:text-white disabled:opacity-50 transition-colors"
        >
          {busy ? "…" : "Issue"}
        </button>
      )}
      {(po.status === "issued" || po.status === "partially_invoiced") && (
        <button
          disabled={busy}
          onClick={() => onStatus("closed")}
          className="px-3 py-1 text-xs border border-brand-border text-cream-dim hover:text-cream disabled:opacity-50 transition-colors"
        >
          Close
        </button>
      )}
      <button
        disabled={busy}
        onClick={() => {
          const note = prompt(`Void PO ${po.po_number}? Enter reason:`);
          if (!note) return;
          onStatus("void", note);
        }}
        className="px-3 py-1 text-xs border border-status-danger/60 text-status-danger hover:bg-status-danger hover:text-white disabled:opacity-50 transition-colors"
      >
        Void
      </button>
    </div>
  );
}

function StaleBadge({ status, issuedDate, invoicedTotal }: { status: string; issuedDate: string | null; invoicedTotal: number }) {
  if (status === "void" || status === "closed" || status === "fully_invoiced") return null;
  const now = Date.now();
  if (status === "draft") {
    const created = issuedDate ? new Date(issuedDate).getTime() : 0;
    if (created > 0 && now - created > 14 * 24 * 60 * 60 * 1000) {
      return <span className="ml-1.5 px-1.5 py-0.5 text-[10px] uppercase tracking-wider border border-cream-dim/40 text-cream-dim">Draft 14d+</span>;
    }
    return null;
  }
  if (status === "issued" && invoicedTotal === 0 && issuedDate) {
    const issued = new Date(issuedDate).getTime();
    const days = Math.floor((now - issued) / (24 * 60 * 60 * 1000));
    if (days >= 60) {
      return <span className="ml-1.5 px-1.5 py-0.5 text-[10px] uppercase tracking-wider border border-status-warning text-status-warning bg-status-warning/10">Stale 60d</span>;
    }
    if (days >= 30) {
      return <span className="ml-1.5 px-1.5 py-0.5 text-[10px] uppercase tracking-wider border border-brass/40 text-brass">Stale</span>;
    }
  }
  return null;
}
