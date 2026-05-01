"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Breadcrumbs from "@/components/breadcrumbs";
import { supabase } from "@/lib/supabase/client";
import { formatCents } from "@/lib/utils/format";
import NwCard from "@/components/nw/Card";
import NwEyebrow from "@/components/nw/Eyebrow";
import NwButton from "@/components/nw/Button";
import NwMoney from "@/components/nw/Money";
import { Textarea } from "@/components/ui/textarea";

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

type CoType =
  | "owner_requested"
  | "designer_architect"
  | "allowance_overage"
  | "site_condition"
  | "internal";

const CO_TYPE_OPTIONS: { value: CoType; label: string }[] = [
  { value: "owner_requested", label: "Owner Request (affects contract)" },
  { value: "designer_architect", label: "Designer / Architect (affects contract)" },
  { value: "allowance_overage", label: "Allowance Overage (affects contract)" },
  { value: "site_condition", label: "Site Condition (affects contract)" },
  { value: "internal", label: "Internal (budget-only)" },
];

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
  const [coType, setCoType] = useState<CoType>("owner_requested");
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
      <main className="max-w-[1600px] mx-auto px-6 py-20 text-center">
        <div className="w-8 h-8 border-2 border-[rgba(91,134,153,0.3)] border-t-[var(--nw-stone-blue)] animate-spin mx-auto" />
      </main>
    );
  }

  return (
      <main className="max-w-3xl mx-auto px-4 md:px-6 py-8">
        <Breadcrumbs
          items={[
            { label: "Jobs", href: "/jobs" },
            { label: job.name, href: `/jobs/${job.id}` },
            { label: "Change Orders", href: `/jobs/${job.id}/change-orders` },
            { label: "New" },
          ]}
        />
        <NwEyebrow tone="muted" className="mb-2">Job · Change Order</NwEyebrow>
        <h2
          className="m-0 mb-6"
          style={{
            fontFamily: "var(--font-space-grotesk)",
            fontWeight: 500,
            fontSize: "30px",
            letterSpacing: "-0.02em",
            color: "var(--text-primary)",
          }}
        >
          New Change Order
        </h2>

        {sourceInvoiceId && (
          <div
            className="mb-6 border px-4 py-3 text-sm"
            style={{
              borderColor: "var(--nw-stone-blue)",
              background: "rgba(91,134,153,0.06)",
              color: "var(--text-primary)",
            }}
          >
            <p>
              Drafting from <Link href={`/invoices/${sourceInvoiceId}`} className="hover:underline" style={{ color: "var(--nw-gulf-blue)" }}>an invoice</Link>.
              Fields below are pre-filled — review before submitting.
            </p>
          </div>
        )}

        <NwCard padding="lg" className="space-y-5"><form className="space-y-5">
          <div>
            <NwEyebrow tone="muted" className="mb-1.5 block">Title</NwEyebrow>
            <input
              className="w-full px-3 py-2 text-sm focus:outline-none nw-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Upgrade kitchen appliances to Sub-Zero"
              required
            />
          </div>

          <div>
            <NwEyebrow tone="muted" className="mb-1.5 block">Description (optional)</NwEyebrow>
            <Textarea
              minRows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Scope, justification, etc."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <NwEyebrow tone="muted" className="mb-1.5 block">CO Type</NwEyebrow>
              <select
                className="w-full px-3 py-2 text-sm focus:outline-none nw-input"
                value={coType}
                onChange={(e) => setCoType(e.target.value as CoType)}
              >
                {CO_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <NwEyebrow tone="muted" className="mb-1.5 block">Base Amount ($)</NwEyebrow>
              <input
                type="number"
                step="0.01"
                className="w-full px-3 py-2 text-sm focus:outline-none nw-input"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Positive or negative"
              />
            </div>
            <div>
              <NwEyebrow tone="muted" className="mb-1.5 block">GC Fee</NwEyebrow>
              <select
                className="w-full px-3 py-2 text-sm focus:outline-none nw-input"
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
                  className="w-full mt-2 px-3 py-2 bg-[var(--bg-subtle)] border border-[var(--border-default)] text-sm text-[color:var(--text-primary)] focus:outline-none focus:border-[var(--nw-stone-blue)]"
                  value={customRate}
                  onChange={(e) => setCustomRate(e.target.value)}
                  placeholder="e.g. 15"
                />
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <NwEyebrow tone="muted" className="mb-1.5 block">Days Added</NwEyebrow>
              <input
                type="number"
                className="w-full px-3 py-2 text-sm focus:outline-none nw-input"
                value={days}
                onChange={(e) => setDays(e.target.value)}
              />
            </div>
          </div>

          <div
            className="grid grid-cols-3 gap-3 border px-4 py-3"
            style={{ background: "var(--bg-subtle)", borderColor: "var(--border-default)" }}
          >
            <div className="flex flex-col gap-1">
              <NwEyebrow tone="muted">Base</NwEyebrow>
              <NwMoney cents={amountCents} size="md" />
            </div>
            <div className="flex flex-col gap-1">
              <NwEyebrow tone="muted">GC Fee ({(effectiveRate * 100).toFixed(1)}%)</NwEyebrow>
              <NwMoney cents={feeCents} size="md" />
            </div>
            <div className="flex flex-col gap-1">
              <NwEyebrow tone="accent">Total</NwEyebrow>
              <NwMoney cents={totalCents} size="lg" variant="emphasized" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <NwEyebrow tone="muted">Budget Line Allocations</NwEyebrow>
              <button
                type="button"
                onClick={addLine}
                className="text-[11px] hover:underline"
                style={{ color: "var(--nw-gulf-blue)" }}
              >
                + Add line
              </button>
            </div>
            <p className="text-[11px] mb-3" style={{ color: "var(--text-tertiary)" }}>
              Which budget lines does this CO affect? On approval, each line&apos;s co_adjustments (and revised estimate) will reflect its amount. Totals must match the base amount, or leave empty for a contract-only CO.
            </p>
            <div className="space-y-2">
              {lines.map((l, i) => (
                <div key={i} className="grid grid-cols-[1.5fr_1fr_140px_auto] gap-2 items-start">
                  <select
                    className="px-2 py-1 text-sm focus:outline-none nw-input"
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
                    className="px-2 py-1 text-sm focus:outline-none nw-input"
                    placeholder="Description"
                    value={l.description}
                    onChange={(e) => updateLine(i, { description: e.target.value })}
                  />
                  <input
                    type="number"
                    step="0.01"
                    className="px-2 py-1 text-sm focus:outline-none nw-input"
                    placeholder="$ (+ or -)"
                    value={l.amount_dollars}
                    onChange={(e) => updateLine(i, { amount_dollars: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => removeLine(i)}
                    className="px-2"
                    style={{ color: "var(--text-tertiary)" }}
                    aria-label="Remove"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            {lines.filter((l) => l.budget_line_id || parseFloat(l.amount_dollars)).length > 0 && (
              <p
                className="text-[11px] mt-2"
                style={{
                  color: lineTotal === amountCents || amountCents === 0 ? "var(--nw-success)" : "var(--nw-warn)",
                }}
              >
                Line total: {formatCents(lineTotal)} / {formatCents(amountCents)}
              </p>
            )}
          </div>

          {error && (
            <div
              className="border px-4 py-2 text-sm"
              style={{
                borderColor: "var(--nw-danger)",
                background: "rgba(176,85,78,0.05)",
                color: "var(--nw-danger)",
              }}
            >
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t" style={{ borderColor: "var(--border-default)" }}>
            <Link
              href={`/jobs/${params.id}/change-orders`}
              className="px-4 py-2 text-sm transition-colors"
              style={{ color: "var(--text-tertiary)" }}
            >
              Cancel
            </Link>
            <NwButton
              type="button"
              variant="secondary"
              size="md"
              disabled={saving}
              onClick={() => handleSubmit(false)}
              loading={saving}
            >
              {saving ? "Saving" : "Save as Draft"}
            </NwButton>
            <NwButton
              type="button"
              variant="primary"
              size="md"
              disabled={saving}
              onClick={() => handleSubmit(true)}
              loading={saving}
            >
              {saving ? "Saving" : "Submit for Approval"}
            </NwButton>
          </div>
        </form>
        </NwCard>
        <style jsx>{`
          :global(.nw-input) {
            background: var(--bg-subtle);
            border: 1px solid var(--border-default);
            color: var(--text-primary);
          }
          :global(.nw-input:focus) {
            border-color: var(--nw-stone-blue);
          }
        `}</style>
      </main>
  );
}
