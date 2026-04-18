"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import AppShell from "@/components/app-shell";
import Breadcrumbs from "@/components/breadcrumbs";
import { supabase } from "@/lib/supabase/client";
import { formatCents, formatDate } from "@/lib/utils/format";

interface CoDetail {
  id: string;
  job_id: string;
  pcco_number: number;
  title: string | null;
  description: string | null;
  amount: number;
  gc_fee_amount: number;
  gc_fee_rate: number;
  total_with_fee: number;
  estimated_days_added: number | null;
  status: string;
  co_type: string;
  submitted_date: string | null;
  approved_date: string | null;
  denied_reason: string | null;
  source_invoice_id: string | null;
  status_history: Array<{ when: string; old_status: string | null; new_status: string; note?: string }>;
  jobs: { id: string; name: string; original_contract_amount: number; current_contract_amount: number } | null;
}

interface CoLine {
  id: string;
  budget_line_id: string | null;
  cost_code: string | null;
  description: string | null;
  amount: number;
  budget_lines: { id: string; cost_codes: { code: string; description: string } | null } | null;
}

const STATUS_STYLES: Record<string, string> = {
  draft: "text-[rgba(59,88,100,0.55)] border-cream-dim/40",
  pending: "text-nw-warn border-nw-warn/40",
  pending_approval: "text-nw-warn border-nw-warn/40",
  approved: "text-nw-success border-nw-success/40",
  executed: "text-stone-blue border-stone-blue/40",
  denied: "text-nw-danger border-nw-danger/40",
  void: "text-nw-danger border-nw-danger/40 line-through",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  pending: "Pending Approval",
  pending_approval: "Pending Approval",
  approved: "Approved",
  executed: "Executed",
  denied: "Denied",
  void: "Void",
};

export default function ChangeOrderDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [co, setCo] = useState<CoDetail | null>(null);
  const [lines, setLines] = useState<CoLine[]>([]);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/change-orders/${params.id}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to load CO");
      setLoading(false);
      return;
    }
    setCo(data.change_order as CoDetail);
    setLines((data.lines as CoLine[]) ?? []);
    setLoading(false);
  }, [params.id]);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace(`/login?redirect=/change-orders/${params.id}`); return; }
      const { data: membership } = await supabase
        .from("org_members").select("role").eq("user_id", user.id).eq("is_active", true).maybeSingle();
      if (membership) setUserRole(membership.role);
      await load();
    }
    init();
  }, [params.id, router, load]);

  async function updateStatus(status: string, opts?: { note?: string; denied_reason?: string }) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/change-orders/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, ...opts }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  const canApprove = userRole && ["owner", "admin"].includes(userRole);

  if (loading) {
    return (
      <AppShell>
        <main className="max-w-[1200px] mx-auto px-6 py-20 text-center">
          <div className="w-8 h-8 border-2 border-stone-blue/30 border-t-teal animate-spin mx-auto" />
        </main>
      </AppShell>
    );
  }

  if (!co) {
    return (
      <AppShell>
        <main className="max-w-[1200px] mx-auto px-6 py-20 text-center">
          <p className="text-slate-tile">{error ?? "CO not found"}</p>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <main className="max-w-[1200px] mx-auto px-4 md:px-6 py-8">
        <Breadcrumbs
          items={[
            { label: "Jobs", href: "/jobs" },
            co.jobs ? { label: co.jobs.name, href: `/jobs/${co.jobs.id}` } : { label: "Job" },
            { label: "Change Orders", href: co.jobs ? `/jobs/${co.jobs.id}/change-orders` : "#" },
            { label: `PCCO #${co.pcco_number}` },
          ]}
        />

        <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
          <div>
            <p className="text-xs text-[rgba(59,88,100,0.55)] uppercase tracking-wider">PCCO #{co.pcco_number}</p>
            <h2 className="font-display text-2xl text-slate-tile">{co.title ?? co.description ?? "Untitled CO"}</h2>
            <p className="text-sm text-[rgba(59,88,100,0.55)] mt-1">
              {co.jobs?.name} · {co.co_type === "owner" ? "Owner Change Order (contract)" : "Internal (budget only)"}
            </p>
          </div>
          <span className={`inline-block px-3 py-1 text-xs uppercase tracking-wider border ${STATUS_STYLES[co.status] ?? ""}`}>
            {STATUS_LABELS[co.status] ?? co.status}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="border border-[rgba(59,88,100,0.15)] bg-white p-4">
            <p className="text-[11px] uppercase tracking-wider text-[rgba(59,88,100,0.55)]">Base Amount</p>
            <p className="text-lg text-slate-tile tabular-nums mt-1">{formatCents(co.amount)}</p>
          </div>
          <div className="border border-[rgba(59,88,100,0.15)] bg-white p-4">
            <p className="text-[11px] uppercase tracking-wider text-[rgba(59,88,100,0.55)]">GC Fee ({(co.gc_fee_rate * 100).toFixed(1)}%)</p>
            <p className="text-lg text-slate-tile tabular-nums mt-1">{formatCents(co.gc_fee_amount)}</p>
          </div>
          <div className="border border-stone-blue bg-slate-deep-muted p-4">
            <p className="text-[11px] uppercase tracking-wider text-[rgba(59,88,100,0.55)]">Total with Fee</p>
            <p className="text-xl text-slate-tile tabular-nums mt-1 font-display">{formatCents(co.total_with_fee)}</p>
          </div>
          <div className="border border-[rgba(59,88,100,0.15)] bg-white p-4">
            <p className="text-[11px] uppercase tracking-wider text-[rgba(59,88,100,0.55)]">Days Added</p>
            <p className="text-lg text-slate-tile mt-1">{co.estimated_days_added ?? 0}</p>
          </div>
        </div>

        {co.status === "denied" && co.denied_reason && (
          <div className="mb-6 border border-nw-danger/40 bg-nw-danger/10 px-4 py-3 text-sm text-nw-danger">
            <span className="font-medium">Denied:</span> {co.denied_reason}
          </div>
        )}

        {error && (
          <div className="mb-4 border border-nw-danger/40 bg-nw-danger/5 px-4 py-3 text-sm text-nw-danger">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            {co.description && (
              <div className="bg-white border border-[rgba(59,88,100,0.15)] p-5">
                <h3 className="text-sm font-medium text-slate-tile mb-2 uppercase tracking-wider">Description</h3>
                <p className="text-sm text-[rgba(59,88,100,0.70)] whitespace-pre-wrap">{co.description}</p>
              </div>
            )}

            <div className="bg-white border border-[rgba(59,88,100,0.15)]">
              <div className="border-b border-[rgba(59,88,100,0.15)] px-5 py-3">
                <h3 className="text-sm font-medium text-slate-tile uppercase tracking-wider">Budget Line Allocations</h3>
              </div>
              {lines.length === 0 ? (
                <p className="text-sm text-[rgba(59,88,100,0.55)] p-5">No line allocations — contract-only CO.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[rgba(59,88,100,0.15)] text-[11px] uppercase tracking-wider text-[rgba(59,88,100,0.55)]">
                      <th className="text-left px-4 py-2 font-medium">Budget Line</th>
                      <th className="text-left px-4 py-2 font-medium">Description</th>
                      <th className="text-right px-4 py-2 font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l) => (
                      <tr key={l.id} className="border-b border-[rgba(59,88,100,0.08)] last:border-0">
                        <td className="px-4 py-2 text-slate-tile font-mono text-xs">
                          {l.budget_lines?.cost_codes?.code ?? l.cost_code ?? "—"}
                          {l.budget_lines?.cost_codes?.description && (
                            <span className="ml-2 text-[rgba(59,88,100,0.70)] font-sans normal-case">{l.budget_lines.cost_codes.description}</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-[rgba(59,88,100,0.70)]">{l.description ?? "—"}</td>
                        <td className={`px-4 py-2 text-right tabular-nums ${l.amount < 0 ? "text-nw-danger" : l.amount > 0 ? "text-nw-success" : "text-slate-tile"}`}>
                          {formatCents(l.amount)}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-[rgba(59,88,100,0.15)] bg-[rgba(91,134,153,0.06)] font-medium">
                      <td colSpan={2} className="px-4 py-2 text-[11px] uppercase tracking-wider text-[rgba(59,88,100,0.55)]">Total</td>
                      <td className="px-4 py-2 text-right text-slate-tile tabular-nums font-display">
                        {formatCents(lines.reduce((s, l) => s + l.amount, 0))}
                      </td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>

            {co.jobs && (co.status === "approved" || co.status === "executed") && (
              <div className="bg-white border border-[rgba(59,88,100,0.15)] p-5">
                <h3 className="text-sm font-medium text-slate-tile mb-3 uppercase tracking-wider">Contract Impact</h3>
                <dl className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <dt className="text-[rgba(59,88,100,0.55)] text-[11px] uppercase tracking-wider">Original Contract</dt>
                    <dd className="text-slate-tile mt-0.5 tabular-nums">{formatCents(co.jobs.original_contract_amount)}</dd>
                  </div>
                  <div>
                    <dt className="text-[rgba(59,88,100,0.55)] text-[11px] uppercase tracking-wider">After COs</dt>
                    <dd className="text-slate-tile mt-0.5 tabular-nums">{formatCents(co.jobs.current_contract_amount)}</dd>
                  </div>
                  <div>
                    <dt className="text-[rgba(59,88,100,0.55)] text-[11px] uppercase tracking-wider">This CO</dt>
                    <dd className="text-stone-blue mt-0.5 tabular-nums font-medium">+{formatCents(co.amount)}</dd>
                  </div>
                </dl>
              </div>
            )}
          </div>

          <aside className="space-y-4">
            <div className="bg-white border border-[rgba(59,88,100,0.15)] p-4">
              <h3 className="text-sm font-medium text-slate-tile uppercase tracking-wider mb-3">Actions</h3>
              <div className="flex flex-col gap-2">
                {co.status === "draft" && (
                  <button
                    disabled={busy}
                    onClick={() => updateStatus("pending")}
                    className="w-full px-3 py-2 text-sm border border-stone-blue text-stone-blue hover:bg-stone-blue hover:text-white disabled:opacity-50 transition-colors"
                  >
                    Submit for Approval
                  </button>
                )}
                {(co.status === "pending" || co.status === "pending_approval") && canApprove && (
                  <>
                    <button
                      disabled={busy}
                      onClick={() => updateStatus("approved")}
                      className="w-full px-3 py-2 text-sm bg-slate-deep text-white hover:bg-slate-deeper disabled:opacity-50 transition-colors"
                    >
                      {busy ? "…" : "Approve"}
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => {
                        const reason = prompt("Deny reason:");
                        if (!reason) return;
                        updateStatus("denied", { denied_reason: reason });
                      }}
                      className="w-full px-3 py-2 text-sm border border-nw-danger/60 text-nw-danger hover:bg-nw-danger hover:text-white disabled:opacity-50 transition-colors"
                    >
                      Deny
                    </button>
                  </>
                )}
                {co.status !== "void" && !["draft", "pending", "pending_approval"].includes(co.status) && canApprove && (
                  <button
                    disabled={busy}
                    onClick={() => {
                      const note = prompt("Void reason:");
                      if (!note) return;
                      updateStatus("void", { note });
                    }}
                    className="w-full px-3 py-2 text-sm border border-nw-danger/60 text-nw-danger hover:bg-nw-danger hover:text-white disabled:opacity-50 transition-colors"
                  >
                    Void
                  </button>
                )}
                {(co.status === "draft" || co.status === "pending" || co.status === "pending_approval") && (
                  <button
                    disabled={busy}
                    onClick={() => {
                      const note = prompt("Void reason:");
                      if (!note) return;
                      updateStatus("void", { note });
                    }}
                    className="w-full px-3 py-2 text-sm border border-nw-danger/60 text-nw-danger hover:bg-nw-danger hover:text-white disabled:opacity-50 transition-colors"
                  >
                    Void
                  </button>
                )}
              </div>
            </div>

            <div className="bg-white border border-[rgba(59,88,100,0.15)] p-4 text-sm">
              <h3 className="text-sm font-medium text-slate-tile uppercase tracking-wider mb-3">Dates</h3>
              <dl className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <dt className="text-[rgba(59,88,100,0.55)]">Submitted</dt>
                  <dd className="text-slate-tile">{co.submitted_date ? formatDate(co.submitted_date) : "—"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[rgba(59,88,100,0.55)]">Approved</dt>
                  <dd className="text-slate-tile">{co.approved_date ? formatDate(co.approved_date) : "—"}</dd>
                </div>
              </dl>
              {co.source_invoice_id && (
                <Link
                  href={`/invoices/${co.source_invoice_id}`}
                  className="text-[11px] text-stone-blue hover:underline mt-3 inline-block"
                >
                  ↳ Drafted from an invoice
                </Link>
              )}
            </div>

            {co.status_history && co.status_history.length > 0 && (
              <div className="bg-white border border-[rgba(59,88,100,0.15)] p-4">
                <h3 className="text-sm font-medium text-slate-tile uppercase tracking-wider mb-3">History</h3>
                <ul className="space-y-2 text-[11px] text-[rgba(59,88,100,0.55)]">
                  {co.status_history.map((h, i) => (
                    <li key={i}>
                      <div>
                        <span className="text-slate-tile">
                          {h.old_status ? `${STATUS_LABELS[h.old_status] ?? h.old_status} → ` : ""}
                          {STATUS_LABELS[h.new_status] ?? h.new_status}
                        </span>
                      </div>
                      <div>{formatDate(h.when)}</div>
                      {h.note && <div className="text-[rgba(59,88,100,0.70)] italic">{h.note}</div>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </aside>
        </div>
      </main>
    </AppShell>
  );
}
