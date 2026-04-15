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

interface Job {
  id: string;
  name: string;
  address: string | null;
  current_contract_amount: number;
  original_contract_amount: number;
  approved_cos_total: number | null;
}

interface ChangeOrder {
  id: string;
  pcco_number: number;
  title: string | null;
  description: string | null;
  amount: number;
  gc_fee_amount: number;
  gc_fee_rate: number;
  total_with_fee: number;
  status: string;
  co_type: string;
  submitted_date: string | null;
  approved_date: string | null;
  denied_reason: string | null;
  draw_number: number | null;
  source_invoice_id: string | null;
}

const STATUS_STYLES: Record<string, string> = {
  draft: "text-cream-dim border-cream-dim/40",
  pending: "text-status-warning border-status-warning/40",
  pending_approval: "text-status-warning border-status-warning/40",
  approved: "text-status-success border-status-success/40",
  executed: "text-teal border-teal/40",
  denied: "text-status-danger border-status-danger/40",
  void: "text-status-danger border-status-danger/40 line-through",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  pending: "Pending",
  pending_approval: "Pending",
  approved: "Approved",
  executed: "Executed",
  denied: "Denied",
  void: "Void",
};

export default function ChangeOrdersPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(null);
  const [cos, setCos] = useState<ChangeOrder[]>([]);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    const res = await fetch(`/api/jobs/${params.id}/change-orders`);
    const data = await res.json();
    if (res.ok) setCos((data.change_orders ?? []) as ChangeOrder[]);
    const { data: j } = await supabase
      .from("jobs")
      .select("id, name, address, current_contract_amount, original_contract_amount, approved_cos_total")
      .eq("id", params.id)
      .single();
    if (j) setJob(j as Job);
  }

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace(`/login?redirect=/jobs/${params.id}/change-orders`); return; }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      if (profile) setUserRole(profile.role);

      await reload();
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id, router]);

  async function updateStatus(coId: string, status: string, opts?: { note?: string; denied_reason?: string }) {
    setBusyId(coId);
    setError(null);
    try {
      const res = await fetch(`/api/change-orders/${coId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, ...opts }),
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
    const approved = cos.filter((co) => ["approved", "executed"].includes(co.status));
    return {
      approvedCount: approved.length,
      approvedSum: approved.reduce((s, co) => s + co.amount, 0),
      pending: cos.filter((co) => ["draft", "pending", "pending_approval"].includes(co.status)).length,
    };
  }, [cos]);

  const canApprove = userRole && ["owner", "admin"].includes(userRole);

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
        <JobFinancialBar jobId={job.id} />

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Stat label="Original Contract" value={formatCents(job.original_contract_amount)} />
          <Stat label="Approved COs" value={formatCents(job.approved_cos_total ?? totals.approvedSum)} />
          <Stat label="Revised Contract" value={formatCents(job.current_contract_amount)} highlight />
          <Stat label="Pending / Draft" value={String(totals.pending)} />
        </div>

        {error && (
          <div className="mb-4 border border-status-danger/40 bg-status-danger/5 px-4 py-3 text-sm text-status-danger">
            {error}
          </div>
        )}

        {cos.length === 0 ? (
          <EmptyState
            icon={<EmptyIcons.Clipboard />}
            title="No change orders yet"
            message="Create a change order to track scope adjustments and contract amount changes for this job."
            primaryAction={{ label: "+ New Change Order", href: `/jobs/${job.id}/change-orders/new` }}
          />
        ) : (
          <div className="bg-brand-card border border-brand-border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-brand-border text-[11px] uppercase tracking-wider text-cream-dim">
                  <th className="text-left px-4 py-3 font-medium">PCCO #</th>
                  <th className="text-left px-4 py-3 font-medium">Title</th>
                  <th className="text-left px-4 py-3 font-medium">Type</th>
                  <th className="text-right px-4 py-3 font-medium">Amount</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium">Submitted</th>
                  <th className="text-left px-4 py-3 font-medium">Approved</th>
                  <th className="text-right px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {cos.map((co) => (
                  <tr key={co.id} className="border-b border-brand-row-border last:border-0 hover:bg-brand-surface/40">
                    <td className="px-4 py-3 font-mono text-cream">
                      <Link href={`/change-orders/${co.id}`} className="text-teal hover:underline">
                        #{co.pcco_number}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-cream">
                      <div className="max-w-md">
                        <p className="truncate">{co.title ?? co.description ?? "—"}</p>
                        {co.source_invoice_id && (
                          <Link
                            href={`/invoices/${co.source_invoice_id}`}
                            className="text-[11px] text-teal hover:underline"
                          >
                            ↳ from invoice
                          </Link>
                        )}
                        {co.denied_reason && (
                          <p className="text-[11px] text-status-danger italic mt-0.5">Denied: {co.denied_reason}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-cream-muted">
                      {co.co_type === "owner" ? (
                        <span className="inline-block px-2 py-0.5 text-[10px] uppercase tracking-wider border border-teal/40 text-teal">Owner</span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 text-[10px] uppercase tracking-wider border border-brand-border text-cream-muted">Internal</span>
                      )}
                    </td>
                    <td className={`px-4 py-3 text-right tabular-nums font-medium ${
                      co.amount < 0 ? "text-status-danger" : co.amount > 0 ? "text-status-success" : "text-cream"
                    }`}>
                      {formatCents(co.amount)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 text-[11px] uppercase tracking-wider border ${STATUS_STYLES[co.status] ?? ""}`}>
                        {STATUS_LABELS[co.status] ?? co.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-cream-dim text-[11px]">{co.submitted_date ? formatDate(co.submitted_date) : "—"}</td>
                    <td className="px-4 py-3 text-cream-dim text-[11px]">{co.approved_date ? formatDate(co.approved_date) : "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <CoActions
                        co={co}
                        busy={busyId === co.id}
                        canApprove={!!canApprove}
                        onStatus={(s, opts) => updateStatus(co.id, s, opts)}
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
  canApprove,
  onStatus,
}: {
  co: ChangeOrder;
  busy: boolean;
  canApprove: boolean;
  onStatus: (status: string, opts?: { note?: string; denied_reason?: string }) => void;
}) {
  if (["approved", "executed", "denied", "void"].includes(co.status)) {
    if (co.status === "approved" && canApprove) {
      return (
        <button
          disabled={busy}
          onClick={() => {
            const note = prompt(`Void approved CO #${co.pcco_number}? Enter reason:`);
            if (!note) return;
            onStatus("void", { note });
          }}
          className="px-3 py-1 text-xs border border-status-danger/60 text-status-danger hover:bg-status-danger hover:text-white disabled:opacity-50 transition-colors"
        >
          Void
        </button>
      );
    }
    return <span className="text-[11px] text-cream-dim">—</span>;
  }

  return (
    <div className="flex items-center justify-end gap-2 flex-wrap">
      {co.status === "draft" && (
        <button
          disabled={busy}
          onClick={() => onStatus("pending")}
          className="px-3 py-1 text-xs border border-teal text-teal hover:bg-teal hover:text-white disabled:opacity-50 transition-colors"
        >
          {busy ? "…" : "Submit"}
        </button>
      )}
      {(co.status === "pending" || co.status === "pending_approval") && canApprove && (
        <>
          <button
            disabled={busy}
            onClick={() => onStatus("approved")}
            className="px-3 py-1 text-xs bg-teal text-white hover:bg-teal-hover disabled:opacity-50 transition-colors"
          >
            {busy ? "…" : "Approve"}
          </button>
          <button
            disabled={busy}
            onClick={() => {
              const reason = prompt(`Deny CO #${co.pcco_number}? Enter reason:`);
              if (!reason) return;
              onStatus("denied", { denied_reason: reason });
            }}
            className="px-3 py-1 text-xs border border-status-danger/60 text-status-danger hover:bg-status-danger hover:text-white disabled:opacity-50 transition-colors"
          >
            Deny
          </button>
        </>
      )}
      <button
        disabled={busy}
        onClick={() => {
          const note = prompt(`Void CO #${co.pcco_number}? Enter reason:`);
          if (!note) return;
          onStatus("void", { note });
        }}
        className="px-3 py-1 text-xs border border-status-danger/60 text-status-danger hover:bg-status-danger hover:text-white disabled:opacity-50 transition-colors"
      >
        Void
      </button>
    </div>
  );
}
