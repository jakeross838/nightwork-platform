"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import NavBar from "@/components/nav-bar";
import JobTabs from "@/components/job-tabs";
import Breadcrumbs from "@/components/breadcrumbs";
import { supabase } from "@/lib/supabase/client";
import { formatCents, formatDate } from "@/lib/utils/format";

interface Job {
  id: string;
  name: string;
  address: string | null;
  current_contract_amount: number;
  original_contract_amount: number;
}

interface ChangeOrder {
  id: string;
  pcco_number: number;
  description: string | null;
  amount: number;
  gc_fee_amount: number;
  gc_fee_rate: number;
  total_with_fee: number;
  status: string;
  approved_date: string | null;
  draw_number: number | null;
  source_invoice_id: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "text-cream-dim border-cream-dim/40",
  pending_approval: "text-status-warning border-status-warning/40",
  approved: "text-status-success border-status-success/40",
  executed: "text-teal border-teal/40",
  void: "text-status-danger border-status-danger/40",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  pending_approval: "Pending Approval",
  approved: "Approved",
  executed: "Executed",
  void: "Void",
};

export default function ChangeOrdersPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(null);
  const [cos, setCos] = useState<ChangeOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace(`/login?redirect=/jobs/${params.id}/change-orders`); return; }

      const { data: j } = await supabase
        .from("jobs")
        .select("id, name, address, current_contract_amount, original_contract_amount")
        .eq("id", params.id)
        .is("deleted_at", null)
        .single();
      if (j) setJob(j as Job);

      const res = await fetch(`/api/jobs/${params.id}/change-orders`);
      const data = await res.json();
      if (res.ok) setCos((data.change_orders ?? []) as ChangeOrder[]);
      setLoading(false);
    }
    load();
  }, [params.id, router]);

  async function updateStatus(coId: string, status: string, note?: string) {
    setBusyId(coId);
    setError(null);
    try {
      const res = await fetch(`/api/change-orders/${coId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, note }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      const reload = await fetch(`/api/jobs/${params.id}/change-orders`);
      const reloaded = await reload.json();
      setCos((reloaded.change_orders ?? []) as ChangeOrder[]);
      // Also refresh job for contract amount
      const { data: j } = await supabase
        .from("jobs")
        .select("id, name, address, current_contract_amount, original_contract_amount")
        .eq("id", params.id)
        .single();
      if (j) setJob(j as Job);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusyId(null);
    }
  }

  const totals = useMemo(() => {
    const executed = cos.filter((co) => co.status === "executed");
    return {
      executedCount: executed.length,
      executedSum: executed.reduce((s, co) => s + co.total_with_fee, 0),
      pending: cos.filter((co) => ["draft", "pending_approval", "approved"].includes(co.status)).length,
    };
  }, [cos]);

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
            { label: "Change Orders" },
          ]}
        />
        <div className="flex items-start justify-between mb-4 flex-wrap gap-4">
          <div>
            <h2 className="font-display text-2xl text-cream">{job.name}</h2>
            <p className="text-sm text-cream-dim mt-1">{job.address ?? "No address"}</p>
          </div>
          <Link
            href={`/jobs/${job.id}/change-orders/new`}
            className="px-4 py-2 bg-teal hover:bg-teal-hover text-white text-sm font-medium transition-colors"
          >
            + New Change Order
          </Link>
        </div>
        <JobTabs jobId={job.id} active="change-orders" />

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Stat label="Original Contract" value={formatCents(job.original_contract_amount)} />
          <Stat label="Current Contract" value={formatCents(job.current_contract_amount)} highlight />
          <Stat
            label="Executed COs"
            value={`${totals.executedCount} · ${formatCents(totals.executedSum)}`}
          />
          <Stat label="Pending" value={String(totals.pending)} />
        </div>

        {error && (
          <div className="mb-4 border border-status-danger/40 bg-status-danger/5 px-4 py-3 text-sm text-status-danger">
            {error}
          </div>
        )}

        {cos.length === 0 ? (
          <div className="bg-brand-card border border-brand-border p-12 text-center">
            <p className="text-cream-dim text-sm">No change orders yet.</p>
            <Link
              href={`/jobs/${job.id}/change-orders/new`}
              className="inline-block mt-3 text-sm text-teal hover:underline"
            >
              Create the first one
            </Link>
          </div>
        ) : (
          <div className="bg-brand-card border border-brand-border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-brand-border text-[11px] uppercase tracking-wider text-cream-dim">
                  <th className="text-left px-4 py-3 font-medium">PCCO #</th>
                  <th className="text-left px-4 py-3 font-medium">Description</th>
                  <th className="text-right px-4 py-3 font-medium">Base Amount</th>
                  <th className="text-right px-4 py-3 font-medium">GC Fee</th>
                  <th className="text-right px-4 py-3 font-medium">Total</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium">Billed Draw</th>
                  <th className="text-right px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {cos.map((co) => (
                  <tr key={co.id} className="border-b border-brand-row-border last:border-0 hover:bg-brand-surface/40">
                    <td className="px-4 py-3 font-mono text-cream">#{co.pcco_number}</td>
                    <td className="px-4 py-3 text-cream">
                      <div className="max-w-md">
                        <p className="truncate">{co.description ?? "—"}</p>
                        {co.source_invoice_id && (
                          <Link
                            href={`/invoices/${co.source_invoice_id}`}
                            className="text-[11px] text-teal hover:underline"
                          >
                            ↳ from invoice
                          </Link>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-cream tabular-nums">{formatCents(co.amount)}</td>
                    <td className="px-4 py-3 text-right text-cream-muted tabular-nums">
                      {(co.gc_fee_rate * 100).toFixed(1)}% · {formatCents(co.gc_fee_amount)}
                    </td>
                    <td className="px-4 py-3 text-right text-cream font-medium tabular-nums">
                      {formatCents(co.total_with_fee)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 text-[11px] uppercase tracking-wider border ${STATUS_COLORS[co.status] ?? ""}`}
                      >
                        {STATUS_LABELS[co.status] ?? co.status}
                      </span>
                      {co.approved_date && (
                        <p className="text-[10px] text-cream-dim mt-0.5">{formatDate(co.approved_date)}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-cream-dim">{co.draw_number ? `Draw #${co.draw_number}` : "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <CoActions
                        co={co}
                        busy={busyId === co.id}
                        onStatus={(s, note) => updateStatus(co.id, s, note)}
                      />
                    </td>
                  </tr>
                ))}
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

function CoActions({
  co,
  busy,
  onStatus,
}: {
  co: ChangeOrder;
  busy: boolean;
  onStatus: (status: string, note?: string) => void;
}) {
  if (co.status === "executed" || co.status === "void") {
    return <span className="text-[11px] text-cream-dim">—</span>;
  }
  const next: Record<string, string> = {
    draft: "pending_approval",
    pending_approval: "approved",
    approved: "executed",
  };
  const nextLabel: Record<string, string> = {
    draft: "Submit for Approval",
    pending_approval: "Mark Approved",
    approved: "Execute",
  };
  const ns = next[co.status];
  return (
    <div className="flex items-center justify-end gap-2">
      {ns && (
        <button
          disabled={busy}
          onClick={() => {
            if (ns === "executed" && !confirm(`Execute CO #${co.pcco_number}? This updates the budget and contract amount.`)) return;
            onStatus(ns);
          }}
          className="px-3 py-1 text-xs border border-teal text-teal hover:bg-teal hover:text-white disabled:opacity-50 transition-colors"
        >
          {busy ? "…" : nextLabel[co.status]}
        </button>
      )}
      <button
        disabled={busy}
        onClick={() => {
          const note = prompt(`Void CO #${co.pcco_number}? Enter reason:`);
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
