"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import NavBar from "@/components/nav-bar";
import { supabase } from "@/lib/supabase/client";
import { formatCents, formatDate } from "@/lib/utils/format";

interface Job {
  id: string;
  name: string;
  address: string | null;
  original_contract_amount: number;
  deposit_percentage: number;
  retainage_percent: number;
}
interface AvailableInvoice {
  id: string;
  vendor_name_raw: string | null;
  invoice_number: string | null;
  total_amount: number;
  received_date: string | null;
  cost_code_id: string | null;
  cost_codes: { code: string; description: string } | null;
}
interface PriorDraw {
  id: string;
  draw_number: number;
  status: string;
  period_end: string | null;
  current_payment_due: number;
  revision_number: number;
}

export default function NewDrawPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobId, setJobId] = useState("");
  const [appDate, setAppDate] = useState(new Date().toISOString().split("T")[0]);
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [isFinal, setIsFinal] = useState(false);

  // Prior context
  const [priorDraws, setPriorDraws] = useState<PriorDraw[]>([]);

  // Step 2
  const [invoices, setInvoices] = useState<AvailableInvoice[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Step 3 — computed G702
  const [job, setJob] = useState<Job | null>(null);

  useEffect(() => {
    async function fetchJobs() {
      const { data } = await supabase
        .from("jobs")
        .select("id, name, address, original_contract_amount, deposit_percentage, retainage_percent")
        .is("deleted_at", null)
        .eq("status", "active")
        .order("name");
      if (data) setJobs(data as Job[]);
    }
    fetchJobs();
  }, []);

  // Load prior-draw context and period defaults when a job is selected.
  useEffect(() => {
    if (!jobId) {
      setPriorDraws([]);
      return;
    }
    async function fetchContext() {
      const j = jobs.find((x) => x.id === jobId);
      if (j) setJob(j);

      const { data: priors } = await supabase
        .from("draws")
        .select("id, draw_number, status, period_end, current_payment_due, revision_number")
        .eq("job_id", jobId)
        .is("deleted_at", null)
        .order("draw_number", { ascending: false });
      const priorList = (priors ?? []) as PriorDraw[];
      setPriorDraws(priorList);

      // Default period_start = prior draw's period_end + 1 day (if any locked).
      const lockedPrior = priorList.find((d) =>
        ["submitted", "approved", "locked", "paid"].includes(d.status)
      );
      if (lockedPrior?.period_end) {
        const pEnd = new Date(lockedPrior.period_end + "T00:00:00");
        pEnd.setDate(pEnd.getDate() + 1);
        const iso = pEnd.toISOString().split("T")[0];
        setPeriodStart((prev) => prev || iso);
      }
      // Default period_end = last day of current month.
      const today = new Date();
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      const defaultEnd = `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, "0")}-${String(lastDay.getDate()).padStart(2, "0")}`;
      setPeriodEnd((prev) => prev || defaultEnd);
    }
    fetchContext();
  }, [jobId, jobs]);

  // Load invoices whose received_date lies within the period once it is set.
  useEffect(() => {
    if (!jobId || !periodStart || !periodEnd) return;
    async function fetchInvoices() {
      const { data: invData } = await supabase
        .from("invoices")
        .select(
          "id, vendor_name_raw, invoice_number, total_amount, received_date, cost_code_id, cost_codes:cost_code_id (code, description)"
        )
        .eq("job_id", jobId)
        .in("status", ["qa_approved"])
        .is("draw_id", null)
        .is("deleted_at", null)
        .gte("received_date", periodStart)
        .lte("received_date", periodEnd);
      if (invData) {
        const inv = invData as unknown as AvailableInvoice[];
        setInvoices(inv);
        setSelected(new Set(inv.map((i) => i.id)));
      }
    }
    fetchInvoices();
  }, [jobId, periodStart, periodEnd]);

  const toggleInvoice = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedTotal = invoices
    .filter((i) => selected.has(i.id))
    .reduce((s, i) => s + i.total_amount, 0);

  // G702 preview calculations — reflect new retainage math.
  const originalContractSum = job?.original_contract_amount ?? 0;
  const netChangeOrders = 0;
  const contractSumToDate = originalContractSum + netChangeOrders;
  const lessPrevCerts = priorDraws
    .filter((d) => ["submitted", "approved", "locked", "paid"].includes(d.status) && d.revision_number === 0)
    .reduce((s, d) => s + d.current_payment_due, 0);
  const totalCompletedToDate = selectedTotal + lessPrevCerts; // approximate; server recomputes
  const retainagePct = (job?.retainage_percent ?? 10) / 100;
  const retainageOnCompleted = isFinal ? 0 : Math.round(totalCompletedToDate * retainagePct);
  const totalRetainage = retainageOnCompleted; // stored-material = 0
  const totalEarnedLessRetainage = totalCompletedToDate - totalRetainage;
  const currentPaymentDue = totalEarnedLessRetainage - lessPrevCerts;
  const balanceToFinish = contractSumToDate - totalCompletedToDate + totalRetainage;
  const depositAmount = job ? Math.round(originalContractSum * job.deposit_percentage) : 0;

  const blockingOpenDraw = useMemo(
    () =>
      priorDraws.find((d) => ["draft", "pm_review", "submitted"].includes(d.status)),
    [priorDraws]
  );

  const nextDrawNumber = useMemo(() => {
    const existing = priorDraws.filter((d) => d.revision_number === 0);
    const max = existing.reduce((m, d) => Math.max(m, d.draw_number), 0);
    return max + 1;
  }, [priorDraws]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/draws/new", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        job_id: jobId,
        application_date: appDate,
        period_start: periodStart,
        period_end: periodEnd,
        invoice_ids: Array.from(selected),
        is_final: isFinal,
      }),
    });
    if (res.ok) {
      const { id } = await res.json();
      router.push(`/draws/${id}`);
    } else {
      const data = await res.json().catch(() => ({ error: "Failed to create draw" }));
      setError(data.error ?? "Failed to create draw");
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen">
      <NavBar />
      <main className="max-w-5xl mx-auto px-6 py-8">
        <h2 className="font-display text-2xl text-cream mb-6">Create New Draw</h2>

        {/* Step indicators */}
        <div className="flex items-center gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <button
              key={s}
              onClick={() => {
                if (s < step || (s === 2 && jobId) || (s === 3 && jobId)) setStep(s);
              }}
              className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium transition-colors ${
                step === s
                  ? "bg-teal text-white"
                  : step > s
                  ? "bg-brand-elevated text-cream"
                  : "bg-brand-surface text-cream-muted"
              }`}
            >
              {s}. {s === 1 ? "Setup" : s === 2 ? "Select Invoices" : "Preview & Save"}
            </button>
          ))}
        </div>

        {/* Step 1: Setup */}
        {step === 1 && (
          <div className="space-y-6 animate-fade-up">
            <div className="bg-brand-card border border-brand-border p-6 space-y-4">
              <div>
                <label className="text-[11px] font-medium text-cream-dim uppercase tracking-wider mb-1.5 block">
                  Job
                </label>
                <select
                  value={jobId}
                  onChange={(e) => setJobId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-brand-surface border border-brand-border text-sm text-cream focus:border-teal focus:outline-none"
                >
                  <option value="">Select a job...</option>
                  {jobs.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.name} — {j.address}
                    </option>
                  ))}
                </select>
              </div>
              {jobId && (
                <div className="bg-teal/5 border border-teal/30 px-4 py-3 text-sm text-cream">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <span className="text-cream-dim">Next draw: </span>
                      <span className="font-medium">Draw #{nextDrawNumber}</span>
                      <span className="text-cream-dim ml-3">Retainage: </span>
                      <span className="font-medium">{(job?.retainage_percent ?? 10).toFixed(1)}%</span>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isFinal}
                        onChange={(e) => setIsFinal(e.target.checked)}
                        className="rounded"
                      />
                      <span className="text-brass">Mark as final draw (release retainage)</span>
                    </label>
                  </div>
                </div>
              )}
              {blockingOpenDraw && (
                <div className="bg-status-danger/10 border border-status-danger/40 px-4 py-3 text-sm text-status-danger">
                  Draw #{blockingOpenDraw.draw_number} is still in{" "}
                  <span className="font-medium">{blockingOpenDraw.status}</span> status — approve
                  or void it before creating Draw #{nextDrawNumber}.
                </div>
              )}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-[11px] font-medium text-cream-dim uppercase tracking-wider mb-1.5 block">
                    Application Date
                  </label>
                  <input
                    type="date"
                    value={appDate}
                    onChange={(e) => setAppDate(e.target.value)}
                    className="w-full px-3 py-2.5 bg-brand-surface border border-brand-border text-sm text-cream focus:border-teal focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-cream-dim uppercase tracking-wider mb-1.5 block">
                    Period Start
                  </label>
                  <input
                    type="date"
                    value={periodStart}
                    onChange={(e) => setPeriodStart(e.target.value)}
                    className="w-full px-3 py-2.5 bg-brand-surface border border-brand-border text-sm text-cream focus:border-teal focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-cream-dim uppercase tracking-wider mb-1.5 block">
                    Period End
                  </label>
                  <input
                    type="date"
                    value={periodEnd}
                    onChange={(e) => setPeriodEnd(e.target.value)}
                    className="w-full px-3 py-2.5 bg-brand-surface border border-brand-border text-sm text-cream focus:border-teal focus:outline-none"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setStep(2)}
                disabled={!jobId || !periodStart || !periodEnd || !!blockingOpenDraw}
                className="px-6 py-2.5 bg-teal hover:bg-teal-hover disabled:opacity-50 text-white font-medium transition-colors"
              >
                Next: Select Invoices
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Select Invoices */}
        {step === 2 && (
          <div className="space-y-6 animate-fade-up">
            <div className="bg-teal/5 border border-teal/30 px-4 py-3 text-sm text-cream">
              Showing QA-approved invoices received between{" "}
              <span className="font-medium">{formatDate(periodStart)}</span> and{" "}
              <span className="font-medium">{formatDate(periodEnd)}</span>.
            </div>
            {invoices.length === 0 ? (
              <div className="bg-brand-card border border-brand-border p-8 text-center">
                <p className="text-cream text-lg font-display">No invoices in period</p>
                <p className="text-cream-dim text-sm mt-1">
                  No QA-approved invoices for this job received within this period.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-brand-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-brand-surface text-left">
                      <th className="py-3 px-5 w-10">
                        <input
                          type="checkbox"
                          checked={selected.size === invoices.length}
                          onChange={() =>
                            setSelected(
                              selected.size === invoices.length
                                ? new Set()
                                : new Set(invoices.map((i) => i.id))
                            )
                          }
                          className="rounded"
                        />
                      </th>
                      <th className="py-3 px-5 text-[11px] text-cream font-bold uppercase tracking-wider">Vendor</th>
                      <th className="py-3 px-5 text-[11px] text-cream font-bold uppercase tracking-wider">Inv #</th>
                      <th className="py-3 px-5 text-[11px] text-cream font-bold uppercase tracking-wider">Received</th>
                      <th className="py-3 px-5 text-[11px] text-cream font-bold uppercase tracking-wider">Cost Code</th>
                      <th className="py-3 px-5 text-[11px] text-cream font-bold uppercase tracking-wider text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv) => (
                      <tr
                        key={inv.id}
                        className="border-t border-brand-row-border hover:bg-brand-elevated/50 cursor-pointer transition-colors"
                        onClick={() => toggleInvoice(inv.id)}
                      >
                        <td className="py-3 px-5">
                          <input
                            type="checkbox"
                            checked={selected.has(inv.id)}
                            onChange={() => toggleInvoice(inv.id)}
                            className="rounded"
                          />
                        </td>
                        <td className="py-3 px-5 text-cream">{inv.vendor_name_raw ?? "Unknown"}</td>
                        <td className="py-3 px-5 text-cream-muted font-mono text-xs">{inv.invoice_number ?? "—"}</td>
                        <td className="py-3 px-5 text-cream-muted text-xs">{formatDate(inv.received_date)}</td>
                        <td className="py-3 px-5 text-cream-muted text-xs">
                          {inv.cost_codes ? `${inv.cost_codes.code} — ${inv.cost_codes.description}` : "—"}
                        </td>
                        <td className="py-3 px-5 text-cream text-right font-display font-medium">
                          {formatCents(inv.total_amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-brand-border bg-brand-surface">
                      <td colSpan={5} className="py-3 px-5 text-cream-dim text-sm font-medium">
                        {selected.size} of {invoices.length} selected
                      </td>
                      <td className="py-3 px-5 text-brass text-right font-display font-medium text-base">
                        {formatCents(selectedTotal)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
            <div className="flex justify-between">
              <button
                onClick={() => setStep(1)}
                className="px-6 py-2.5 border border-brand-border text-cream-muted hover:border-brand-border-light transition-colors"
              >
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={selected.size === 0}
                className="px-6 py-2.5 bg-teal hover:bg-teal-hover disabled:opacity-50 text-white font-medium transition-colors"
              >
                Next: Preview
              </button>
            </div>
          </div>
        )}

        {/* Step 3: G702 Preview */}
        {step === 3 && (
          <div className="space-y-6 animate-fade-up">
            <div className="bg-brand-card border border-brand-border p-6">
              <p className="text-[11px] font-medium text-cream-dim uppercase tracking-wider mb-4">
                G702 Summary — Application for Payment {isFinal && <span className="text-brass">(FINAL)</span>}
              </p>
              <div className="mt-5 space-y-3">
                <G702Line num="1" label="Original Contract Sum" value={originalContractSum} />
                <G702Line num="1a" label="Deposit" value={depositAmount} sub />
                <G702Line num="2" label="Net Change by Change Orders" value={netChangeOrders} />
                <G702Line num="3" label="Contract Sum to Date (1 + 2)" value={contractSumToDate} highlight />
                <div className="border-t border-brand-border my-2" />
                <G702Line num="4" label="Total Completed & Stored to Date" value={totalCompletedToDate} />
                <G702Line num="5a" label="Retainage on Completed Work" value={retainageOnCompleted} sub />
                <G702Line num="5b" label="Retainage on Stored Material" value={0} sub />
                <G702Line num="5c" label="Total Retainage" value={totalRetainage} />
                <G702Line num="6" label="Total Earned Less Retainage (4 − 5c)" value={totalEarnedLessRetainage} />
                <G702Line num="7" label="Less Previous Certificates" value={lessPrevCerts} />
                <G702Line num="8" label="Current Payment Due (6 − 7)" value={currentPaymentDue} highlight />
                <div className="border-t border-brand-border my-2" />
                <G702Line num="9" label="Balance to Finish + Retainage" value={balanceToFinish} />
              </div>
            </div>

            <div className="bg-brand-card border border-brand-border p-6">
              <p className="text-[11px] font-medium text-cream-dim uppercase tracking-wider mb-2">Draw Details</p>
              <div className="grid grid-cols-3 gap-4 text-sm mt-3">
                <div>
                  <span className="text-cream-dim">Job:</span>{" "}
                  <span className="text-cream ml-1">{job?.name}</span>
                </div>
                <div>
                  <span className="text-cream-dim">Period:</span>{" "}
                  <span className="text-cream ml-1">
                    {formatDate(periodStart)} to {formatDate(periodEnd)}
                  </span>
                </div>
                <div>
                  <span className="text-cream-dim">Invoices:</span>{" "}
                  <span className="text-cream ml-1">
                    {selected.size} totaling {formatCents(selectedTotal)}
                  </span>
                </div>
              </div>
            </div>

            {error && (
              <div className="bg-status-danger/10 border border-status-danger/40 px-4 py-3 text-sm text-status-danger">
                {error}
              </div>
            )}

            <div className="flex justify-between">
              <button
                onClick={() => setStep(2)}
                className="px-6 py-2.5 border border-brand-border text-cream-muted hover:border-brand-border-light transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-8 py-2.5 bg-teal hover:bg-teal-hover disabled:opacity-50 text-white font-medium transition-colors"
              >
                {saving ? "Creating..." : "Save as Draft"}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function G702Line({
  num,
  label,
  value,
  highlight,
  sub,
}: {
  num: string;
  label: string;
  value: number;
  highlight?: boolean;
  sub?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between ${sub ? "pl-6 opacity-80" : ""}`}>
      <div className="flex items-center gap-3">
        <span className="text-cream-dim text-xs font-mono w-6">{num}</span>
        <span className={`text-sm ${highlight ? "text-cream font-medium" : "text-cream-muted"}`}>
          {label}
        </span>
      </div>
      <span
        className={`font-display ${
          highlight ? "text-brass font-medium text-base" : "text-cream text-sm"
        }`}
      >
        {formatCents(value)}
      </span>
    </div>
  );
}
