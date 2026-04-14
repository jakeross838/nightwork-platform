"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { formatCents, formatDate } from "@/lib/utils/format";
import NavBar from "@/components/nav-bar";
import JobTabs from "@/components/job-tabs";
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
  deposit_percentage: number;
  gc_fee_percentage: number;
  pm_id: string | null;
  contract_date: string | null;
  status: "active" | "complete" | "warranty" | "cancelled";
}

type ImportResult = {
  imported: { cost_code: string; description: string; amount: number }[];
  skipped: { row: number; reason: string; raw_code?: string }[];
  unmatched_codes: string[];
  total_rows: number;
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace(`/login?redirect=/jobs/${params.id}`); return; }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      if (profile?.role !== "admin") {
        setAuthorized(false);
        setLoading(false);
        return;
      }
      setAuthorized(true);

      const [jobResult, pmResult] = await Promise.all([
        supabase.from("jobs").select("*").eq("id", params.id).is("deleted_at", null).single(),
        supabase.from("users").select("id, full_name").in("role", ["pm", "admin"]).is("deleted_at", null).order("full_name"),
      ]);

      if (jobResult.error || !jobResult.data) { setLoading(false); return; }
      setJob(jobResult.data as Job);
      setForm(jobResult.data as Job);
      if (pmResult.data) setPms(pmResult.data as PmUser[]);
      await refreshBudgetCount(params.id);
      setLoading(false);
    }
    load();
  }, [params.id, router, refreshBudgetCount]);

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
      <div className="min-h-screen">
        <NavBar />
        <main className="max-w-[1600px] mx-auto px-6 py-16 text-center">
          <h2 className="font-display text-2xl text-cream">Access denied</h2>
          <p className="mt-2 text-sm text-cream-dim">Jobs management is restricted to administrators.</p>
        </main>
      </div>
    );
  }
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
        <main className="max-w-[1600px] mx-auto px-6 py-16 text-center">
          <h2 className="font-display text-2xl text-cream">Job not found</h2>
          <Link href="/jobs" className="inline-block mt-4 text-sm text-teal hover:underline">Back to jobs</Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <NavBar />
      <main className="max-w-[1600px] mx-auto px-4 md:px-6 py-8">
        <Breadcrumbs items={[{ label: "Jobs", href: "/jobs" }, { label: job.name }]} />
        <div className="flex items-start justify-between mb-4 flex-wrap gap-4">
          <div>
            <h2 className="font-display text-2xl text-cream">{job.name}</h2>
            <p className="text-sm text-cream-dim mt-1">
              {job.address ?? "No address"} · {job.contract_type === "cost_plus" ? "Cost Plus" : "Fixed Price"}
            </p>
          </div>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="px-4 py-2 border border-teal text-teal hover:bg-teal hover:text-white text-sm font-medium transition-colors"
            >
              Edit
            </button>
          )}
        </div>
        <JobTabs jobId={job.id} active="overview" />

        {!editing ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 bg-brand-card border border-brand-border p-6 mb-6">
            <Detail label="Client Name" value={job.client_name} />
            <Detail label="Client Email" value={job.client_email} />
            <Detail label="Client Phone" value={job.client_phone} />
            <Detail label="Contract Date" value={formatDate(job.contract_date)} />
            <Detail label="Original Contract" value={formatCents(job.original_contract_amount)} />
            <Detail label="Current Contract" value={formatCents(job.current_contract_amount)} />
            <Detail label="Deposit %" value={`${(job.deposit_percentage * 100).toFixed(1)}%`} />
            <Detail label="GC Fee %" value={`${(job.gc_fee_percentage * 100).toFixed(1)}%`} />
            <Detail label="Assigned PM" value={pms.find((p) => p.id === job.pm_id)?.full_name ?? "Unassigned"} />
            <Detail label="Status" value={job.status} />
          </div>
        ) : (
          <form onSubmit={handleSave} className="bg-brand-card border border-brand-border p-6 mb-6 space-y-4">
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
              <EditField label="Deposit (0–1)">
                <input type="number" step="0.01" className="input" value={form.deposit_percentage ?? 0.1} onChange={(e) => setForm({ ...form, deposit_percentage: Number(e.target.value) })} />
              </EditField>
              <EditField label="GC Fee (0–1)">
                <input type="number" step="0.01" className="input" value={form.gc_fee_percentage ?? 0.2} onChange={(e) => setForm({ ...form, gc_fee_percentage: Number(e.target.value) })} />
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
              <div className="border border-status-danger/40 bg-status-danger/5 px-4 py-2 text-sm text-status-danger">{formError}</div>
            )}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-brand-border">
              <button
                type="button"
                onClick={() => { setEditing(false); setForm(job); setFormError(null); }}
                className="px-4 py-2 text-sm text-cream-dim hover:text-cream transition-colors"
              >
                Cancel
              </button>
              <button type="submit" disabled={saving} className="px-5 py-2 bg-teal hover:bg-teal-hover disabled:opacity-60 text-white text-sm font-medium transition-colors">
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </form>
        )}

        {/* Quick budget status / import */}
        <section className="bg-brand-card border border-brand-border p-6 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="font-display text-lg text-cream">Budget</h3>
              <p className="text-sm text-cream-dim mt-1">
                {budgetCount === 0 ? "No budget lines yet" : `${budgetCount} lines imported`}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href={`/jobs/${job.id}/budget`}
                className="inline-flex items-center gap-1.5 px-4 py-2 border border-teal text-teal hover:bg-teal hover:text-white text-sm font-medium transition-colors"
              >
                View Full Budget →
              </Link>
              <input ref={fileRef} type="file" accept=".xlsx,.xlsm" onChange={handleImport} className="hidden" />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={importing}
                className="inline-flex items-center gap-1.5 px-4 py-2 border border-brand-border text-cream hover:bg-brand-surface disabled:opacity-60 text-sm font-medium transition-colors"
              >
                {importing ? "Importing…" : "Import Budget (.xlsx)"}
              </button>
            </div>
          </div>
          {importError && (
            <div className="mt-3 border border-status-danger/40 bg-status-danger/5 px-4 py-3 text-sm text-status-danger">
              <p className="font-medium">Import failed</p>
              <p className="mt-1">{importError}</p>
            </div>
          )}
          {importResult && (
            <div className="mt-3 border border-teal/40 bg-teal/5 px-4 py-3 text-sm text-cream">
              <p className="font-medium text-teal">Import complete</p>
              <p className="mt-1">
                {importResult.imported.length} lines imported · {importResult.skipped.length} skipped
                {importResult.unmatched_codes.length > 0 && ` · ${importResult.unmatched_codes.length} unmatched codes`}
              </p>
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
        .input:focus { outline: none; border-color: var(--color-teal, #3F5862); }
      `}</style>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-[11px] font-medium text-cream-dim uppercase tracking-wider">{label}</p>
      <p className="text-sm text-cream mt-0.5">{value ?? "—"}</p>
    </div>
  );
}

function EditField({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label className={`flex flex-col gap-1 ${full ? "md:col-span-2" : ""}`}>
      <span className="text-[11px] font-medium text-cream-dim uppercase tracking-wider">{label}</span>
      {children}
    </label>
  );
}
