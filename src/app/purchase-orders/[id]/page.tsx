"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import NavBar from "@/components/nav-bar";
import Breadcrumbs from "@/components/breadcrumbs";
import { supabase } from "@/lib/supabase/client";
import { formatCents, formatDate, formatStatus, statusBadgeOutline } from "@/lib/utils/format";

interface PoDetail {
  id: string;
  job_id: string;
  po_number: string | null;
  description: string | null;
  amount: number;
  invoiced_total: number;
  status: string;
  issued_date: string | null;
  notes: string | null;
  status_history: Array<{ when: string; old_status: string | null; new_status: string; note?: string }>;
  vendors: { id: string; name: string; email: string | null; phone: string | null } | null;
  budget_lines: {
    id: string;
    revised_estimate: number;
    cost_codes: { code: string; description: string } | null;
  } | null;
  cost_codes: { code: string; description: string } | null;
  jobs: { id: string; name: string; address: string | null } | null;
}

interface LineItem {
  id: string;
  budget_line_id: string | null;
  cost_code: string | null;
  description: string | null;
  amount: number;
  sort_order: number;
  budget_lines: { cost_codes: { code: string; description: string } | null } | null;
}

interface InvoiceLine {
  id: string;
  invoice_id: string;
  description: string | null;
  amount_cents: number;
  invoices: {
    id: string;
    invoice_number: string | null;
    invoice_date: string | null;
    status: string;
    vendor_name_raw: string | null;
  } | null;
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

export default function PurchaseOrderDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [po, setPo] = useState<PoDetail | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [invoiceLines, setInvoiceLines] = useState<InvoiceLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/purchase-orders/${params.id}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to load PO");
      setLoading(false);
      return;
    }
    setPo(data.purchase_order as PoDetail);
    setLineItems((data.line_items as LineItem[]) ?? []);
    setInvoiceLines((data.invoice_lines as InvoiceLine[]) ?? []);
    setLoading(false);
  }, [params.id]);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace(`/login?redirect=/purchase-orders/${params.id}`); return; }
      await load();
    }
    init();
  }, [params.id, router, load]);

  async function updateStatus(status: string, note?: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/purchase-orders/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, note }),
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

  const remaining = useMemo(() => (po ? po.amount - po.invoiced_total : 0), [po]);
  const overage = remaining < 0 ? Math.abs(remaining) : 0;

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

  if (!po) {
    return (
      <div className="min-h-screen">
        <NavBar />
        <main className="max-w-[1200px] mx-auto px-6 py-20 text-center">
          <p className="text-cream">{error ?? "PO not found"}</p>
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
            po.jobs
              ? { label: po.jobs.name, href: `/jobs/${po.jobs.id}` }
              : { label: "Job" },
            { label: "Purchase Orders", href: po.jobs ? `/jobs/${po.jobs.id}/purchase-orders` : "#" },
            { label: po.po_number ?? "PO" },
          ]}
        />

        <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
          <div>
            <h2 className="font-display text-2xl text-cream">{po.po_number ?? "Untitled PO"}</h2>
            <p className="text-sm text-cream-dim mt-1">
              {po.vendors?.name ?? "No vendor"} · {po.jobs?.name}
            </p>
          </div>
          <span className={`inline-block px-3 py-1 text-xs uppercase tracking-wider border ${STATUS_STYLES[po.status] ?? ""}`}>
            {STATUS_LABELS[po.status] ?? po.status}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="border border-brand-border bg-brand-card p-4">
            <p className="text-[11px] uppercase tracking-wider text-cream-dim">PO Amount</p>
            <p className="text-xl text-cream tabular-nums mt-1 font-display">{formatCents(po.amount)}</p>
          </div>
          <div className="border border-brand-border bg-brand-card p-4">
            <p className="text-[11px] uppercase tracking-wider text-cream-dim">Invoiced Against</p>
            <p className="text-xl text-cream tabular-nums mt-1 font-display">{formatCents(po.invoiced_total)}</p>
          </div>
          <div className={`border p-4 ${remaining < 0 ? "border-status-danger bg-status-danger/5" : "border-teal bg-teal-muted"}`}>
            <p className="text-[11px] uppercase tracking-wider text-cream-dim">Remaining</p>
            <p className={`text-xl tabular-nums mt-1 font-display ${remaining < 0 ? "text-status-danger" : "text-cream"}`}>
              {formatCents(remaining)}
            </p>
          </div>
        </div>

        {overage > 0 && (
          <div className="mb-6 border border-status-danger/40 bg-status-danger/10 px-4 py-3 text-sm text-status-danger">
            Invoices exceed PO by <span className="font-medium tabular-nums">{formatCents(overage)}</span>. Review linked invoices or consider closing the PO and issuing a change order.
          </div>
        )}

        {error && (
          <div className="mb-4 border border-status-danger/40 bg-status-danger/5 px-4 py-3 text-sm text-status-danger">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main column */}
          <div className="md:col-span-2 space-y-6">
            <div className="bg-brand-card border border-brand-border p-5">
              <h3 className="text-sm font-medium text-cream mb-3 uppercase tracking-wider">Details</h3>
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-cream-dim text-[11px] uppercase tracking-wider">Vendor</dt>
                  <dd className="text-cream mt-0.5">{po.vendors?.name ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-cream-dim text-[11px] uppercase tracking-wider">Budget Line</dt>
                  <dd className="text-cream mt-0.5">
                    {po.budget_lines?.cost_codes
                      ? `${po.budget_lines.cost_codes.code} — ${po.budget_lines.cost_codes.description}`
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-cream-dim text-[11px] uppercase tracking-wider">Issued Date</dt>
                  <dd className="text-cream mt-0.5">{po.issued_date ? formatDate(po.issued_date) : "—"}</dd>
                </div>
                <div>
                  <dt className="text-cream-dim text-[11px] uppercase tracking-wider">Description</dt>
                  <dd className="text-cream mt-0.5">{po.description ?? "—"}</dd>
                </div>
                {po.notes && (
                  <div className="col-span-2">
                    <dt className="text-cream-dim text-[11px] uppercase tracking-wider">Notes</dt>
                    <dd className="text-cream mt-0.5 whitespace-pre-wrap">{po.notes}</dd>
                  </div>
                )}
              </dl>
            </div>

            {lineItems.length > 0 && (
              <div className="bg-brand-card border border-brand-border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-brand-border text-[11px] uppercase tracking-wider text-cream-dim">
                      <th className="text-left px-4 py-3 font-medium">Budget Line</th>
                      <th className="text-left px-4 py-3 font-medium">Description</th>
                      <th className="text-right px-4 py-3 font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((li) => (
                      <tr key={li.id} className="border-b border-brand-row-border last:border-0">
                        <td className="px-4 py-2 text-cream font-mono text-xs">
                          {li.budget_lines?.cost_codes?.code ?? li.cost_code ?? "—"}
                        </td>
                        <td className="px-4 py-2 text-cream-muted">{li.description ?? "—"}</td>
                        <td className="px-4 py-2 text-right text-cream tabular-nums">{formatCents(li.amount)}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-brand-border bg-brand-surface font-medium">
                      <td colSpan={2} className="px-4 py-2 text-[11px] uppercase tracking-wider text-cream-dim">Line Total</td>
                      <td className="px-4 py-2 text-right text-cream tabular-nums font-display">
                        {formatCents(lineItems.reduce((s, li) => s + li.amount, 0))}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            <div className="bg-brand-card border border-brand-border">
              <div className="border-b border-brand-border px-5 py-3">
                <h3 className="text-sm font-medium text-cream uppercase tracking-wider">Linked Invoices</h3>
              </div>
              {invoiceLines.length === 0 ? (
                <p className="text-sm text-cream-dim p-5">No invoice lines linked to this PO yet.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-brand-border text-[11px] uppercase tracking-wider text-cream-dim">
                      <th className="text-left px-4 py-2 font-medium">Invoice</th>
                      <th className="text-left px-4 py-2 font-medium">Vendor</th>
                      <th className="text-left px-4 py-2 font-medium">Date</th>
                      <th className="text-left px-4 py-2 font-medium">Status</th>
                      <th className="text-right px-4 py-2 font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoiceLines.map((il) => (
                      <tr key={il.id} className="border-b border-brand-row-border last:border-0">
                        <td className="px-4 py-2">
                          {il.invoices ? (
                            <Link href={`/invoices/${il.invoices.id}`} className="text-teal hover:underline">
                              {il.invoices.invoice_number ?? "—"}
                            </Link>
                          ) : "—"}
                        </td>
                        <td className="px-4 py-2 text-cream-muted">{il.invoices?.vendor_name_raw ?? "—"}</td>
                        <td className="px-4 py-2 text-cream-muted">{il.invoices?.invoice_date ? formatDate(il.invoices.invoice_date) : "—"}</td>
                        <td className="px-4 py-2">
                          {il.invoices && (
                            <span className={`inline-block px-2 py-0.5 text-[11px] uppercase tracking-wider ${statusBadgeOutline(il.invoices.status)}`}>
                              {formatStatus(il.invoices.status)}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right text-cream tabular-nums">{formatCents(il.amount_cents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <aside className="space-y-4">
            <div className="bg-brand-card border border-brand-border p-4">
              <h3 className="text-sm font-medium text-cream uppercase tracking-wider mb-3">Actions</h3>
              <div className="flex flex-col gap-2">
                {po.status === "draft" && (
                  <button
                    disabled={busy}
                    onClick={() => updateStatus("issued")}
                    className="w-full px-3 py-2 text-sm border border-teal text-teal hover:bg-teal hover:text-white disabled:opacity-50 transition-colors"
                  >
                    {busy ? "…" : "Issue PO"}
                  </button>
                )}
                {(po.status === "issued" || po.status === "partially_invoiced" || po.status === "fully_invoiced") && (
                  <button
                    disabled={busy}
                    onClick={() => updateStatus("closed")}
                    className="w-full px-3 py-2 text-sm border border-brand-border text-cream-dim hover:text-cream disabled:opacity-50 transition-colors"
                  >
                    Close PO
                  </button>
                )}
                {po.status !== "void" && (
                  <button
                    disabled={busy}
                    onClick={() => {
                      const note = prompt(`Void ${po.po_number}? Enter reason:`);
                      if (!note) return;
                      updateStatus("void", note);
                    }}
                    className="w-full px-3 py-2 text-sm border border-status-danger/60 text-status-danger hover:bg-status-danger hover:text-white disabled:opacity-50 transition-colors"
                  >
                    Void PO
                  </button>
                )}
              </div>
            </div>

            {po.status_history && po.status_history.length > 0 && (
              <div className="bg-brand-card border border-brand-border p-4">
                <h3 className="text-sm font-medium text-cream uppercase tracking-wider mb-3">History</h3>
                <ul className="space-y-2 text-[11px] text-cream-dim">
                  {po.status_history.map((h, i) => (
                    <li key={i}>
                      <div>
                        <span className="text-cream">{h.old_status ? `${STATUS_LABELS[h.old_status] ?? h.old_status} → ` : ""}{STATUS_LABELS[h.new_status] ?? h.new_status}</span>
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
