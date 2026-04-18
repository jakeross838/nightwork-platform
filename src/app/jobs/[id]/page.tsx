"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { formatDate } from "@/lib/utils/format";
import JobTabs from "@/components/job-tabs";
import JobFinancialBar from "@/components/job-financial-bar";
import JobOverviewCards from "@/components/job-overview-cards";
import Breadcrumbs from "@/components/breadcrumbs";

interface PmUser {
  id: string;
  full_name: string;
}

interface Job {
  id: string;
  name: string;
  address: string | null;
  client_name: string | null;
  client_email: string | null;
  client_phone: string | null;
  contract_type: "cost_plus" | "fixed";
  original_contract_amount: number;
  current_contract_amount: number;
  approved_cos_total: number | null;
  deposit_percentage: number;
  gc_fee_percentage: number;
  retainage_percent: number;
  starting_application_number?: number;
  previous_certificates_total?: number;
  previous_change_orders_total?: number;
  pm_id: string | null;
  contract_date: string | null;
  status: "active" | "complete" | "warranty" | "cancelled";
}

type ImportResult = {
  imported: {
    cost_code: string;
    description: string;
    amount: number;
    previous_applications_baseline?: number;
  }[];
  skipped: { row: number; reason: string; raw_code?: string }[];
  unmatched_codes: string[];
  total_rows: number;
  pay_app?: {
    detected: boolean;
    application_number?: number;
    original_contract_sum?: number;
    contract_sum_to_date?: number;
    total_completed_to_date?: number;
    change_orders_imported: number;
    change_orders_skipped: number;
    message: string;
  };
};

export default function JobDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(null);
  const [pms, setPms] = useState<PmUser[]>([]);
  const [budgetCount, setBudgetCount] = useState(0);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Job>>({});

  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const [financialBarPreloaded, setFinancialBarPreloaded] = useState<{
    original_contract: number;
    approved_cos: number;
    revised_contract: number;
    billed_to_date: number;
    percent_complete: number;
    remaining: number;
  } | null>(null);
  const [overviewPreloaded, setOverviewPreloaded] = useState<{
    budget_health: { total_lines: number; over_budget: number; under_committed: number };
    open_items: {
      pending_invoices_count: number;
      pending_invoices_total: number;
      draft_pos: number;
      pending_cos: number;
      pending_liens: number;
    };
    activity: Array<{
      id: string; created_at: string; entity_type: string; action: string;
      user_name: string | null; details: Record<string, unknown> | null;
    }>;
    payments: Array<{
      id: string; vendor_id: string | null; vendor_name: string | null;
      vendor_name_raw: string | null; total_amount: number; scheduled_payment_date: string | null;
    }>;
    billed_to_date: number;
  } | null>(null);

  const refreshBudgetCount = useCallback(async (jobId: string) => {
    const { count } = await supabase
      .from("budget_lines")
      .select("id", { count: "exact", head: true })
      .eq("job_id", jobId)
      .is("deleted_at", null);
    setBudgetCount(count ?? 0);
  }, []);

  useEffect(() => {
    async function load() {
      // Single batched endpoint replaces the previous auth+profile+job+users+
      // budget-count waterfall. Financial bar and overview cards now rehydrate
      // from the same response instead of each firing their own queries.
      const res = await fetch(`/api/jobs/${params.id}/overview`, { cache: "no-store" });
      if (res.status === 401) {
        router.replace(`/login?redirect=/jobs/${params.id}`);
        return;
      }
      if (res.status === 404) {
        setLoading(false);
        return;
      }
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const data = await res.json() as {
        membership_role: string;
        job: Job;
        pms: PmUser[];
        financial_bar: NonNullable<typeof financialBarPreloaded>;
        overview_cards: {
          budget_health: { total_lines: number; over_budget: number; under_committed: number };
          open_items: {
            pending_invoices_count: number;
            pending_invoices_total: number;
            draft_pos: number;
            pending_cos: number;
            pending_liens: number;
          };
          activity: Array<{
            id: string; created_at: string; entity_type: string; action: string;
            user_name: string | null; details: Record<string, unknown> | null;
          }>;
          payments: Array<{
            id: string; vendor_id: string | null; vendor_name: string | null;
            vendor_name_raw: string | null; total_amount: number; scheduled_payment_date: string | null;
          }>;
        };
        budget_count: number;
      };

      if (data.membership_role !== "admin" && data.membership_role !== "owner") {
        setAuthorized(false);
        setLoading(false);
        return;
      }
      setAuthorized(true);
      setJob(data.job);
      setForm(data.job);
      setPms(data.pms);
      setBudgetCount(data.budget_count);
      setFinancialBarPreloaded(data.financial_bar);
      setOverviewPreloaded({
        ...data.overview_cards,
        billed_to_date: data.financial_bar.billed_to_date,
      });
      setLoading(false);
    }
    load();
  }, [params.id, router]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!job) return;
    setFormError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/jobs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: job.id, ...form }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      const { data: refreshed } = await supabase.from("jobs").select("*").eq("id", job.id).single();
      if (refreshed) { setJob(refreshed as Job); setForm(refreshed as Job); }
      setEditing(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !job) return;
    setImporting(true);
    setImportError(null);
    setImportResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/jobs/${job.id}/budget-import`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setImportResult(data as ImportResult);
      await refreshBudgetCount(job.id);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  if (authorized === false) {
    return (
      <main className="max-w-[1600px] mx-auto px-6 py-16 text-center">
        <h2 className="font-display text-2xl text-slate-tile">Access denied</h2>
        <p className="mt-2 text-sm text-[rgba(59,88,100,0.55)]">Jobs management is restricted to administrators.</p>
      </main>
    );
  }
  if (loading) {
    return (
      <main className="max-w-[1600px] mx-auto px-6 py-20 text-center">
        <div className="w-8 h-8 border-2 border-stone-blue/30 border-t-teal animate-spin mx-auto" />
      </main>
    );
  }
  if (!job) {
    return (
      <main className="max-w-[1600px] mx-auto px-6 py-16 text-center">
        <h2 className="font-display text-2xl text-slate-tile">Job not found</h2>
        <Link href="/jobs" className="inline-block mt-4 text-sm text-stone-blue hover:underline">Back to jobs</Link>
      </main>
    );
  }

  return (
    <>
      <main className="max-w-[1600px] mx-auto px-4 md:px-6 py-8">
        <Breadcrumbs items={[{ label: "Jobs", href: "/jobs" }, { label: job.name }]} />
        <div className="flex items-start justify-between mb-4 flex-wrap gap-4">
          <div>
            <h2 className="font-display text-2xl text-slate-tile">{job.name}</h2>
            <p className="text-sm text-[rgba(59,88,100,0.55)] mt-1">
              {job.address ?? "No address"} · {job.contract_type === "cost_plus" ? "Cost Plus" : "Fixed Price"}
            </p>
          </div>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="px-4 py-2 border border-stone-blue text-stone-blue hover:bg-stone-blue hover:text-white text-sm font-medium transition-colors"
            >
              Edit
            </button>
          )}
        </div>
        <JobTabs jobId={job.id} active="overview" />
        <JobFinancialBar jobId={job.id} preloaded={financialBarPreloaded} />

        {!editing ? (
          <>
            <JobOverviewCards
              jobId={job.id}
              originalContract={job.original_contract_amount}
              revisedContract={job.current_contract_amount}
              approvedCosTotal={job.approved_cos_total ?? 0}
              previousCertificatesTotal={job.previous_certificates_total ?? 0}
              preloaded={overviewPreloaded}
            />

            <section className="bg-white border border-[rgba(59,88,100,0.15)] p-6 mt-4">
              <h3 className="font-display text-base text-slate-tile mb-3">Job Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                <Detail label="Client Name" value={job.client_name} />
                <Detail label="Client Email" value={job.client_email} />
                <Detail label="Client Phone" value={job.client_phone} />
                <Detail label="Contract Date" value={formatDate(job.contract_date)} />
                <Detail label="Contract Type" value={job.contract_type === "cost_plus" ? "Cost Plus" : "Fixed Price"} />
                <Detail label="Deposit %" value={`${job.deposit_percentage.toFixed(1)}%`} />
                <Detail label="GC Fee %" value={`${job.gc_fee_percentage.toFixed(1)}%`} />
                <Detail
                  label="Retainage %"
                  value={`${Number(job.retainage_percent ?? 0).toFixed(1)}%`}
                />
                <Detail label="Assigned PM" value={pms.find((p) => p.id === job.pm_id)?.full_name ?? "Unassigned"} />
                <Detail label="Status" value={job.status} />
              </div>
            </section>
          </>
        ) : (
          <form onSubmit={handleSave} className="bg-white border border-[rgba(59,88,100,0.15)] p-6 mb-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <EditField label="Name">
                <input className="input" value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </EditField>
              <EditField label="Address">
                <input className="input" value={form.address ?? ""} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </EditField>
              <EditField label="Client Name">
                <input className="input" value={form.client_name ?? ""} onChange={(e) => setForm({ ...form, client_name: e.target.value })} />
              </EditField>
              <EditField label="Client Email">
                <input type="email" className="input" value={form.client_email ?? ""} onChange={(e) => setForm({ ...form, client_email: e.target.value })} />
              </EditField>
              <EditField label="Client Phone">
                <input className="input" value={form.client_phone ?? ""} onChange={(e) => setForm({ ...form, client_phone: e.target.value })} />
              </EditField>
              <EditField label="Contract Date">
                <input type="date" className="input" value={form.contract_date ?? ""} onChange={(e) => setForm({ ...form, contract_date: e.target.value || null })} />
              </EditField>
              <EditField label="Contract Type">
                <select className="input" value={form.contract_type ?? "cost_plus"} onChange={(e) => setForm({ ...form, contract_type: e.target.value as Job["contract_type"] })}>
                  <option value="cost_plus">Cost Plus</option>
                  <option value="fixed">Fixed</option>
                </select>
              </EditField>
              <EditField label="Status">
                <select className="input" value={form.status ?? "active"} onChange={(e) => setForm({ ...form, status: e.target.value as Job["status"] })}>
                  <option value="active">Active</option>
                  <option value="complete">Complete</option>
                  <option value="warranty">Warranty</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </EditField>
              <EditField label="Original Contract (cents)">
                <input type="number" className="input" value={form.original_contract_amount ?? 0} onChange={(e) => setForm({ ...form, original_contract_amount: Number(e.target.value) })} />
              </EditField>
              <EditField label="Current Contract (cents)">
                <input type="number" className="input" value={form.current_contract_amount ?? 0} onChange={(e) => setForm({ ...form, current_contract_amount: Number(e.target.value) })} />
              </EditField>
              <EditField label="Deposit % (0–100)">
                <input type="number" step="0.5" min={0} max={100} className="input" value={form.deposit_percentage ?? 10} onChange={(e) => setForm({ ...form, deposit_percentage: Number(e.target.value) })} />
              </EditField>
              <EditField label="GC Fee % (0–100)">
                <input type="number" step="0.5" min={0} max={100} className="input" value={form.gc_fee_percentage ?? 20} onChange={(e) => setForm({ ...form, gc_fee_percentage: Number(e.target.value) })} />
              </EditField>
              <EditField label="Retainage % (0–100)">
                <input
                  type="number"
                  step="0.5"
                  min={0}
                  max={100}
                  className="input"
                  value={form.retainage_percent ?? 0}
                  onChange={(e) => setForm({ ...form, retainage_percent: Number(e.target.value) })}
                />
              </EditField>
              <EditField label="Starting Application Number">
                <input
                  type="number"
                  step={1}
                  min={1}
                  className="input"
                  value={form.starting_application_number ?? 1}
                  onChange={(e) =>
                    setForm({ ...form, starting_application_number: Number(e.target.value) })
                  }
                />
                <p className="text-[11px] text-[rgba(59,88,100,0.55)] mt-1">
                  For jobs that started before Nightwork. Set this to the AIA pay app number of
                  the first draw Nightwork will generate (e.g. 11 if the last manual draw was #10).
                </p>
              </EditField>
              <EditField label="Previous Certificates Total ($)">
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  className="input"
                  value={((form.previous_certificates_total ?? 0) / 100).toFixed(2)}
                  onChange={(e) =>
                    setForm({ ...form, previous_certificates_total: Math.round((parseFloat(e.target.value) || 0) * 100) })
                  }
                />
                <p className="text-[11px] text-[rgba(59,88,100,0.55)] mt-1">
                  Total certified payments from draws completed before Nightwork. Feeds G702 Line 6.
                </p>
              </EditField>
              <EditField label="Previous Change Orders Total ($)">
                <input
                  type="number"
                  step="0.01"
                  className="input"
                  value={((form.previous_change_orders_total ?? 0) / 100).toFixed(2)}
                  onChange={(e) =>
                    setForm({ ...form, previous_change_orders_total: Math.round((parseFloat(e.target.value) || 0) * 100) })
                  }
                />
                <p className="text-[11px] text-[rgba(59,88,100,0.55)] mt-1">
                  Net change order total (including GC fees) from before Nightwork. Feeds G702 Line 2.
                </p>
              </EditField>
              <EditField label="Assigned PM" full>
                <select className="input" value={form.pm_id ?? ""} onChange={(e) => setForm({ ...form, pm_id: e.target.value || null })}>
                  <option value="">— Unassigned —</option>
                  {pms.map((p) => (
                    <option key={p.id} value={p.id}>{p.full_name}</option>
                  ))}
                </select>
              </EditField>
            </div>
            {formError && (
              <div className="border border-nw-danger/40 bg-nw-danger/5 px-4 py-2 text-sm text-nw-danger">{formError}</div>
            )}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[rgba(59,88,100,0.15)]">
              <button
                type="button"
                onClick={() => { setEditing(false); setForm(job); setFormError(null); }}
                className="px-4 py-2 text-sm text-[rgba(59,88,100,0.55)] hover:text-slate-tile transition-colors"
              >
                Cancel
              </button>
              <button type="submit" disabled={saving} className="px-5 py-2 bg-slate-deep hover:bg-slate-deeper disabled:opacity-60 text-white text-sm font-medium transition-colors">
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </form>
        )}

        {/* Quick budget status / import */}
        <section className="bg-white border border-[rgba(59,88,100,0.15)] p-6 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="font-display text-lg text-slate-tile">Budget</h3>
              <p className="text-sm text-[rgba(59,88,100,0.55)] mt-1">
                {budgetCount === 0 ? "No budget lines yet" : `${budgetCount} lines imported`}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href={`/jobs/${job.id}/budget`}
                className="inline-flex items-center gap-1.5 px-4 py-2 border border-stone-blue text-stone-blue hover:bg-stone-blue hover:text-white text-sm font-medium transition-colors"
              >
                View Full Budget →
              </Link>
              <input ref={fileRef} type="file" accept=".xlsx,.xlsm,.csv" onChange={handleImport} className="hidden" />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={importing}
                className="inline-flex items-center gap-1.5 px-4 py-2 border border-[rgba(59,88,100,0.15)] text-slate-tile hover:bg-[rgba(91,134,153,0.06)] disabled:opacity-60 text-sm font-medium transition-colors"
              >
                {importing ? "Importing…" : "Import Budget (.xlsx / .csv)"}
              </button>
            </div>
          </div>
          {importError && (
            <div className="mt-3 border border-nw-danger/40 bg-nw-danger/5 px-4 py-3 text-sm text-nw-danger">
              <p className="font-medium">Import failed</p>
              <p className="mt-1">{importError}</p>
            </div>
          )}
          {importResult && (
            <div className="mt-3 border border-stone-blue/40 bg-slate-deep/5 px-4 py-3 text-sm text-slate-tile">
              <p className="font-medium text-stone-blue">
                {importResult.pay_app?.detected ? "Pay app import complete" : "Import complete"}
              </p>
              <p className="mt-1">
                {importResult.pay_app?.detected
                  ? importResult.pay_app.message
                  : `${importResult.imported.length} lines imported · ${importResult.skipped.length} skipped`}
                {importResult.unmatched_codes.length > 0 &&
                  ` · ${importResult.unmatched_codes.length} unmatched codes`}
              </p>
              {importResult.pay_app?.detected && (
                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-[rgba(59,88,100,0.55)]">
                  {importResult.pay_app.application_number != null && (
                    <div>Application #: <span className="text-slate-tile">{importResult.pay_app.application_number}</span></div>
                  )}
                  {importResult.pay_app.original_contract_sum != null && (
                    <div>Original contract: <span className="text-slate-tile">${importResult.pay_app.original_contract_sum.toLocaleString()}</span></div>
                  )}
                  {importResult.pay_app.contract_sum_to_date != null && (
                    <div>Contract sum to date: <span className="text-slate-tile">${importResult.pay_app.contract_sum_to_date.toLocaleString()}</span></div>
                  )}
                  {importResult.pay_app.total_completed_to_date != null && (
                    <div>Total completed: <span className="text-slate-tile">${importResult.pay_app.total_completed_to_date.toLocaleString()}</span></div>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      </main>

      <style jsx>{`
        .input {
          width: 100%;
          padding: 0.5rem 0.75rem;
          background: var(--bg-subtle, #F5F5F5);
          border: 1px solid var(--border-default, #E8E8E8);
          color: var(--text-primary);
          font-size: 14px;
        }
        .input:focus { outline: none; border-color: var(--org-primary); }
      `}</style>
    </>
  );
}

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-[11px] font-medium text-[rgba(59,88,100,0.55)] uppercase tracking-wider">{label}</p>
      <p className="text-sm text-slate-tile mt-0.5">{value ?? "—"}</p>
    </div>
  );
}

function EditField({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label className={`flex flex-col gap-1 ${full ? "md:col-span-2" : ""}`}>
      <span className="text-[11px] font-medium text-[rgba(59,88,100,0.55)] uppercase tracking-wider">{label}</span>
      {children}
    </label>
  );
}
