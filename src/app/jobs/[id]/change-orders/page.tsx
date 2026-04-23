"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import JobTabs from "@/components/job-tabs";
import JobFinancialBar from "@/components/job-financial-bar";
import Breadcrumbs from "@/components/breadcrumbs";
import { supabase } from "@/lib/supabase/client";
import { formatCents, formatDate } from "@/lib/utils/format";
import EmptyState, { EmptyIcons } from "@/components/empty-state";
import NwBadge, { type BadgeVariant } from "@/components/nw/Badge";
import NwMoney from "@/components/nw/Money";
import NwButton from "@/components/nw/Button";

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

function coBadgeVariant(status: string): BadgeVariant {
  if (status === "approved") return "success";
  if (status === "pending") return "warning";
  if (status === "denied" || status === "void") return "danger";
  return "neutral";
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  pending: "Pending",
  approved: "Approved",
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

      const { data: membership } = await supabase
        .from("org_members")
        .select("role")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (membership) setUserRole(membership.role);

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
    const approved = cos.filter((co) => co.status === "approved");
    return {
      approvedCount: approved.length,
      approvedSum: approved.reduce((s, co) => s + co.amount, 0),
      pending: cos.filter((co) => ["draft", "pending"].includes(co.status)).length,
    };
  }, [cos]);

  const canApprove = userRole && ["owner", "admin"].includes(userRole);

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
            <span
              className="block mb-2 text-[10px] uppercase"
              style={{
                fontFamily: "var(--font-jetbrains-mono)",
                letterSpacing: "0.14em",
                color: "var(--text-tertiary)",
              }}
            >
              Job · Change Orders
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
          <Link
            href={`/jobs/${job.id}/change-orders/new`}
            className="inline-flex items-center justify-center h-9 px-4 text-[11px] uppercase font-medium border transition-colors"
            style={{
              fontFamily: "var(--font-jetbrains-mono)",
              letterSpacing: "0.12em",
              background: "var(--nw-stone-blue)",
              borderColor: "var(--nw-stone-blue)",
              color: "var(--nw-white-sand)",
            }}
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
          <div className="mb-4 border border-[rgba(176,85,78,0.35)] bg-[rgba(176,85,78,0.08)] px-4 py-3 text-sm text-[color:var(--nw-danger)]">
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
          <div className="bg-[var(--bg-card)] border border-[var(--border-default)] overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-default)] text-[10px] uppercase tracking-[0.14em] text-[color:var(--text-secondary)] font-medium">
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
                  <tr key={co.id} className="border-b border-[var(--border-default)] last:border-0 hover:bg-[rgba(91,134,153,0.06)]">
                    <td className="px-4 py-3 font-mono text-[color:var(--text-primary)]">
                      <Link href={`/change-orders/${co.id}`} className="text-[color:var(--nw-stone-blue)] hover:underline">
                        #{co.pcco_number}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-[color:var(--text-primary)]">
                      <div className="max-w-md">
                        <p className="truncate">{co.title ?? co.description ?? "—"}</p>
                        {co.source_invoice_id && (
                          <Link
                            href={`/invoices/${co.source_invoice_id}`}
                            className="text-[11px] text-[color:var(--nw-stone-blue)] hover:underline"
                          >
                            ↳ from invoice
                          </Link>
                        )}
                        {co.denied_reason && (
                          <p className="text-[11px] text-[color:var(--nw-danger)] italic mt-0.5">Denied: {co.denied_reason}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[color:var(--text-muted)]">
                      {co.co_type === "owner" ? (
                        <NwBadge variant="info" size="sm">Owner</NwBadge>
                      ) : (
                        <NwBadge variant="neutral" size="sm">Internal</NwBadge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <NwMoney cents={co.amount} signColor />
                    </td>
                    <td className="px-4 py-3">
                      <NwBadge variant={coBadgeVariant(co.status)} size="sm">
                        {STATUS_LABELS[co.status] ?? co.status}
                      </NwBadge>
                    </td>
                    <td className="px-4 py-3 text-[color:var(--text-secondary)] text-[11px]">{co.submitted_date ? formatDate(co.submitted_date) : "—"}</td>
                    <td className="px-4 py-3 text-[color:var(--text-secondary)] text-[11px]">{co.approved_date ? formatDate(co.approved_date) : "—"}</td>
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
  if (["approved", "denied", "void"].includes(co.status)) {
    if (co.status === "approved" && canApprove) {
      return (
        <NwButton
          variant="danger"
          size="sm"
          disabled={busy}
          onClick={() => {
            const note = prompt(`Void approved CO #${co.pcco_number}? Enter reason:`);
            if (!note) return;
            onStatus("void", { note });
          }}
        >
          Void
        </NwButton>
      );
    }
    return <span className="text-[11px] text-[color:var(--text-secondary)]">—</span>;
  }

  return (
    <div className="flex items-center justify-end gap-2 flex-wrap">
      {co.status === "draft" && (
        <NwButton variant="secondary" size="sm" disabled={busy} loading={busy} onClick={() => onStatus("pending")}>
          Submit
        </NwButton>
      )}
      {co.status === "pending" && canApprove && (
        <>
          <NwButton variant="primary" size="sm" disabled={busy} loading={busy} onClick={() => onStatus("approved")}>
            Approve
          </NwButton>
          <NwButton
            variant="danger"
            size="sm"
            disabled={busy}
            onClick={() => {
              const reason = prompt(`Deny CO #${co.pcco_number}? Enter reason:`);
              if (!reason) return;
              onStatus("denied", { denied_reason: reason });
            }}
          >
            Deny
          </NwButton>
        </>
      )}
      <NwButton
        variant="danger"
        size="sm"
        disabled={busy}
        onClick={() => {
          const note = prompt(`Void CO #${co.pcco_number}? Enter reason:`);
          if (!note) return;
          onStatus("void", { note });
        }}
      >
        Void
      </NwButton>
    </div>
  );
}
