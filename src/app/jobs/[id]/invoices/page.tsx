"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import JobTabs from "@/components/job-tabs";
import JobFinancialBar from "@/components/job-financial-bar";
import Breadcrumbs from "@/components/breadcrumbs";
import { supabase } from "@/lib/supabase/client";
import { formatCents, formatDate, formatStatus } from "@/lib/utils/format";
import NwBadge, { type BadgeVariant } from "@/components/nw/Badge";
import NwMoney from "@/components/nw/Money";

function invoiceBadgeVariant(status: string): BadgeVariant {
  if (["pm_approved", "qa_approved", "pushed_to_qb", "in_draw", "paid", "approved", "complete"].includes(status)) return "success";
  if (["pm_review", "qa_review", "ai_processed", "received", "info_requested", "pm_held", "pending", "in_review", "submitted", "on_hold"].includes(status)) return "warning";
  if (["qa_kicked_back", "pm_denied", "void", "qb_failed", "denied", "rejected", "cancelled"].includes(status)) return "danger";
  return "neutral";
}

interface Job { id: string; name: string; address: string | null; }

interface InvoiceRow {
  id: string;
  invoice_number: string | null;
  invoice_date: string | null;
  total_amount: number;
  status: string;
  parent_invoice_id: string | null;
  document_type: string | null;
  vendor_name_raw: string | null;
  vendors: { name: string } | null;
  cost_codes: { code: string; description: string } | null;
}

export default function JobInvoicesPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(null);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace(`/login?redirect=/jobs/${params.id}/invoices`); return; }

      const { data: j } = await supabase
        .from("jobs").select("id, name, address")
        .eq("id", params.id).is("deleted_at", null).single();
      if (j) setJob(j as Job);

      // Try with parent_invoice_id first; fall back without it if the column
      // doesn't exist yet (migration 00015 may not be applied).
      const withParent = await supabase
        .from("invoices")
        .select(`
          id, invoice_number, invoice_date, total_amount, status, parent_invoice_id, document_type,
          vendor_name_raw,
          vendors:vendor_id(name),
          cost_codes:cost_code_id(code, description)
        `)
        .eq("job_id", params.id)
        .is("deleted_at", null)
        .order("invoice_date", { ascending: false });
      let invQuery: { data: unknown; error: { message: string } | null } = withParent;
      if (withParent.error && /parent_invoice_id/i.test(withParent.error.message)) {
        const fallback = await supabase
          .from("invoices")
          .select(`
            id, invoice_number, invoice_date, total_amount, status, document_type,
            vendor_name_raw,
            vendors:vendor_id(name),
            cost_codes:cost_code_id(code, description)
          `)
          .eq("job_id", params.id)
          .is("deleted_at", null)
          .order("invoice_date", { ascending: false });
        invQuery = fallback;
      }
      if (invQuery.error) console.warn("invoice fetch:", invQuery.error.message);
      const rows = Array.isArray(invQuery.data) ? invQuery.data : [];
      const normalized: InvoiceRow[] = rows.map((r) => {
        const row = r as Record<string, unknown>;
        const vendors = Array.isArray(row.vendors) ? (row.vendors[0] ?? null) : (row.vendors ?? null);
        const costCodes = Array.isArray(row.cost_codes) ? (row.cost_codes[0] ?? null) : (row.cost_codes ?? null);
        return {
          id: String(row.id),
          invoice_number: (row.invoice_number as string | null) ?? null,
          invoice_date: (row.invoice_date as string | null) ?? null,
          total_amount: Number(row.total_amount ?? 0),
          status: String(row.status ?? ""),
          parent_invoice_id: (row.parent_invoice_id as string | null) ?? null,
          document_type: (row.document_type as string | null) ?? null,
          vendor_name_raw: (row.vendor_name_raw as string | null) ?? null,
          vendors: vendors as { name: string } | null,
          cost_codes: costCodes as { code: string; description: string } | null,
        };
      });
      setInvoices(normalized);
      setLoading(false);
    }
    load();
  }, [params.id, router]);

  const filtered = useMemo(() => {
    return invoices.filter((inv) => {
      if (statusFilter !== "all" && inv.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const vendor = (inv.vendors?.name ?? inv.vendor_name_raw ?? "").toLowerCase();
        const num = (inv.invoice_number ?? "").toLowerCase();
        if (!vendor.includes(q) && !num.includes(q)) return false;
      }
      return true;
    });
  }, [invoices, statusFilter, search]);

  const statuses = useMemo(() => {
    const set = new Set(invoices.map((i) => i.status));
    return Array.from(set).sort();
  }, [invoices]);

  const totals = useMemo(() => ({
    count: filtered.length,
    sum: filtered.reduce((s, i) => s + (i.total_amount ?? 0), 0),
  }), [filtered]);

  if (loading) {
    return (
      <main className="max-w-[1600px] mx-auto px-6 py-20 text-center">
        <div className="w-8 h-8 border-2 border-[rgba(91,134,153,0.3)] border-t-[var(--nw-stone-blue)] animate-spin mx-auto" />
      </main>
    );
  }
  if (!job) {
    return (
      <main className="max-w-[1600px] mx-auto px-6 py-20 text-center">
        <p className="text-[color:var(--text-primary)]">Job not found</p>
      </main>
    );
  }

  return (
      <main className="max-w-[1600px] mx-auto px-4 md:px-6 py-8">
        <Breadcrumbs
          items={[
            { label: "Jobs", href: "/jobs" },
            { label: job.name, href: `/jobs/${job.id}` },
            { label: "Invoices" },
          ]}
        />
        <div className="mb-4">
          <span
            className="block mb-2 text-[10px] uppercase"
            style={{
              fontFamily: "var(--font-jetbrains-mono)",
              letterSpacing: "0.14em",
              color: "var(--text-tertiary)",
            }}
          >
            Job · Invoices
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
        <JobTabs jobId={job.id} active="invoices" />
        <JobFinancialBar jobId={job.id} />

        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <input
            type="text"
            placeholder="Search vendor or invoice number…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[200px] px-3 py-2 bg-[var(--bg-subtle)] border border-[var(--border-default)] text-sm text-[color:var(--text-primary)] focus:outline-none focus:border-[var(--nw-stone-blue)]"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-[var(--bg-subtle)] border border-[var(--border-default)] text-sm text-[color:var(--text-primary)] focus:outline-none focus:border-[var(--nw-stone-blue)]"
          >
            <option value="all">All statuses</option>
            {statuses.map((s) => (
              <option key={s} value={s}>{formatStatus(s)}</option>
            ))}
          </select>
          <p className="text-[11px] text-[color:var(--text-secondary)] uppercase tracking-wider">
            {totals.count} · {formatCents(totals.sum)}
          </p>
        </div>

        {filtered.length === 0 ? (
          <div className="bg-[var(--bg-card)] border border-[var(--border-default)] p-12 text-center">
            <p className="text-[color:var(--text-secondary)] text-sm">No invoices match the current filters.</p>
          </div>
        ) : (
          <div className="bg-[var(--bg-card)] border border-[var(--border-default)] overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-default)] text-[10px] uppercase tracking-[0.14em] text-[color:var(--text-secondary)] font-medium bg-[rgba(91,134,153,0.04)]">
                  <th className="text-left px-3 py-3 font-medium">Date</th>
                  <th className="text-left px-3 py-3 font-medium">Vendor</th>
                  <th className="text-left px-3 py-3 font-medium">Inv #</th>
                  <th className="text-left px-3 py-3 font-medium">Cost Code</th>
                  <th className="text-right px-3 py-3 font-medium">Amount</th>
                  <th className="text-left px-3 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv) => {
                  const vendor = inv.vendors?.name ?? inv.vendor_name_raw ?? "—";
                  return (
                    <tr
                      key={inv.id}
                      className="border-b border-[var(--border-default)] last:border-0 hover:bg-[rgba(91,134,153,0.06)] cursor-pointer"
                      onClick={() => router.push(`/invoices/${inv.id}`)}
                    >
                      <td className="px-3 py-2 text-[color:var(--text-muted)]">{formatDate(inv.invoice_date)}</td>
                      <td className="px-3 py-2 text-[color:var(--text-primary)]">
                        <span className="inline-flex items-center gap-1.5">
                          {vendor}
                          {inv.document_type === "receipt" && (
                            <NwBadge variant="info" size="sm">Receipt</NwBadge>
                          )}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-[color:var(--text-muted)] font-mono text-xs">{inv.invoice_number ?? "—"}</td>
                      <td className="px-3 py-2 text-[color:var(--text-muted)] text-xs">
                        {inv.cost_codes ? `${inv.cost_codes.code} ${inv.cost_codes.description}` : "—"}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <NwMoney cents={inv.total_amount} />
                      </td>
                      <td className="px-3 py-2">
                        <NwBadge variant={invoiceBadgeVariant(inv.status)} size="sm">
                          {formatStatus(inv.status)}
                        </NwBadge>
                        {inv.parent_invoice_id && (
                          <span className="ml-2">
                            <NwBadge variant="warning" size="sm">Partial</NwBadge>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-4 text-[11px] text-[color:var(--text-secondary)]">
          <Link href={`/invoices?jobId=${job.id}`} className="text-[color:var(--nw-stone-blue)] hover:underline">
            Open in All Invoices →
          </Link>
        </p>
      </main>
  );
}
