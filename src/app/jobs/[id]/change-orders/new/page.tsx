"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import NavBar from "@/components/nav-bar";
import Breadcrumbs from "@/components/breadcrumbs";
import { supabase } from "@/lib/supabase/client";
import { formatCents } from "@/lib/utils/format";

interface Job {
  id: string;
  name: string;
  gc_fee_percentage: number;
}

interface BudgetLine {
  id: string;
  cost_code_id: string;
  revised_estimate: number;
  cost_codes: {
    id: string;
    code: string;
    description: string;
    category: string | null;
  } | null;
}

interface CoLine {
  budget_line_id: string;
  cost_code: string;
  description: string;
  amount_dollars: string;
}

export default function NewChangeOrderPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const search = useSearchParams();
  const sourceInvoiceId = search.get("source_invoice_id");
  const prefillAmount = search.get("amount"); // dollars
  const prefillDescription = search.get("description") ?? "";

  const [job, setJob] = useState<Job | null>(null);
  const [budgetLines, setBudgetLines] = useState<BudgetLine[]>([]);

  const [title, setTitle] = useState(prefillDescription);
  const [description, setDescription] = useState("");
  const [coType, setCoType] = useState<"owner" | "internal">("owner");
  const [amount, setAmount] = useState(prefillAmount ?? "");
  const [rateOption, setRateOption] = useState<"default" | "18" | "0" | "custom">("default");
  const [customRate, setCustomRate] = useState("20");
  const [days, setDays] = useState("0");
  const [lines, setLines] = useState<CoLine[]>([{ budget_line_id: "", cost_code: "", description: "", amount_dollars: "" }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace(`/login?redirect=/jobs/${params.id}/change-orders/new`); return; }

      const { data: j } = await supabase
        .from("jobs")
        .select("id, name, gc_fee_percentage")
        .eq("id", params.id)
        .is("deleted_at", null)
        .single();
      if (j) setJob(j as Job);

      const { data: bl } = await supabase
        .from("budget_lines")
        .select("id, cost_code_id, revised_estimate, cost_codes:cost_code_id(id, code, description, category)")
        .eq("job_id", params.id)
        .is("deleted_at", null);
      if (bl) setBudgetLines(bl as unknown as BudgetLine[]);
    }
    load();
  }, [params.id, router]);

  const budgetLineById = useMemo(() => {
    const m = new Map<string, BudgetLine>();
    for (const bl of budgetLines) m.set(bl.id, bl);
    return m;
  }, [budgetLines]);

  const effectiveRate = useMemo(() => {
    if (rateOption === "default") return job?.gc_fee_percentage ?? 0.2;
    if (rateOption === "18") return 0.18;
    if (rateOption === "0") return 0;
    const pct = parseFloat(customRate);
    return isNaN(pct) ? 0 : pct / 100;
  }, [rateOption, customRate, job]);

  const amountCents = useMemo(() => {
    const d = parseFloat(amount);
    return isNaN(d) ? 0 : Math.round(d * 100);
  }, [amount]);
  const feeCents = Math.round(amountCents * effectiveRate);
  const totalCents = amountCents + feeCents;

  const lineTotal = useMemo(() => {
    return lines.reduce((s, l) => {
      const d = parseFloat(l.amount_dollars);
      return s + (isNaN(d) ? 0 : Math.round(d * 100));
    }, 0);
  }, [lines]);

  async function handleSubmit(submit: boolean) {
    setError(null);
    if (!title.trim()) return setError("Title is required");
    if (amountCents === 0 && lineTotal === 0) return setError("Amount or line items required");

    // If lines are provided, require they sum to amountCents (unless amount is blank)
    const validLines = lines.filter((l) => l.amount_dollars && parseFloat(l.amount_dollars) !== 0);
    if (validLines.length > 0 && amountCents !== 0 && lineTotal !== amountCents) {
      return setError(
        `Line items total (${formatCents(lineTotal)}) must equal amount (${formatCents(amountCents)}). Remove lines or adjust.`
      );
    }

    setSaving(true);
    try {
      const finalAmount = amountCents > 0 ? amountCents : lineTotal;
      const res = await fetch(`/api/jobs/${params.id}/change-orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          amount: finalAmount,
          gc_fee_rate: effectiveRate,
          estimated_days_added: parseInt(days) || 0,
          co_type: coType,
          source_invoice_id: sourceInvoiceId,
          submit_for_approval: submit,
          lines: validLines.map((l) => ({
            budget_line_id: l.budget_line_id || null,
            cost_code: l.cost_code || null,
            description: l.description || null,
            amount: Math.round((parseFloat(l.amount_dollars) || 0) * 100),
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      router.push(`/jobs/${params.id}/change-orders`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
      setSaving(false);
    }
  }

  function addLine() {
    setLines([...lines, { budget_line_id: "", cost_code: "", description: "", amount_dollars: "" }]);
  }
  function removeLine(i: number) {
    setLines(lines.filter((_, idx) => idx !== i));
  }
  function updateLine(i: number, patch: Partial<CoLine>) {
    setLines(lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  if (!job) {
    return (
      <div className="min-h-screen">
        <NavBar />
        <main className="max-w-[1600px] mx-auto px-6 py-20 text-center">
          <div className="w-8 h-8 border-2 border-teal/30 border-t-teal animate-spin mx-auto" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <NavBar />
      <main className="max-w-3xl mx-auto px-4 md:px-6 py-8">
        <Breadcrumbs
          items={[
            { label: "Jobs", href: "/jobs" },
            { label: job.name, href: `/jobs/${job.id}` },
            { label: "Change Orders", href: `/jobs/${job.id}/change-orders` },
            { label: "New" },
          ]}
        />
        <h2 className="font-display text-2xl text-cream mb-6">New Change Order</h2>

        {sourceInvoiceId && (
          <div className="mb-6 border border-teal/40 bg-teal/5 px-4 py-3 text-sm text-cream">
            <p>
              Drafting from <Link href={`/invoices/${sourceInvoiceId}`} className="text-teal hover:underline">an invoice</Link>.
              Fields below are pre-filled — review before submitting.
            </p>
          </div>
        )}

        <form className="bg-brand-card border border-brand-border p-6 space-y-5">
          <div>
            <label className="text-[11px] font-medium text-cream-dim uppercase tracking-wider mb-1.5 block">
              Title
            </label>
            <input
              className="w-full px-3 py-2 bg-brand-surface border border-brand-border text-sm text-cream focus:outline-none focus:border-teal"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Upgrade kitchen appliances to Sub-Zero"
              required
            />
          </div>

          <div>
            <label className="text-[11px] font-medium text-cream-dim uppercase tracking-wider mb-1.5 block">
              Description (optional)
            </label>
            <textarea
              className="w-full px-3 py-2 bg-brand-surface border border-brand-border text-sm text-cream focus:outline-none focus:border-teal"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Scope, justification, etc."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-[11px] font-medium text-cream-dim uppercase tracking-wider mb-1.5 block">
                CO Type
              </label>
              <select
                className="w-full px-3 py-2 bg-brand-surface border border-brand-border text-sm text-cream focus:outline-none focus:border-teal"
                value={coType}
                onChange={(e) => setCoType(e.target.value as "owner" | "internal")}
              >
                <option value="owner">Owner (affects contract)</option>
                <option value="internal">Internal (budget-only)</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] font-medium text-cream-dim uppercase tracking-wider mb-1.5 block">
                Base Amount ($)
              </label>
              <input
                type="number"
                step="0.01"
                className="w-full px-3 py-2 bg-brand-surface border border-brand-border text-sm text-cream focus:outline-none focus:border-teal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Positive or negative"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-cream-dim uppercase tracking-wider mb-1.5 block">
                GC Fee
              </label>
              <select
                className="w-full px-3 py-2 bg-brand-surface border border-brand-border text-sm text-cream focus:outline-none focus:border-teal"
                value={rateOption}
                onChange={(e) => setRateOption(e.target.value as "default" | "18" | "0" | "custom")}
              >
                <option value="default">Default ({((job.gc_fee_percentage ?? 0.2) * 100).toFixed(0)}%)</option>
                <option value="18">18%</option>
                <option value="0">0% (No fee)</option>
                <option value="custom">Custom…</option>
              </select>
              {rateOption === "custom" && (
                <input
                  type="number"
                  step="0.1"
                  className="w-full mt-2 px-3 py-2 bg-brand-surface border border-brand-border text-sm text-cream focus:outline-none focus:border-teal"
                  value={customRate}
                  onChange={(e) => setCustomRate(e.target.value)}
                  placeholder="e.g. 15"
                />
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-medium text-cream-dim uppercase tracking-wider mb-1.5 block">
                Days Added
              </label>
              <input
                type="number"
                className="w-full px-3 py-2 bg-brand-surface border border-brand-border text-sm text-cream focus:outline-none focus:border-teal"
                value={days}
                onChange={(e) => setDays(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 bg-brand-surface border border-brand-border px-4 py-3">
            <div>
              <p className="text-[11px] text-cream-dim uppercase tracking-wider">Base</p>
              <p className="text-sm text-cream font-medium tabular-nums">{formatCents(amountCents)}</p>
            </div>
            <div>
              <p className="text-[11px] text-cream-dim uppercase tracking-wider">GC Fee ({(effectiveRate * 100).toFixed(1)}%)</p>
              <p className="text-sm text-cream font-medium tabular-nums">{formatCents(feeCents)}</p>
            </div>
            <div>
              <p className="text-[11px] text-cream-dim uppercase tracking-wider">Total</p>
              <p className="text-lg text-teal font-display tabular-nums">{formatCents(totalCents)}</p>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-medium text-cream-dim uppercase tracking-wider">
                Budget Line Allocations
              </label>
              <button
                type="button"
                onClick={addLine}
                className="text-[11px] text-teal hover:underline"
              >
                + Add line
              </button>
            </div>
            <p className="text-[11px] text-cream-dim mb-3">
              Which budget lines does this CO affect? On approval, each line&apos;s co_adjustments (and revised estimate) will reflect its amount. Totals must match the base amount, or leave empty for a contract-only CO.
            </p>
            <div className="space-y-2">
              {lines.map((l, i) => (
                <div key={i} className="grid grid-cols-[1.5fr_1fr_140px_auto] gap-2 items-start">
                  <select
                    className="px-2 py-1 bg-brand-surface border border-brand-border text-sm text-cream focus:outline-none focus:border-teal"
                    value={l.budget_line_id}
                    onChange={(e) => {
                      const bl = budgetLineById.get(e.target.value);
                      updateLine(i, {
                        budget_line_id: e.target.value,
                        cost_code: bl?.cost_codes?.code ?? l.cost_code,
                      });
                    }}
                  >
                    <option value="">Choose budget line…</option>
                    {budgetLines.map((bl) => (
                      <option key={bl.id} value={bl.id}>
                        {bl.cost_codes?.code} — {bl.cost_codes?.description}
                      </option>
                    ))}
                  </select>
                  <input
                    className="px-2 py-1 bg-brand-surface border border-brand-border text-sm text-cream focus:outline-none focus:border-teal"
                    placeholder="Description"
                    value={l.description}
                    onChange={(e) => updateLine(i, { description: e.target.value })}
                  />
                  <input
                    type="number"
                    step="0.01"
                    className="px-2 py-1 bg-brand-surface border border-brand-border text-sm text-cream focus:outline-none focus:border-teal"
                    placeholder="$ (+ or -)"
                    value={l.amount_dollars}
                    onChange={(e) => updateLine(i, { amount_dollars: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => removeLine(i)}
                    className="text-cream-dim hover:text-status-danger px-2"
                    aria-label="Remove"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            {lines.filter((l) => l.budget_line_id || parseFloat(l.amount_dollars)).length > 0 && (
              <p className={`text-[11px] mt-2 ${lineTotal === amountCents || amountCents === 0 ? "text-status-success" : "text-status-warning"}`}>
                Line total: {formatCents(lineTotal)} / {formatCents(amountCents)}
              </p>
            )}
          </div>

          {error && (
            <div className="border border-status-danger/40 bg-status-danger/5 px-4 py-2 text-sm text-status-danger">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-brand-border">
            <Link
              href={`/jobs/${params.id}/change-orders`}
              className="px-4 py-2 text-sm text-cream-dim hover:text-cream transition-colors"
            >
              Cancel
            </Link>
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSubmit(false)}
              className="px-4 py-2 border border-brand-border text-sm text-cream hover:bg-brand-surface disabled:opacity-60 transition-colors"
            >
              {saving ? "Saving…" : "Save as Draft"}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSubmit(true)}
              className="px-5 py-2 bg-teal hover:bg-teal-hover disabled:opacity-60 text-white text-sm font-medium transition-colors"
            >
              {saving ? "Saving…" : "Submit for Approval"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
