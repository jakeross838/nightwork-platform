"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import NavBar from "@/components/nav-bar";
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
      <div className="min-h-screen">
        <NavBar />
        <main className="max-w-[1200px] mx-auto px-6 py-20 text-center">
          <div className="w-8 h-8 border-2 border-teal/30 border-t-teal animate-spin mx-auto" />
        </main>
      </div>
    );
  }

  if (!co) {
    return (
      <div className="min-h-screen">
        <NavBar />
        <main className="max-w-[1200px] mx-auto px-6 py-20 text-center">
          <p className="text-cream">{error ?? "CO not found"}</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <NavBar />
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
            <p className="text-xs text-cream-dim uppercase tracking-wider">PCCO #{co.pcco_number}</p>
            <h2 className="font-display text-2xl text-cream">{co.title ?? co.description ?? "Untitled CO"}</h2>
            <p className="text-sm text-cream-dim mt-1">
              {co.jobs?.name} · {co.co_type === "owner" ? "Owner Change Order (contract)" : "Internal (budget only)"}
            </p>
          </div>
          <span className={`inline-block px-3 py-1 text-xs uppercase tracking-wider border ${STATUS_STYLES[co.status] ?? ""}`}>
            {STATUS_LABELS[co.status] ?? co.status}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="border border-brand-border bg-brand-card p-4">
            <p className="text-[11px] uppercase tracking-wider text-cream-dim">Base Amount</p>
            <p className="text-lg text-cream tabular-nums mt-1">{formatCents(co.amount)}</p>
          </div>
          <div className="border border-brand-border bg-brand-card p-4">
            <p className="text-[11px] uppercase tracking-wider text-cream-dim">GC Fee ({(co.gc_fee_rate * 100).toFixed(1)}%)</p>
            <p className="text-lg text-cream tabular-nums mt-1">{formatCents(co.gc_fee_amount)}</p>
          </div>
          <div className="border border-teal bg-teal-muted p-4">
            <p className="text-[11px] uppercase tracking-wider text-cream-dim">Total with Fee</p>
            <p className="text-xl text-cream tabular-nums mt-1 font-display">{formatCents(co.total_with_fee)}</p>
          </div>
          <div className="border border-brand-border bg-brand-card p-4">
            <p className="text-[11px] uppercase tracking-wider text-cream-dim">Days Added</p>
            <p className="text-lg text-cream mt-1">{co.estimated_days_added ?? 0}</p>
          </div>
        </div>

        {co.status === "denied" && co.denied_reason && (
          <div className="mb-6 border border-status-danger/40 bg-status-danger/10 px-4 py-3 text-sm text-status-danger">
            <span className="font-medium">Denied:</span> {co.denied_reason}
          </div>
        )}

        {error && (
          <div className="mb-4 border border-status-danger/40 bg-status-danger/5 px-4 py-3 text-sm text-status-danger">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            {co.description && (
              <div className="bg-brand-card border border-brand-border p-5">
                <h3 className="text-sm font-medium text-cream mb-2 uppercase tracking-wider">Description</h3>
                <p className="text-sm text-cream-muted whitespace-pre-wrap">{co.description}</p>
              </div>
            )}

            <div className="bg-brand-card border border-brand-border">
              <div className="border-b border-brand-border px-5 py-3">
                <h3 className="text-sm font-medium text-cream uppercase tracking-wider">Budget Line Allocations</h3>
              </div>
              {lines.length === 0 ? (
                <p className="text-sm text-cream-dim p-5">No line allocations — contract-only CO.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-brand-border text-[11px] uppercase tracking-wider text-cream-dim">
                      <th className="text-left px-4 py-2 font-medium">Budget Line</th>
                      <th className="text-left px-4 py-2 font-medium">Description</th>
                      <th className="text-right px-4 py-2 font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l) => (
                      <tr key={l.id} className="border-b border-brand-row-border last:border-0">
                        <td className="px-4 py-2 text-cream font-mono text-xs">
                          {l.budget_lines?.cost_codes?.code ?? l.cost_code ?? "—"}
                          {l.budget_lines?.cost_codes?.description && (
                            <span className="ml-2 text-cream-muted font-sans normal-case">{l.budget_lines.cost_codes.description}</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-cream-muted">{l.description ?? "—"}</td>
                        <td className={`px-4 py-2 text-right tabular-nums ${l.amount < 0 ? "text-status-danger" : l.amount > 0 ? "text-status-success" : "text-cream"}`}>
                          {formatCents(l.amount)}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-brand-border bg-brand-surface font-medium">
                      <td colSpan={2} className="px-4 py-2 text-[11px] uppercase tracking-wider text-cream-dim">Total</td>
                      <td className="px-4 py-2 text-right text-cream tabular-nums font-display">
                        {formatCents(lines.reduce((s, l) => s + l.amount, 0))}
                      </td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>

            {co.jobs && (co.status === "approved" || co.status === "executed") && (
              <div className="bg-brand-card border border-brand-border p-5">
                <h3 className="text-sm font-medium text-cream mb-3 uppercase tracking-wider">Contract Impact</h3>
                <dl className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <dt className="text-cream-dim text-[11px] uppercase tracking-wider">Original Contract</dt>
                    <dd className="text-cream mt-0.5 tabular-nums">{formatCents(co.jobs.original_contract_amount)}</dd>
                  </div>
                  <div>
                    <dt className="text-cream-dim text-[11px] uppercase tracking-wider">After COs</dt>
                    <dd className="text-cream mt-0.5 tabular-nums">{formatCents(co.jobs.current_contract_amount)}</dd>
                  </div>
                  <div>
                    <dt className="text-cream-dim text-[11px] uppercase tracking-wider">This CO</dt>
                    <dd className="text-teal mt-0.5 tabular-nums font-medium">+{formatCents(co.amount)}</dd>
                  </div>
                </dl>
              </div>
            )}
          </div>

          <aside className="space-y-4">
            <div className="bg-brand-card border border-brand-border p-4">
              <h3 className="text-sm font-medium text-cream uppercase tracking-wider mb-3">Actions</h3>
              <div className="flex flex-col gap-2">
                {co.status === "draft" && (
                  <button
                    disabled={busy}
                    onClick={() => updateStatus("pending")}
                    className="w-full px-3 py-2 text-sm border border-teal text-teal hover:bg-teal hover:text-white disabled:opacity-50 transition-colors"
                  >
                    Submit for Approval
                  </button>
                )}
                {(co.status === "pending" || co.status === "pending_approval") && canApprove && (
                  <>
                    <button
                      disabled={busy}
                      onClick={() => updateStatus("approved")}
                      className="w-full px-3 py-2 text-sm bg-teal text-white hover:bg-teal-hover disabled:opacity-50 transition-colors"
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
                      className="w-full px-3 py-2 text-sm border border-status-danger/60 text-status-danger hover:bg-status-danger hover:text-white disabled:opacity-50 transition-colors"
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
                    className="w-full px-3 py-2 text-sm border border-status-danger/60 text-status-danger hover:bg-status-danger hover:text-white disabled:opacity-50 transition-colors"
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
                    className="w-full px-3 py-2 text-sm border border-status-danger/60 text-status-danger hover:bg-status-danger hover:text-white disabled:opacity-50 transition-colors"
                  >
                    Void
                  </button>
                )}
              </div>
            </div>

            <div className="bg-brand-card border border-brand-border p-4 text-sm">
              <h3 className="text-sm font-medium text-cream uppercase tracking-wider mb-3">Dates</h3>
              <dl className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <dt className="text-cream-dim">Submitted</dt>
                  <dd className="text-cream">{co.submitted_date ? formatDate(co.submitted_date) : "—"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-cream-dim">Approved</dt>
                  <dd className="text-cream">{co.approved_date ? formatDate(co.approved_date) : "—"}</dd>
                </div>
              </dl>
              {co.source_invoice_id && (
                <Link
                  href={`/invoices/${co.source_invoice_id}`}
                  className="text-[11px] text-teal hover:underline mt-3 inline-block"
                >
                  ↳ Drafted from an invoice
                </Link>
              )}
            </div>

            {co.status_history && co.status_history.length > 0 && (
              <div className="bg-brand-card border border-brand-border p-4">
                <h3 className="text-sm font-medium text-cream uppercase tracking-wider mb-3">History</h3>
                <ul className="space-y-2 text-[11px] text-cream-dim">
                  {co.status_history.map((h, i) => (
                    <li key={i}>
                      <div>
                        <span className="text-cream">
                          {h.old_status ? `${STATUS_LABELS[h.old_status] ?? h.old_status} → ` : ""}
                          {STATUS_LABELS[h.new_status] ?? h.new_status}
                        </span>
                      </div>
                      <div>{formatDate(h.when)}</div>
                      {h.note && <div className="text-cream-muted italic">{h.note}</div>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}
