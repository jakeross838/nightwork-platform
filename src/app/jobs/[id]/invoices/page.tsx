"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import JobTabs from "@/components/job-tabs";
import JobFinancialBar from "@/components/job-financial-bar";
import Breadcrumbs from "@/components/breadcrumbs";
import { supabase } from "@/lib/supabase/client";
import { formatCents, formatDate, formatStatus, statusBadgeOutline } from "@/lib/utils/format";

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
        <div className="w-8 h-8 border-2 border-stone-blue/30 border-t-teal animate-spin mx-auto" />
      </main>
    );
  }
  if (!job) {
    return (
      <main className="max-w-[1600px] mx-auto px-6 py-20 text-center">
        <p className="text-slate-tile">Job not found</p>
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
          <h2 className="font-display text-2xl text-slate-tile">{job.name}</h2>
          <p className="text-sm text-tertiary mt-1">{job.address ?? "No address"}</p>
        </div>
        <JobTabs jobId={job.id} active="invoices" />
        <JobFinancialBar jobId={job.id} />

        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <input
            type="text"
            placeholder="Search vendor or invoice number…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[200px] px-3 py-2 bg-bg-sub border border-border-def text-sm text-slate-tile focus:outline-none focus:border-stone-blue"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-bg-sub border border-border-def text-sm text-slate-tile focus:outline-none focus:border-stone-blue"
          >
            <option value="all">All statuses</option>
            {statuses.map((s) => (
              <option key={s} value={s}>{formatStatus(s)}</option>
            ))}
          </select>
          <p className="text-[11px] text-tertiary uppercase tracking-wider">
            {totals.count} · {formatCents(totals.sum)}
          </p>
        </div>

        {filtered.length === 0 ? (
          <div className="bg-white border border-border-def p-12 text-center">
            <p className="text-tertiary text-sm">No invoices match the current filters.</p>
          </div>
        ) : (
          <div className="bg-white border border-border-def overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-def text-[11px] uppercase tracking-wider text-tertiary bg-bg-sub/50">
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
                      className="border-b border-border-sub last:border-0 hover:bg-bg-sub/40 cursor-pointer"
                      onClick={() => router.push(`/invoices/${inv.id}`)}
                    >
                      <td className="px-3 py-2 text-secondary">{formatDate(inv.invoice_date)}</td>
                      <td className="px-3 py-2 text-slate-tile">
                        <span className="inline-flex items-center gap-1.5">
                          {vendor}
                          {inv.document_type === "receipt" && (
                            <span className="inline-flex items-center px-1 py-0.5 text-[9px] font-medium bg-transparent text-tertiary border border-cream-dim/40 uppercase tracking-wide">Receipt</span>
                          )}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-secondary font-mono text-xs">{inv.invoice_number ?? "—"}</td>
                      <td className="px-3 py-2 text-secondary text-xs">
                        {inv.cost_codes ? `${inv.cost_codes.code} ${inv.cost_codes.description}` : "—"}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-tile tabular-nums">{formatCents(inv.total_amount)}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-block px-2 py-0.5 text-[11px] uppercase tracking-wider border ${statusBadgeOutline(inv.status)}`}>
                          {formatStatus(inv.status)}
                        </span>
                        {inv.parent_invoice_id && (
                          <span className="ml-2 inline-block px-1.5 py-0.5 text-[10px] uppercase tracking-wider border border-nw-warn/50 text-nw-warn">
                            Partial
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

        <p className="mt-4 text-[11px] text-tertiary">
          <Link href={`/invoices?jobId=${job.id}`} className="text-stone-blue hover:underline">
            Open in All Invoices →
          </Link>
        </p>
      </main>
  );
}
