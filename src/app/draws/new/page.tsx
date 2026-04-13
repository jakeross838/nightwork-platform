"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import NavBar from "@/components/nav-bar";
import { supabase } from "@/lib/supabase/client";
import { formatCents } from "@/lib/utils/format";

interface Job { id: string; name: string; address: string | null; original_contract_amount: number; deposit_percentage: number; }
interface AvailableInvoice { id: string; vendor_name_raw: string | null; invoice_number: string | null; total_amount: number; cost_code_id: string | null; cost_codes: { code: string; description: string } | null; }

export default function NewDrawPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Step 1
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobId, setJobId] = useState("");
  const [appDate, setAppDate] = useState(new Date().toISOString().split("T")[0]);
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");

  // Step 2
  const [invoices, setInvoices] = useState<AvailableInvoice[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Step 3 — computed G702
  const [job, setJob] = useState<Job | null>(null);

  useEffect(() => {
    async function fetchJobs() {
      const { data } = await supabase.from("jobs").select("id, name, address, original_contract_amount, deposit_percentage").is("deleted_at", null).eq("status", "active").order("name");
      if (data) setJobs(data);
    }
    fetchJobs();
  }, []);

  // When job selected, fetch available invoices and budget total
  useEffect(() => {
    if (!jobId) return;
    async function fetchData() {
      const { data: invData } = await supabase
        .from("invoices")
        .select("id, vendor_name_raw, invoice_number, total_amount, cost_code_id, cost_codes:cost_code_id (code, description)")
        .eq("job_id", jobId).eq("status", "qa_approved").is("draw_id", null).is("deleted_at", null);
      if (invData) {
        const inv = invData as unknown as AvailableInvoice[];
        setInvoices(inv);
        setSelected(new Set(inv.map(i => i.id)));
      }
      const j = jobs.find(j => j.id === jobId);
      if (j) setJob(j);
    }
    fetchData();
  }, [jobId, jobs]);

  const toggleInvoice = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectedTotal = invoices.filter(i => selected.has(i.id)).reduce((s, i) => s + i.total_amount, 0);

  // G702 preview computations
  // G702 Line 1: from job record, not budget lines
  const originalContractSum = job?.original_contract_amount ?? 0;
  const netChangeOrders = 0; // TODO: sum from executed change_orders
  const contractSumToDate = originalContractSum + netChangeOrders;
  const totalCompletedToDate = selectedTotal; // first draw — no prior
  const lessPreviousPayments = 0; // first draw
  const currentPaymentDue = totalCompletedToDate - lessPreviousPayments;
  const balanceToFinish = contractSumToDate - totalCompletedToDate;
  const depositAmount = job ? Math.round(originalContractSum * job.deposit_percentage) : 0;

  const handleSave = async () => {
    setSaving(true);
    const res = await fetch("/api/draws/new", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        job_id: jobId,
        application_date: appDate,
        period_start: periodStart,
        period_end: periodEnd,
        invoice_ids: Array.from(selected),
      }),
    });
    if (res.ok) {
      const { id } = await res.json();
      router.push(`/draws/${id}`);
    }
    setSaving(false);
  };

  return (
    <div className="min-h-screen">
      <NavBar />
      <main className="max-w-5xl mx-auto px-6 py-8">
        <h2 className="font-display text-2xl text-cream mb-6">Create New Draw</h2>

        {/* Step indicators */}
        <div className="flex items-center gap-2 mb-8">
          {[1, 2, 3].map(s => (
            <button key={s} onClick={() => { if (s < step || (s === 2 && jobId) || (s === 3 && jobId)) setStep(s); }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                step === s ? "bg-teal text-brand-bg" : step > s ? "bg-brand-elevated text-cream" : "bg-brand-surface text-cream-dim"
              }`}>
              {s}. {s === 1 ? "Setup" : s === 2 ? "Select Invoices" : "Preview & Save"}
            </button>
          ))}
        </div>

        {/* Step 1: Setup */}
        {step === 1 && (
          <div className="space-y-6 opacity-0 animate-fade-up">
            <div className="bg-brand-card border border-brand-border rounded-2xl p-6 space-y-4">
              <div>
                <label className="text-[11px] font-medium text-cream-dim uppercase tracking-wider mb-1.5 block">Job</label>
                <select value={jobId} onChange={(e) => setJobId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-brand-surface border border-brand-border rounded-xl text-sm text-cream focus:border-teal focus:outline-none">
                  <option value="">Select a job...</option>
                  {jobs.map(j => <option key={j.id} value={j.id}>{j.name} — {j.address}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-[11px] font-medium text-cream-dim uppercase tracking-wider mb-1.5 block">Application Date</label>
                  <input type="date" value={appDate} onChange={(e) => setAppDate(e.target.value)}
                    className="w-full px-3 py-2.5 bg-brand-surface border border-brand-border rounded-xl text-sm text-cream focus:border-teal focus:outline-none" />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-cream-dim uppercase tracking-wider mb-1.5 block">Period Start</label>
                  <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)}
                    className="w-full px-3 py-2.5 bg-brand-surface border border-brand-border rounded-xl text-sm text-cream focus:border-teal focus:outline-none" />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-cream-dim uppercase tracking-wider mb-1.5 block">Period End</label>
                  <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)}
                    className="w-full px-3 py-2.5 bg-brand-surface border border-brand-border rounded-xl text-sm text-cream focus:border-teal focus:outline-none" />
                </div>
              </div>
            </div>
            <div className="flex justify-end">
              <button onClick={() => setStep(2)} disabled={!jobId || !periodStart || !periodEnd}
                className="px-6 py-2.5 bg-teal hover:bg-teal-hover disabled:opacity-50 text-brand-bg font-medium rounded-xl transition-colors">
                Next: Select Invoices
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Select Invoices */}
        {step === 2 && (
          <div className="space-y-6 opacity-0 animate-fade-up">
            {invoices.length === 0 ? (
              <div className="bg-brand-card border border-brand-border rounded-2xl p-8 text-center">
                <p className="text-cream text-lg font-display">No invoices available</p>
                <p className="text-cream-dim text-sm mt-1">No QA-approved invoices for this job without a draw assignment.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-brand-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-brand-surface text-left">
                      <th className="py-3 px-5 w-10">
                        <input type="checkbox" checked={selected.size === invoices.length}
                          onChange={() => setSelected(selected.size === invoices.length ? new Set() : new Set(invoices.map(i => i.id)))}
                          className="rounded" />
                      </th>
                      <th className="py-3 px-5 text-[11px] text-cream-dim font-medium uppercase tracking-wider">Vendor</th>
                      <th className="py-3 px-5 text-[11px] text-cream-dim font-medium uppercase tracking-wider">Invoice #</th>
                      <th className="py-3 px-5 text-[11px] text-cream-dim font-medium uppercase tracking-wider">Cost Code</th>
                      <th className="py-3 px-5 text-[11px] text-cream-dim font-medium uppercase tracking-wider text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv) => (
                      <tr key={inv.id} className="border-t border-brand-border/50 hover:bg-brand-elevated/50 cursor-pointer transition-colors"
                        onClick={() => toggleInvoice(inv.id)}>
                        <td className="py-3 px-5">
                          <input type="checkbox" checked={selected.has(inv.id)} onChange={() => toggleInvoice(inv.id)} className="rounded" />
                        </td>
                        <td className="py-3 px-5 text-cream">{inv.vendor_name_raw ?? "Unknown"}</td>
                        <td className="py-3 px-5 text-cream-muted font-mono text-xs">{inv.invoice_number ?? "—"}</td>
                        <td className="py-3 px-5 text-cream-muted text-xs">
                          {inv.cost_codes ? `${inv.cost_codes.code} — ${inv.cost_codes.description}` : "—"}
                        </td>
                        <td className="py-3 px-5 text-cream text-right font-display font-medium">{formatCents(inv.total_amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-brand-border bg-brand-surface">
                      <td colSpan={4} className="py-3 px-5 text-cream-dim text-sm font-medium">{selected.size} of {invoices.length} selected</td>
                      <td className="py-3 px-5 text-brass text-right font-display font-medium text-base">{formatCents(selectedTotal)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
            <div className="flex justify-between">
              <button onClick={() => setStep(1)} className="px-6 py-2.5 border border-brand-border text-cream-muted rounded-xl hover:border-brand-border-light transition-colors">
                Back
              </button>
              <button onClick={() => setStep(3)} disabled={selected.size === 0}
                className="px-6 py-2.5 bg-teal hover:bg-teal-hover disabled:opacity-50 text-brand-bg font-medium rounded-xl transition-colors">
                Next: Preview
              </button>
            </div>
          </div>
        )}

        {/* Step 3: G702 Preview */}
        {step === 3 && (
          <div className="space-y-6 opacity-0 animate-fade-up">
            <div className="bg-brand-card border border-brand-border rounded-2xl p-6">
              <p className="text-[11px] font-medium text-cream-dim uppercase tracking-wider mb-4 brass-underline">G702 Summary — Application for Payment</p>
              <div className="mt-5 space-y-3">
                <G702Line num="1" label="Original Contract Sum" value={originalContractSum} />
                <G702Line num="1a" label="Deposit" value={depositAmount} sub />
                <G702Line num="2" label="Net Change by Change Orders" value={netChangeOrders} />
                <G702Line num="3" label="Contract Sum to Date (1 + 2)" value={contractSumToDate} highlight />
                <div className="border-t border-brand-border my-2" />
                <G702Line num="4" label="Total Completed & Stored to Date" value={totalCompletedToDate} />
                <G702Line num="5" label="Less Previous Payments" value={lessPreviousPayments} />
                <G702Line num="6" label="Current Payment Due (4 - 5)" value={currentPaymentDue} highlight />
                <div className="border-t border-brand-border my-2" />
                <G702Line num="7" label="Balance to Finish (3 - 4)" value={balanceToFinish} />
              </div>
            </div>

            <div className="bg-brand-card border border-brand-border rounded-2xl p-6">
              <p className="text-[11px] font-medium text-cream-dim uppercase tracking-wider mb-2">Draw Details</p>
              <div className="grid grid-cols-3 gap-4 text-sm mt-3">
                <div><span className="text-cream-dim">Job:</span> <span className="text-cream ml-1">{job?.name}</span></div>
                <div><span className="text-cream-dim">Period:</span> <span className="text-cream ml-1">{periodStart} to {periodEnd}</span></div>
                <div><span className="text-cream-dim">Invoices:</span> <span className="text-cream ml-1">{selected.size} totaling {formatCents(selectedTotal)}</span></div>
              </div>
            </div>

            <div className="flex justify-between">
              <button onClick={() => setStep(2)} className="px-6 py-2.5 border border-brand-border text-cream-muted rounded-xl hover:border-brand-border-light transition-colors">
                Back
              </button>
              <button onClick={handleSave} disabled={saving}
                className="px-8 py-2.5 bg-teal hover:bg-teal-hover disabled:opacity-50 text-brand-bg font-medium rounded-xl transition-colors">
                {saving ? "Creating..." : "Save as Draft"}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function G702Line({ num, label, value, highlight, sub }: { num: string; label: string; value: number; highlight?: boolean; sub?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${sub ? "pl-6" : ""}`}>
      <div className="flex items-center gap-3">
        <span className="text-cream-dim text-xs font-mono w-6">{num}</span>
        <span className={`text-sm ${highlight ? "text-cream font-medium" : "text-cream-muted"}`}>{label}</span>
      </div>
      <span className={`font-display ${highlight ? "text-brass font-medium text-base" : "text-cream text-sm"}`}>
        {formatCents(value)}
      </span>
    </div>
  );
}
