"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import JobTabs from "@/components/job-tabs";
import JobFinancialBar from "@/components/job-financial-bar";
import Breadcrumbs from "@/components/breadcrumbs";
import POImportModal from "@/components/po-import-modal";
import { supabase } from "@/lib/supabase/client";
import { formatCents, formatDate } from "@/lib/utils/format";
import EmptyState, { EmptyIcons } from "@/components/empty-state";
import BudgetCostsSubTabs from "@/components/budget-costs-sub-tabs";
import NwBadge, { type BadgeVariant } from "@/components/nw/Badge";
import NwMoney from "@/components/nw/Money";
import NwButton from "@/components/nw/Button";

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

function poBadgeVariant(status: string): BadgeVariant {
  if (status === "issued") return "success";
  if (status === "partially_invoiced") return "warning";
  if (status === "fully_invoiced") return "info";
  if (status === "void") return "danger";
  return "neutral";
}

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
  const searchParams = useSearchParams();
  const [job, setJob] = useState<Job | null>(null);
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(searchParams.get("action") === "import");

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
      <main className="max-w-[1600px] mx-auto px-6 py-20 text-center">
        <div className="w-8 h-8 border-2 border-[var(--nw-stone-blue)]/30 border-t-teal animate-spin mx-auto" />
      </main>
    );
  }

  if (!job) {
    return (
      <main className="max-w-[1600px] mx-auto px-6 py-20 text-center">
        <p className="text-[color:var(--text-primary)]">Job not found</p>
        <Link href="/jobs" className="text-[color:var(--nw-stone-blue)] hover:underline text-sm">Back to jobs</Link>
      </main>
    );
  }

  return (
    <>
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
            <span
              className="block mb-2 text-[10px] uppercase"
              style={{
                fontFamily: "var(--font-jetbrains-mono)",
                letterSpacing: "0.14em",
                color: "var(--text-tertiary)",
              }}
            >
              Job · Purchase Orders
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
              {job.name}
            </h2>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
              {job.address ?? "No address"}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <NwButton variant="secondary" size="md" onClick={() => setImportOpen(true)}>
              Import POs
            </NwButton>
            <Link
              href={`/jobs/${job.id}/purchase-orders/new`}
              className="inline-flex items-center justify-center h-9 px-4 text-[11px] uppercase font-medium border transition-colors"
              style={{
                fontFamily: "var(--font-jetbrains-mono)",
                letterSpacing: "0.12em",
                background: "var(--nw-stone-blue)",
                borderColor: "var(--nw-stone-blue)",
                color: "var(--nw-white-sand)",
              }}
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
          <div className="mb-4 border border-[rgba(176,85,78,0.35)] bg-[rgba(176,85,78,0.08)] px-4 py-3 text-sm text-[color:var(--nw-danger)]">
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
          <div className="bg-[var(--bg-card)] border border-[var(--border-default)] overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-default)] text-[10px] uppercase tracking-[0.14em] text-[color:var(--text-secondary)] font-medium">
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
                    <tr key={po.id} className="border-b border-[var(--border-default)] last:border-0 hover:bg-[rgba(91,134,153,0.06)]">
                      <td className="px-4 py-3 font-mono text-[color:var(--text-primary)]">
                        <Link href={`/purchase-orders/${po.id}`} className="text-[color:var(--nw-stone-blue)] hover:underline">
                          {po.po_number ?? "—"}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-[color:var(--text-primary)]">{po.vendors?.name ?? <span className="text-[color:var(--text-secondary)]">—</span>}</td>
                      <td className="px-4 py-3 text-[color:var(--text-muted)] font-mono text-xs">{po.budget_lines?.cost_codes?.code ?? "—"}</td>
                      <td className="px-4 py-3 text-[color:var(--text-muted)] max-w-md truncate">{po.description ?? "—"}</td>
                      <td className="px-4 py-3 text-right">
                        <NwMoney cents={po.amount} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <NwMoney cents={po.invoiced_total} variant="muted" />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <NwMoney cents={remaining} variant={over ? "negative" : "default"} />
                      </td>
                      <td className="px-4 py-3">
                        <NwBadge variant={poBadgeVariant(po.status)} size="sm">
                          {STATUS_LABELS[po.status] ?? po.status}
                        </NwBadge>
                        <StaleBadge status={po.status} issuedDate={po.issued_date} invoicedTotal={po.invoiced_total} />
                        {po.issued_date && (
                          <p className="text-[10px] text-[color:var(--text-secondary)] mt-0.5">Issued {formatDate(po.issued_date)}</p>
                        )}
                        {po.amount > 0 && remaining >= 0 && remaining / po.amount < 0.10 && po.status !== "void" && po.status !== "closed" && (
                          <p className="text-[10px] text-[color:var(--nw-warn)] mt-0.5">90%+ consumed</p>
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
      <POImportModal
        open={importOpen}
        jobId={params.id}
        onClose={() => {
          setImportOpen(false);
          if (searchParams.get("action")) router.replace(`/jobs/${params.id}/purchase-orders`);
          router.refresh();
        }}
      />
    </>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`border p-4 ${highlight ? "border-[var(--nw-stone-blue)] bg-[rgba(91,134,153,0.12)]" : "border-[var(--border-default)] bg-[var(--bg-card)]"}`}>
      <p className="text-[10px] uppercase tracking-[0.14em] text-[color:var(--text-secondary)] font-medium font-medium">{label}</p>
      <p className="text-lg text-[color:var(--text-primary)] mt-1 tabular-nums">{value}</p>
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
    return <span className="text-[11px] text-[color:var(--text-secondary)]">—</span>;
  }
  return (
    <div className="flex items-center justify-end gap-2">
      {po.status === "draft" && (
        <NwButton variant="secondary" size="sm" disabled={busy} loading={busy} onClick={() => onStatus("issued")}>
          Issue
        </NwButton>
      )}
      {(po.status === "issued" || po.status === "partially_invoiced") && (
        <NwButton variant="ghost" size="sm" disabled={busy} onClick={() => onStatus("closed")}>
          Close
        </NwButton>
      )}
      <NwButton
        variant="danger"
        size="sm"
        disabled={busy}
        onClick={() => {
          const note = prompt(`Void PO ${po.po_number}? Enter reason:`);
          if (!note) return;
          onStatus("void", note);
        }}
      >
        Void
      </NwButton>
    </div>
  );
}

function StaleBadge({ status, issuedDate, invoicedTotal }: { status: string; issuedDate: string | null; invoicedTotal: number }) {
  if (status === "void" || status === "closed" || status === "fully_invoiced") return null;
  const now = Date.now();
  if (status === "draft") {
    const created = issuedDate ? new Date(issuedDate).getTime() : 0;
    if (created > 0 && now - created > 14 * 24 * 60 * 60 * 1000) {
      return <span className="ml-1.5"><NwBadge variant="neutral" size="sm">Draft 14d+</NwBadge></span>;
    }
    return null;
  }
  if (status === "issued" && invoicedTotal === 0 && issuedDate) {
    const issued = new Date(issuedDate).getTime();
    const days = Math.floor((now - issued) / (24 * 60 * 60 * 1000));
    if (days >= 60) {
      return <span className="ml-1.5"><NwBadge variant="warning" size="sm">Stale 60d</NwBadge></span>;
    }
    if (days >= 30) {
      return <span className="ml-1.5"><NwBadge variant="warning" size="sm">Stale</NwBadge></span>;
    }
  }
  return null;
}
