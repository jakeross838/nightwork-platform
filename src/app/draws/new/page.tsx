"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AppShell from "@/components/app-shell";
import { supabase } from "@/lib/supabase/client";
import { formatCents, formatDate } from "@/lib/utils/format";

interface Job {
  id: string;
  name: string;
  address: string | null;
  original_contract_amount: number;
  current_contract_amount: number;
  deposit_percentage: number;
  retainage_percent: number;
}

interface AvailableInvoice {
  id: string;
  vendor_id: string | null;
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

interface PreviewLine {
  cost_code_id: string;
  scheduled_value: number;
  previous_applications: number;
  this_period: number;
  total_completed: number;
  retainage: number;
  balance_to_finish: number;
  percent_complete: number;
  code: string;
  description: string;
  sort_order: number;
  is_change_order: boolean;
  original_estimate: number;
  revised_estimate: number;
}

interface PreviewCO {
  pcco_number: number | null;
  description: string;
  amount: number;
}

interface PreviewResponse {
  draw_number: number;
  job: { id: string; name: string; address: string | null };
  lines: PreviewLine[];
  change_orders: PreviewCO[];
  totals: {
    original_contract_sum: number;
    net_change_orders: number;
    contract_sum_to_date: number;
    total_completed_to_date: number;
    retainage_on_completed: number;
    retainage_on_stored: number;
    total_retainage: number;
    total_earned_less_retainage: number;
    less_previous_certificates: number;
    current_payment_due: number;
    balance_to_finish: number;
    deposit_amount: number;
  };
}

interface WorkflowSettings {
  require_lien_release_for_draw: boolean;
}

const STEPS = [
  { n: 1, label: "Select Job" },
  { n: 2, label: "Period" },
  { n: 3, label: "Review Line Items" },
  { n: 4, label: "Summary & Submit" },
];

export default function NewDrawWizardPage() {
  const router = useRouter();
  const search = useSearchParams();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- Step 1 state ---
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobId, setJobId] = useState("");
  const [jobMeta, setJobMeta] = useState<{
    contractAmount: number;
    billedToDate: number;
    remaining: number;
    invoicesSinceLastDraw: number;
    lastDrawNumber: number | null;
    lastDrawPeriodEnd: string | null;
  } | null>(null);

  // --- Step 2 state ---
  const [appDate, setAppDate] = useState(new Date().toISOString().split("T")[0]);
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [isFinal, setIsFinal] = useState(false);
  const [periodInvoices, setPeriodInvoices] = useState<AvailableInvoice[]>([]);

  // --- Step 3 state ---
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Per-line override of "this period" amount (in cents) keyed by cost_code_id.
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const [overrideReasons, setOverrideReasons] = useState<Record<string, string>>({});

  // --- Step 4 state ---
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [settings, setSettings] = useState<WorkflowSettings | null>(null);
  const [priorDraws, setPriorDraws] = useState<PriorDraw[]>([]);

  // --- Draft handling ---
  const [draftId, setDraftId] = useState<string | null>(search.get("resume"));
  const lastSavedRef = useRef<string>("");

  // Load active jobs on mount.
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("jobs")
        .select(
          "id, name, address, original_contract_amount, current_contract_amount, deposit_percentage, retainage_percent"
        )
        .is("deleted_at", null)
        .eq("status", "active")
        .order("name");
      if (data) setJobs(data as Job[]);
    })();
  }, []);

  // If resuming a draft, load it.
  useEffect(() => {
    if (!draftId) return;
    (async () => {
      const { data } = await supabase
        .from("draws")
        .select("id, job_id, wizard_draft, application_date, period_start, period_end, is_final")
        .eq("id", draftId)
        .single();
      if (!data) return;
      const draft = data.wizard_draft as Record<string, unknown> | null;
      if (data.job_id) setJobId(data.job_id as string);
      if (data.application_date) setAppDate(data.application_date as string);
      if (data.period_start) setPeriodStart(data.period_start as string);
      if (data.period_end) setPeriodEnd(data.period_end as string);
      if (typeof data.is_final === "boolean") setIsFinal(data.is_final);
      if (draft) {
        if (Array.isArray(draft.selected)) setSelected(new Set(draft.selected as string[]));
        if (typeof draft.step === "number") setStep(draft.step as number);
        if (draft.overrides && typeof draft.overrides === "object") {
          setOverrides(draft.overrides as Record<string, number>);
        }
        if (draft.overrideReasons && typeof draft.overrideReasons === "object") {
          setOverrideReasons(draft.overrideReasons as Record<string, string>);
        }
      }
    })();
  }, [draftId]);

  // Job context: contract, billed-to-date, last draw, invoices since.
  useEffect(() => {
    if (!jobId) {
      setJobMeta(null);
      return;
    }
    (async () => {
      const job = jobs.find((j) => j.id === jobId);
      if (!job) return;
      const contractAmount = job.current_contract_amount ?? job.original_contract_amount;

      // Parallel: billed invoices + prior draws (independent queries)
      const [{ data: billed }, { data: priors }] = await Promise.all([
        supabase
          .from("invoices")
          .select("total_amount, status")
          .eq("job_id", jobId)
          .is("deleted_at", null)
          .in("status", ["qa_approved", "pushed_to_qb", "in_draw", "paid"]),
        supabase
          .from("draws")
          .select("id, draw_number, status, period_end, current_payment_due, revision_number")
          .eq("job_id", jobId)
          .is("deleted_at", null)
          .order("draw_number", { ascending: false }),
      ]);
      const billedToDate = (billed ?? []).reduce(
        (s, i) => s + ((i as { total_amount?: number }).total_amount ?? 0),
        0
      );
      const priorList = (priors ?? []) as PriorDraw[];
      setPriorDraws(priorList);

      const lockedPrior = priorList.find((d) =>
        ["submitted", "approved", "locked", "paid"].includes(d.status)
      );

      // Default period_start = day after last locked draw period_end.
      let defaultStart = periodStart;
      if (!defaultStart && lockedPrior?.period_end) {
        const pEnd = new Date(lockedPrior.period_end + "T00:00:00");
        pEnd.setDate(pEnd.getDate() + 1);
        defaultStart = pEnd.toISOString().split("T")[0];
      }
      if (!defaultStart) {
        // No prior draws — default to first day of current month.
        const t = new Date();
        defaultStart = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-01`;
      }
      if (!periodStart) setPeriodStart(defaultStart);
      if (!periodEnd) setPeriodEnd(new Date().toISOString().split("T")[0]);

      // Count approved invoices since the last draw's period_end.
      const sinceCutoff = lockedPrior?.period_end ?? "1900-01-01";
      const { data: sinceInvs } = await supabase
        .from("invoices")
        .select("id")
        .eq("job_id", jobId)
        .is("deleted_at", null)
        .in("status", ["qa_approved"])
        .gt("received_date", sinceCutoff);

      setJobMeta({
        contractAmount,
        billedToDate,
        remaining: contractAmount - billedToDate,
        invoicesSinceLastDraw: (sinceInvs ?? []).length,
        lastDrawNumber: lockedPrior?.draw_number ?? null,
        lastDrawPeriodEnd: lockedPrior?.period_end ?? null,
      });
    })();
  }, [jobId, jobs]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load workflow settings (for lien release warning gate).
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/workflow-settings");
        if (res.ok) {
          const data = await res.json();
          setSettings(data.settings);
        }
      } catch {
        /* falls back to optimistic UI */
      }
    })();
  }, []);

  // Step 2 → load invoices in the period.
  useEffect(() => {
    if (!jobId || !periodStart || !periodEnd) {
      setPeriodInvoices([]);
      return;
    }
    (async () => {
      // Phase 8f: include invoices already attached to the resumed draft so
      // resume mode shows the same line items the draft was created with.
      let query = supabase
        .from("invoices")
        .select(
          "id, vendor_id, vendor_name_raw, invoice_number, total_amount, received_date, cost_code_id, draw_id, status, cost_codes:cost_code_id (code, description)"
        )
        .eq("job_id", jobId)
        .is("deleted_at", null)
        .gte("received_date", periodStart)
        .lte("received_date", periodEnd);

      // Allow either: unattached qa_approved invoices, OR invoices on the
      // resumed draft (any status — they may already be in_draw or paid).
      if (draftId) {
        query = query.or(
          `and(draw_id.is.null,status.eq.qa_approved),draw_id.eq.${draftId}`
        );
      } else {
        query = query.is("draw_id", null).in("status", ["qa_approved"]);
      }

      const { data } = await query;
      const invs = (data ?? []) as unknown as AvailableInvoice[];
      setPeriodInvoices(invs);
      // Default-select all on first load if nothing selected yet.
      if (selected.size === 0) {
        setSelected(new Set(invs.map((i) => i.id)));
      }
    })();
  }, [jobId, periodStart, periodEnd]); // eslint-disable-line react-hooks/exhaustive-deps

  // Step 3/4 → fetch preview whenever inputs change.
  const fetchPreview = useCallback(async () => {
    if (!jobId || !periodStart || !periodEnd) return;
    setPreviewLoading(true);
    try {
      const res = await fetch("/api/draws/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_id: jobId,
          period_start: periodStart,
          period_end: periodEnd,
          invoice_ids: Array.from(selected),
          is_final: isFinal,
        }),
      });
      if (res.ok) setPreview(await res.json());
    } finally {
      setPreviewLoading(false);
    }
  }, [jobId, periodStart, periodEnd, selected, isFinal]);

  useEffect(() => {
    if (step === 3 || step === 4) fetchPreview();
  }, [step, fetchPreview]);

  // --- Auto-save draft (after job is selected, debounced) ---
  useEffect(() => {
    if (!jobId) return;
    const draftPayload = {
      step,
      selected: Array.from(selected),
      overrides,
      overrideReasons,
      isFinal,
      periodStart,
      periodEnd,
      appDate,
    };
    const serialized = JSON.stringify({ jobId, draftPayload });
    if (serialized === lastSavedRef.current) return;
    lastSavedRef.current = serialized;

    // Debounce the save — a draft only persists once the user has reached
    // step 4 (when there's a real draw row to attach it to). Steps 1–3 keep
    // their state in URL so navigation still works.
    if (!draftId) return;
    const t = window.setTimeout(() => {
      fetch("/api/draws/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: draftId, wizard_draft: draftPayload }),
      });
    }, 1500);
    return () => window.clearTimeout(t);
  }, [step, jobId, selected, overrides, overrideReasons, isFinal, periodStart, periodEnd, appDate, draftId]);

  // ----- Derived UI helpers -----
  const job = useMemo(() => jobs.find((j) => j.id === jobId) ?? null, [jobs, jobId]);
  const blockingOpenDraw = priorDraws.find((d) =>
    ["draft", "pm_review", "submitted"].includes(d.status)
  );
  const nextDrawNumber = useMemo(() => {
    const existing = priorDraws.filter((d) => d.revision_number === 0);
    const max = existing.reduce((m, d) => Math.max(m, d.draw_number), 0);
    return max + 1;
  }, [priorDraws]);

  const baseLines = useMemo(
    () => (preview?.lines ?? []).filter((l) => !l.is_change_order),
    [preview]
  );
  const coLines = useMemo(
    () => (preview?.lines ?? []).filter((l) => l.is_change_order),
    [preview]
  );

  // Warnings on Step 4
  const warnings = useMemo(() => {
    const out: { kind: "warn" | "info"; text: string }[] = [];
    if (!preview) return out;

    // Lines that exceed scheduled value.
    const overruns = preview.lines.filter(
      (l) => l.scheduled_value > 0 && l.total_completed > l.scheduled_value
    );
    for (const ov of overruns) {
      out.push({
        kind: "warn",
        text: `${ov.code} ${ov.description}: total completed ${formatCents(
          ov.total_completed
        )} exceeds scheduled value ${formatCents(ov.scheduled_value)}`,
      });
    }

    // Retainage rollup mismatch.
    const expectedRetainage = preview.lines.reduce((s, l) => s + l.retainage, 0);
    if (Math.abs(expectedRetainage - preview.totals.total_retainage) > 100) {
      out.push({
        kind: "warn",
        text: `G703 line retainage (${formatCents(
          expectedRetainage
        )}) does not match G702 Line 5c (${formatCents(preview.totals.total_retainage)})`,
      });
    }

    // Lien release setting — list vendors on this draw with no release on file
    // for the current draw period.
    if (settings?.require_lien_release_for_draw) {
      const selectedInvoices = periodInvoices.filter((i) => selected.has(i.id));
      const vendorsInDraw = new Set(
        selectedInvoices.map((i) => i.vendor_id).filter(Boolean) as string[]
      );
      if (vendorsInDraw.size > 0) {
        out.push({
          kind: "info",
          text: `Lien releases will be auto-generated for ${vendorsInDraw.size} vendor(s) when this draw is submitted. Approval will be blocked until all are received or waived.`,
        });
      }
    }

    return out;
  }, [preview, settings, selected, periodInvoices]);

  function toggleInvoice(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function setLineOverride(ccId: string, dollars: string, reason: string) {
    const cents = Math.round(Number(dollars || "0") * 100);
    setOverrides((prev) => ({ ...prev, [ccId]: cents }));
    setOverrideReasons((prev) => ({ ...prev, [ccId]: reason }));
  }

  async function handleSaveDraft() {
    setSubmitting(true);
    setError(null);
    try {
      // Drafts persist only via creating a real draws row. We re-use POST
      // /api/draws/new which always creates with status='draft'.
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
          wizard_draft: {
            step,
            selected: Array.from(selected),
            overrides,
            overrideReasons,
            isFinal,
            periodStart,
            periodEnd,
            appDate,
            line_overrides_note: Object.keys(overrides).length
              ? "PM adjusted line amounts during wizard"
              : null,
          },
        }),
      });
      if (res.ok) {
        const { id } = await res.json();
        setDraftId(id);
        router.push(`/draws/${id}`);
      } else {
        const data = await res.json().catch(() => ({ error: "Save failed" }));
        setError(data.error ?? "Save failed");
      }
    } finally {
      setSubmitting(false);
    }
  }

  function StepBadge({ n, label }: { n: number; label: string }) {
    const active = step === n;
    const done = step > n;
    return (
      <button
        type="button"
        onClick={() => {
          if (n <= step || (jobId && n <= 4)) setStep(n);
        }}
        className={`flex items-center gap-2 px-2 sm:px-3 py-1.5 text-xs font-medium transition-colors ${
          active
            ? "bg-[var(--nw-stone-blue)] text-white"
            : done
              ? "bg-[var(--bg-muted)] text-[color:var(--text-primary)]"
              : "bg-[var(--bg-subtle)] text-[color:var(--text-muted)]"
        }`}
      >
        <span className="font-mono">
          <span className="sm:hidden">{n}/4</span>
          <span className="hidden sm:inline">Step {n} of 4</span>
        </span>
        <span className="hidden md:inline">·</span>
        <span className="hidden md:inline">{label}</span>
      </button>
    );
  }

  return (
    <AppShell>
      <main className="max-w-6xl mx-auto px-4 md:px-6 py-8">
        <span
          className="block mb-2 text-[10px] uppercase"
          style={{
            fontFamily: "var(--font-jetbrains-mono)",
            letterSpacing: "0.14em",
            color: "var(--text-tertiary)",
          }}
        >
          Financial · Draw Wizard
        </span>
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
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
            Create New Draw
          </h2>
          {jobId && draftId && (
            <span
              className="text-[10px] uppercase"
              style={{
                fontFamily: "var(--font-jetbrains-mono)",
                letterSpacing: "0.14em",
                color: "var(--text-tertiary)",
              }}
            >
              Draft auto-save enabled
            </span>
          )}
        </div>
        <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
          Step-by-step wizard. Save as draft at any step — pick up later from the draws list.
        </p>

        {/* Step indicators */}
        <div className="flex items-center gap-2 mb-8 flex-wrap">
          {STEPS.map((s) => (
            <StepBadge key={s.n} n={s.n} label={s.label} />
          ))}
        </div>

        {error && (
          <div className="mb-4 bg-[rgba(176,85,78,0.12)] border border-[rgba(176,85,78,0.35)] px-4 py-3 text-sm text-[color:var(--nw-danger)]">
            {error}
          </div>
        )}

        {/* ─────────────────────────  STEP 1  ───────────────────────── */}
        {step === 1 && (
          <div className="space-y-6 animate-fade-up">
            <div className="bg-[var(--bg-card)] border border-[var(--border-default)] p-6 space-y-4">
              <div>
                <label className="text-[11px] font-medium text-[color:var(--text-secondary)] uppercase tracking-wider mb-1.5 block">
                  Job
                </label>
                <select
                  value={jobId}
                  onChange={(e) => setJobId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-[var(--bg-subtle)] border border-[var(--border-default)] text-sm text-[color:var(--text-primary)] focus:border-[var(--nw-stone-blue)] focus:outline-none"
                >
                  <option value="">Select a job…</option>
                  {jobs.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.name} — {j.address}
                    </option>
                  ))}
                </select>
              </div>

              {jobMeta && job && (
                <div className="bg-[rgba(91,134,153,0.08)] border border-[rgba(91,134,153,0.3)] p-4 space-y-2">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <Stat label="Contract" value={formatCents(jobMeta.contractAmount)} />
                    <Stat label="Billed to date" value={formatCents(jobMeta.billedToDate)} />
                    <Stat label="Remaining" value={formatCents(jobMeta.remaining)} />
                    <Stat
                      label="Next draw"
                      value={`#${nextDrawNumber}`}
                      sub={`Retainage ${(job.retainage_percent ?? 10).toFixed(1)}%`}
                    />
                  </div>
                </div>
              )}

              {jobId && jobMeta && jobMeta.invoicesSinceLastDraw === 0 && (
                <div className="bg-[rgba(201,138,59,0.12)] border border-[rgba(201,138,59,0.35)] px-4 py-3 text-sm text-[color:var(--nw-warn)]">
                  No new approved invoices since{" "}
                  {jobMeta.lastDrawNumber
                    ? `Draw #${jobMeta.lastDrawNumber}`
                    : "the start of this job"}
                  . You can still create the draw, but it may be empty.
                </div>
              )}

              {jobId && (
                <label className="flex items-center gap-2 cursor-pointer text-sm text-[color:var(--nw-warn)]">
                  <input
                    type="checkbox"
                    checked={isFinal}
                    onChange={(e) => setIsFinal(e.target.checked)}
                    className="rounded"
                  />
                  Mark as final draw (release retainage)
                </label>
              )}

              {blockingOpenDraw && (
                <div className="bg-[rgba(176,85,78,0.12)] border border-[rgba(176,85,78,0.35)] px-4 py-3 text-sm text-[color:var(--nw-danger)]">
                  Draw #{blockingOpenDraw.draw_number} is still in{" "}
                  <span className="font-medium">{blockingOpenDraw.status}</span> status — approve
                  or void it before creating Draw #{nextDrawNumber}.
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setStep(2)}
                disabled={!jobId || !!blockingOpenDraw}
                className="px-6 py-2.5 disabled:opacity-50 transition-colors nw-primary-btn"
              >
                Next: Period
              </button>
            </div>
          </div>
        )}

        {/* ─────────────────────────  STEP 2  ───────────────────────── */}
        {step === 2 && (
          <div className="space-y-6 animate-fade-up">
            <div className="bg-[var(--bg-card)] border border-[var(--border-default)] p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <DateField label="Application Date" value={appDate} onChange={setAppDate} />
                <DateField label="Period Start" value={periodStart} onChange={setPeriodStart} />
                <DateField label="Period End" value={periodEnd} onChange={setPeriodEnd} />
              </div>
              <div className="text-xs text-[color:var(--text-secondary)]">
                Default period start = day after the last locked draw&apos;s period end. Default end =
                today.
              </div>
              <div className="bg-[rgba(91,134,153,0.08)] border border-[rgba(91,134,153,0.3)] px-4 py-3 text-sm text-[color:var(--text-primary)]">
                <span className="font-medium">{periodInvoices.length}</span> approved invoice(s)
                received between {formatDate(periodStart)} and {formatDate(periodEnd)}.
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-3">
              <button
                onClick={() => setStep(1)}
                className="w-full sm:w-auto px-6 py-2.5 border border-[var(--border-default)] text-[color:var(--text-muted)] hover:border-[var(--border-default)]-light"
              >
                Back
              </button>
              <div className="flex flex-col-reverse sm:flex-row gap-3">
                <button
                  onClick={handleSaveDraft}
                  disabled={submitting}
                  className="w-full sm:w-auto px-4 py-2.5 border border-[var(--border-default)] text-[color:var(--text-primary)] hover:bg-[var(--bg-muted)] text-sm"
                >
                  Save Draft
                </button>
                <button
                  onClick={() => setStep(3)}
                  disabled={!periodStart || !periodEnd}
                  className="w-full sm:w-auto px-6 py-2.5 disabled:opacity-50 transition-colors nw-primary-btn"
                >
                  Next: Review Line Items
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─────────────────────────  STEP 3  ───────────────────────── */}
        {step === 3 && (
          <div className="space-y-6 animate-fade-up">
            {periodInvoices.length === 0 ? (
              <div className="bg-[var(--bg-card)] border border-[var(--border-default)] p-8 text-center text-[color:var(--text-primary)]">
                No invoices found in this period.
              </div>
            ) : (
              <div className="bg-[var(--bg-card)] border border-[var(--border-default)] p-4">
                <p className="text-[11px] font-medium text-[color:var(--text-secondary)] uppercase tracking-wider mb-3">
                  {selected.size} of {periodInvoices.length} invoice(s) selected
                </p>
                <div className="overflow-x-auto border border-[var(--border-default)] max-h-72">
                  <table className="w-full min-w-[520px] text-sm">
                    <thead>
                      <tr className="bg-[var(--bg-subtle)] text-left sticky top-0">
                        <th className="py-2 px-3 w-8">
                          <input
                            type="checkbox"
                            checked={selected.size === periodInvoices.length}
                            onChange={() =>
                              setSelected(
                                selected.size === periodInvoices.length
                                  ? new Set()
                                  : new Set(periodInvoices.map((i) => i.id))
                              )
                            }
                          />
                        </th>
                        <Th>Vendor</Th>
                        <Th>Inv #</Th>
                        <Th>Cost code</Th>
                        <Th right>Amount</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {periodInvoices.map((inv) => (
                        <tr
                          key={inv.id}
                          className="border-t border-[var(--border-default)] hover:bg-[var(--bg-muted)]/50 cursor-pointer"
                          onClick={() => toggleInvoice(inv.id)}
                        >
                          <td className="py-2 px-3">
                            <input
                              type="checkbox"
                              checked={selected.has(inv.id)}
                              onChange={() => toggleInvoice(inv.id)}
                            />
                          </td>
                          <td className="py-2 px-3 text-[color:var(--text-primary)]">
                            {inv.vendor_name_raw ?? "Unknown"}
                          </td>
                          <td className="py-2 px-3 text-[color:var(--text-muted)] font-mono text-xs">
                            {inv.invoice_number ?? "—"}
                          </td>
                          <td className="py-2 px-3 text-[color:var(--text-muted)] text-xs">
                            {inv.cost_codes ? `${inv.cost_codes.code}` : "—"}
                          </td>
                          <td className="py-2 px-3 text-[color:var(--text-primary)] text-right font-display">
                            {formatCents(inv.total_amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* G703-style preview */}
            <div className="bg-[var(--bg-card)] border border-[var(--border-default)]">
              <div className="px-4 py-3 border-b border-[var(--border-default)] flex items-center justify-between">
                <p className="text-[11px] font-medium text-[color:var(--text-secondary)] uppercase tracking-wider">
                  G703 Continuation Sheet — Preview
                </p>
                {previewLoading && (
                  <div className="w-3 h-3 border border-[var(--nw-stone-blue)] border-t-transparent rounded-full animate-spin" />
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-sm">
                  <thead>
                    <tr className="bg-[var(--bg-subtle)] text-left">
                      <Th>Code</Th>
                      <Th>Description</Th>
                      <Th right>Scheduled</Th>
                      <Th right>Previous</Th>
                      <Th right>This Period</Th>
                      <Th right>Total</Th>
                      <Th right>Balance</Th>
                      <Th right>Retainage</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {baseLines.length > 0 && (
                      <tr className="bg-[rgba(91,134,153,0.06)]">
                        <td colSpan={8} className="py-1.5 px-3 text-[10px] uppercase tracking-wider text-[color:var(--text-secondary)] font-semibold">
                          Base Contract
                        </td>
                      </tr>
                    )}
                    {baseLines.map((l) => (
                      <G703EditRow
                        key={l.cost_code_id}
                        line={l}
                        override={overrides[l.cost_code_id]}
                        reason={overrideReasons[l.cost_code_id] ?? ""}
                        onChange={(v, r) => setLineOverride(l.cost_code_id, v, r)}
                      />
                    ))}
                    {coLines.length > 0 && (
                      <>
                        <tr className="bg-[rgba(201,138,59,0.12)] border-t-2 border-[rgba(201,138,59,0.35)]">
                          <td colSpan={8} className="py-1.5 px-3 text-[10px] uppercase tracking-wider text-[color:var(--nw-warn)] font-semibold">
                            Change Orders
                            {preview?.change_orders.some((c) => c.pcco_number != null) && (
                              <span className="ml-2 text-[color:var(--text-secondary)] font-normal normal-case">
                                {preview!.change_orders
                                  .filter((c) => c.pcco_number != null)
                                  .map((c) => `PCCO #${c.pcco_number}`)
                                  .join(", ")}
                              </span>
                            )}
                          </td>
                        </tr>
                        {coLines.map((l) => (
                          <G703EditRow
                            key={l.cost_code_id}
                            line={l}
                            override={overrides[l.cost_code_id]}
                            reason={overrideReasons[l.cost_code_id] ?? ""}
                            onChange={(v, r) => setLineOverride(l.cost_code_id, v, r)}
                            isCo
                          />
                        ))}
                      </>
                    )}
                    {(!preview || preview.lines.length === 0) && (
                      <tr>
                        <td colSpan={8} className="py-6 text-center text-[color:var(--text-secondary)] text-xs">
                          {previewLoading ? "Calculating…" : "No line items yet."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-3">
              <button
                onClick={() => setStep(2)}
                className="w-full sm:w-auto px-6 py-2.5 border border-[var(--border-default)] text-[color:var(--text-muted)] hover:border-[var(--border-default)]-light"
              >
                Back
              </button>
              <div className="flex flex-col-reverse sm:flex-row gap-3">
                <button
                  onClick={handleSaveDraft}
                  disabled={submitting}
                  className="w-full sm:w-auto px-4 py-2.5 border border-[var(--border-default)] text-[color:var(--text-primary)] hover:bg-[var(--bg-muted)] text-sm"
                >
                  Save Draft
                </button>
                <button
                  onClick={() => setStep(4)}
                  disabled={selected.size === 0}
                  className="w-full sm:w-auto px-6 py-2.5 disabled:opacity-50 transition-colors nw-primary-btn"
                >
                  Next: Summary
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─────────────────────────  STEP 4  ───────────────────────── */}
        {step === 4 && preview && (
          <div className="space-y-6 animate-fade-up">
            <div className="bg-[var(--bg-card)] border border-[var(--border-default)] p-6">
              <p className="text-[11px] font-medium text-[color:var(--text-secondary)] uppercase tracking-wider mb-4">
                G702 Summary — Application for Payment{" "}
                {isFinal && <span className="text-[color:var(--nw-warn)]">(FINAL)</span>}
              </p>
              <div className="space-y-3">
                <G702Line num="1" label="Original Contract Sum" value={preview.totals.original_contract_sum} />
                <G702Line num="1a" label="Deposit" value={preview.totals.deposit_amount} sub />
                <G702Line num="2" label="Net Change by Change Orders" value={preview.totals.net_change_orders} />
                <G702Line num="3" label="Contract Sum to Date" value={preview.totals.contract_sum_to_date} highlight />
                <div className="border-t border-[var(--border-default)] my-2" />
                <G702Line num="4" label="Total Completed & Stored to Date" value={preview.totals.total_completed_to_date} />
                <G702Line num="5a" label="Retainage on Completed Work" value={preview.totals.retainage_on_completed} sub />
                <G702Line num="5b" label="Retainage on Stored Material" value={preview.totals.retainage_on_stored} sub />
                <G702Line num="5c" label="Total Retainage" value={preview.totals.total_retainage} />
                <G702Line num="6" label="Total Earned Less Retainage" value={preview.totals.total_earned_less_retainage} />
                <G702Line num="7" label="Less Previous Certificates" value={preview.totals.less_previous_certificates} />
                <G702Line num="8" label="Current Payment Due" value={preview.totals.current_payment_due} highlight />
                <div className="border-t border-[var(--border-default)] my-2" />
                <G702Line num="9" label="Balance to Finish + Retainage" value={preview.totals.balance_to_finish} />
              </div>
            </div>

            {warnings.length > 0 && (
              <div className="bg-[rgba(201,138,59,0.12)] border border-[rgba(201,138,59,0.35)] p-4">
                <p className="text-[11px] font-medium text-[color:var(--nw-warn)] uppercase tracking-wider mb-2">
                  Warnings ({warnings.length})
                </p>
                <ul className="space-y-1.5 text-sm">
                  {warnings.map((w, i) => (
                    <li
                      key={i}
                      className={
                        w.kind === "warn" ? "text-[color:var(--nw-warn)]" : "text-[color:var(--text-muted)]"
                      }
                    >
                      {w.kind === "warn" ? "⚠" : "ℹ"} {w.text}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="bg-[var(--bg-card)] border border-[var(--border-default)] p-6">
              <p className="text-[11px] font-medium text-[color:var(--text-secondary)] uppercase tracking-wider mb-3">
                Draw Details
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-[color:var(--text-secondary)]">Job</div>
                  <div className="text-[color:var(--text-primary)]">{preview.job.name}</div>
                </div>
                <div>
                  <div className="text-[color:var(--text-secondary)]">Period</div>
                  <div className="text-[color:var(--text-primary)]">
                    {formatDate(periodStart)} → {formatDate(periodEnd)}
                  </div>
                </div>
                <div>
                  <div className="text-[color:var(--text-secondary)]">Invoices</div>
                  <div className="text-[color:var(--text-primary)]">{selected.size}</div>
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-3">
              <button
                onClick={() => setStep(3)}
                className="w-full sm:w-auto px-6 py-2.5 border border-[var(--border-default)] text-[color:var(--text-muted)] hover:border-[var(--border-default)]-light"
              >
                Back
              </button>
              <div className="flex flex-col-reverse sm:flex-row gap-3">
                <button
                  onClick={handleSaveDraft}
                  disabled={submitting}
                  className="w-full sm:w-auto px-4 py-2.5 border border-[var(--border-default)] text-[color:var(--text-primary)] hover:bg-[var(--bg-muted)] text-sm"
                >
                  Save Draft
                </button>
                <button
                  onClick={handleSaveDraft}
                  disabled={submitting}
                  className="w-full sm:w-auto px-8 py-2.5 disabled:opacity-50 transition-colors nw-primary-btn"
                >
                  {submitting ? "Creating…" : "Create Draw"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
      <style jsx>{`
        :global(.nw-primary-btn) {
          background: var(--nw-stone-blue);
          color: var(--nw-white-sand);
          font-family: var(--font-jetbrains-mono);
          font-size: 11px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          font-weight: 500;
          border: 1px solid var(--nw-stone-blue);
        }
        :global(.nw-primary-btn:hover:not(:disabled)) {
          background: var(--nw-gulf-blue);
          border-color: var(--nw-gulf-blue);
        }
      `}</style>
    </AppShell>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-[color:var(--text-secondary)]">{label}</div>
      <div className="text-[color:var(--text-primary)] font-display font-medium">{value}</div>
      {sub && <div className="text-xs text-[color:var(--text-secondary)] mt-0.5">{sub}</div>}
    </div>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-[11px] font-medium text-[color:var(--text-secondary)] uppercase tracking-wider mb-1.5 block">
        {label}
      </label>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2.5 bg-[var(--bg-subtle)] border border-[var(--border-default)] text-sm text-[color:var(--text-primary)] focus:border-[var(--nw-stone-blue)] focus:outline-none"
      />
    </div>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th
      className={`py-2 px-3 text-[10px] text-[color:var(--text-primary)] font-bold uppercase tracking-wider ${
        right ? "text-right" : ""
      }`}
    >
      {children}
    </th>
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
        <span className="text-[color:var(--text-secondary)] text-xs font-mono w-6">{num}</span>
        <span className={`text-sm ${highlight ? "text-[color:var(--text-primary)] font-medium" : "text-[color:var(--text-muted)]"}`}>
          {label}
        </span>
      </div>
      <span
        className={`font-display ${
          highlight ? "text-[color:var(--nw-warn)] font-medium text-base" : "text-[color:var(--text-primary)] text-sm"
        }`}
      >
        {formatCents(value)}
      </span>
    </div>
  );
}

function G703EditRow({
  line,
  override,
  reason,
  onChange,
  isCo,
}: {
  line: PreviewLine;
  override?: number;
  reason: string;
  onChange: (dollars: string, reason: string) => void;
  isCo?: boolean;
}) {
  const effectiveAmount = override ?? line.this_period;
  const overrun = line.scheduled_value > 0 && line.total_completed > line.scheduled_value;
  const hasOverride = override != null && override !== line.this_period;
  const dollars = (effectiveAmount / 100).toFixed(2);

  return (
    <>
      <tr className={`border-t border-[var(--border-default)] ${hasOverride ? "bg-[rgba(201,138,59,0.08)]" : ""}`}>
        <td className={`py-2 px-3 font-mono text-xs font-bold ${isCo ? "text-[color:var(--nw-warn)]" : "text-[color:var(--nw-stone-blue)]"}`}>
          {line.code}
        </td>
        <td className="py-2 px-3 text-[color:var(--text-primary)]">
          {line.description}
          {isCo && <span className="ml-2 text-[10px] text-[color:var(--nw-warn)]">CO</span>}
        </td>
        <td className="py-2 px-3 text-[color:var(--text-primary)] text-right">{formatCents(line.scheduled_value)}</td>
        <td className="py-2 px-3 text-[color:var(--text-primary)] text-right">
          {line.previous_applications > 0 ? formatCents(line.previous_applications) : <span className="text-[color:var(--text-secondary)]">—</span>}
        </td>
        <td className="py-2 px-3 text-right">
          <input
            type="number"
            step="0.01"
            value={dollars}
            onChange={(e) => onChange(e.target.value, reason)}
            className="w-24 px-1.5 py-1 bg-[var(--bg-subtle)] border border-[var(--border-default)] text-sm text-[color:var(--text-primary)] text-right font-display focus:border-[var(--nw-stone-blue)] focus:outline-none"
          />
        </td>
        <td className={`py-2 px-3 text-right ${overrun ? "text-[color:var(--nw-danger)] font-medium" : "text-[color:var(--text-primary)]"}`}>
          {formatCents(line.total_completed)}
        </td>
        <td className={`py-2 px-3 text-right ${line.balance_to_finish < 0 ? "text-[color:var(--nw-danger)]" : "text-[color:var(--text-primary)]"}`}>
          {formatCents(line.balance_to_finish)}
        </td>
        <td className="py-2 px-3 text-right text-[color:var(--nw-warn)]">{formatCents(line.retainage)}</td>
      </tr>
      {hasOverride && (
        <tr>
          <td colSpan={8} className="py-1.5 px-3 bg-[rgba(201,138,59,0.08)]">
            <input
              type="text"
              placeholder="Reason for adjustment (required)"
              value={reason}
              onChange={(e) => onChange(dollars, e.target.value)}
              className={`w-full px-2 py-1 bg-[var(--bg-subtle)] border text-xs text-[color:var(--text-primary)] focus:border-[var(--nw-stone-blue)] focus:outline-none ${
                reason.trim() ? "border-[var(--border-default)]" : "border-[rgba(176,85,78,0.35)]"
              }`}
            />
          </td>
        </tr>
      )}
    </>
  );
}
