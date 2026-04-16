"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import NavBar from "@/components/nav-bar";
import Breadcrumbs from "@/components/breadcrumbs";
import { supabase } from "@/lib/supabase/client";
import { formatCents, formatDate } from "@/lib/utils/format";
import EmptyState, { EmptyIcons } from "@/components/empty-state";
import { SkeletonList } from "@/components/loading-skeleton";

interface PurchaseOrder {
  id: string;
  po_number: string | null;
  description: string | null;
  amount: number;
  invoiced_total: number;
  status: string;
  issued_date: string | null;
  job_id: string;
  jobs: { id: string; name: string } | null;
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

const STATUSES = ["all", "draft", "issued", "partially_invoiced", "fully_invoiced", "closed", "void"] as const;
type StatusFilter = (typeof STATUSES)[number];

export default function AllPurchaseOrdersPage() {
  const router = useRouter();
  const [pos, setPos] = useState<PurchaseOrder[] | null>(null);
  const [jobFilter, setJobFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/login?redirect=/purchase-orders"); return; }

      const { data } = await supabase
        .from("purchase_orders")
        .select(
          `id, po_number, description, amount, invoiced_total, status, issued_date, job_id,
           jobs:job_id (id, name),
           vendors:vendor_id (id, name),
           budget_lines:budget_line_id ( cost_codes:cost_code_id ( code ) )`
        )
        .is("deleted_at", null)
        .order("issued_date", { ascending: false, nullsFirst: false });
      setPos((data ?? []) as unknown as PurchaseOrder[]);
    }
    load();
  }, [router]);

  const jobs = useMemo(() => {
    if (!pos) return [];
    const map = new Map<string, string>();
    for (const p of pos) if (p.jobs) map.set(p.jobs.id, p.jobs.name);
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [pos]);

  const filtered = useMemo(() => {
    if (!pos) return [];
    const needle = search.trim().toLowerCase();
    return pos.filter((p) => {
      if (jobFilter && p.job_id !== jobFilter) return false;
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (needle) {
        const hay = [
          p.po_number ?? "",
          p.description ?? "",
          p.vendors?.name ?? "",
          p.jobs?.name ?? "",
        ].join(" ").toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [pos, jobFilter, statusFilter, search]);

  const totals = useMemo(() => {
    const active = filtered.filter((p) => p.status !== "void");
    const openOrPartial = filtered.filter((p) => ["issued", "partially_invoiced"].includes(p.status));
    return {
      count: active.length,
      committed: filtered
        .filter((p) => ["issued", "partially_invoiced", "fully_invoiced"].includes(p.status))
        .reduce((s, p) => s + p.amount, 0),
      invoiced: filtered.reduce((s, p) => s + p.invoiced_total, 0),
      openRemaining: openOrPartial.reduce((s, p) => s + (p.amount - p.invoiced_total), 0),
    };
  }, [filtered]);

  return (
    <div className="min-h-screen">
      <NavBar />
      <main className="max-w-[1600px] mx-auto px-4 md:px-6 py-8">
        <Breadcrumbs items={[{ label: "Purchase Orders" }]} />
        <div className="flex items-start justify-between mb-4 flex-wrap gap-4">
          <div>
            <h2 className="font-display text-2xl text-cream">Purchase Orders</h2>
            <p className="text-sm text-cream-dim mt-1">
              Every PO across every job. Filter by job, status, or search by vendor / PO # / description.
            </p>
          </div>
        </div>

        {pos === null ? (
          <SkeletonList rows={8} columns={["w-20", "w-32", "w-32", "w-16", "w-40", "w-20", "w-20", "w-20", "w-20"]} />
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <Stat label="Total POs" value={String(totals.count)} />
              <Stat label="Committed" value={formatCents(totals.committed)} highlight />
              <Stat label="Invoiced" value={formatCents(totals.invoiced)} />
              <Stat label="Open Remaining" value={formatCents(totals.openRemaining)} />
            </div>

            <div className="flex flex-wrap items-center gap-3 mb-4">
              <input
                type="search"
                placeholder="Search PO #, vendor, description…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 min-w-[240px] px-3 py-2 bg-brand-surface border border-brand-border text-sm text-cream placeholder-cream-dim focus:border-teal focus:outline-none"
              />
              <select
                value={jobFilter}
                onChange={(e) => setJobFilter(e.target.value)}
                className="px-3 py-2 bg-brand-surface border border-brand-border text-sm text-cream focus:border-teal focus:outline-none"
              >
                <option value="">All Jobs</option>
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>{j.name}</option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="px-3 py-2 bg-brand-surface border border-brand-border text-sm text-cream focus:border-teal focus:outline-none"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s === "all" ? "All Statuses" : (STATUS_LABELS[s] ?? s)}
                  </option>
                ))}
              </select>
            </div>

            {filtered.length === 0 ? (
              <EmptyState
                icon={<EmptyIcons.Cart />}
                title={pos.length === 0 ? "No purchase orders yet" : "No POs match these filters"}
                message={
                  pos.length === 0
                    ? "POs are created per-job. Open a job's detail page and use its Purchase Orders tab to add one."
                    : "Try clearing filters or switching to a different job."
                }
              />
            ) : (
              <div className="bg-brand-card border border-brand-border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-brand-border text-[11px] uppercase tracking-wider text-cream-dim">
                      <th className="text-left px-4 py-3 font-medium">PO #</th>
                      <th className="text-left px-4 py-3 font-medium">Job</th>
                      <th className="text-left px-4 py-3 font-medium">Vendor</th>
                      <th className="text-left px-4 py-3 font-medium">Cost Code</th>
                      <th className="text-left px-4 py-3 font-medium">Description</th>
                      <th className="text-right px-4 py-3 font-medium">Amount</th>
                      <th className="text-right px-4 py-3 font-medium">Invoiced</th>
                      <th className="text-right px-4 py-3 font-medium">Remaining</th>
                      <th className="text-left px-4 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((po) => {
                      const remaining = po.amount - po.invoiced_total;
                      const over = remaining < 0;
                      return (
                        <tr key={po.id} className="border-b border-brand-row-border last:border-0 hover:bg-brand-surface/40">
                          <td className="px-4 py-3 font-mono text-cream">
                            <Link href={`/purchase-orders/${po.id}`} className="text-teal hover:underline">
                              {po.po_number ?? "—"}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-cream-muted">
                            {po.jobs ? (
                              <Link href={`/jobs/${po.jobs.id}/purchase-orders`} className="hover:text-teal hover:underline">
                                {po.jobs.name}
                              </Link>
                            ) : "—"}
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
                            {po.issued_date && (
                              <p className="text-[10px] text-cream-dim mt-0.5">Issued {formatDate(po.issued_date)}</p>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-brand-card border border-brand-border p-4">
      <p className="text-[11px] uppercase tracking-wider text-cream-dim font-medium">{label}</p>
      <p className={`text-2xl mt-1 font-display tabular-nums ${highlight ? "text-teal" : "text-cream"}`}>{value}</p>
    </div>
  );
}
