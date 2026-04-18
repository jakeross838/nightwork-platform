"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Breadcrumbs from "@/components/breadcrumbs";
import { supabase } from "@/lib/supabase/client";
import { formatCents } from "@/lib/utils/format";

interface Job {
  id: string;
  name: string;
}
interface Vendor {
  id: string;
  name: string;
}
interface BudgetLineRow {
  id: string;
  cost_code_id: string | null;
  revised_estimate: number;
  committed: number;
  invoiced: number;
  cost_codes: { code: string; description: string } | null;
}
interface LineItem {
  budget_line_id: string;
  cost_code: string;
  description: string;
  amount_dollars: string;
}

export default function NewPurchaseOrderPage({ params }: { params: { id: string } }) {
  const router = useRouter();

  const [job, setJob] = useState<Job | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [budgetLines, setBudgetLines] = useState<BudgetLineRow[]>([]);

  const [vendorId, setVendorId] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [budgetLineId, setBudgetLineId] = useState("");
  const [issuedDate, setIssuedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [useLineItems, setUseLineItems] = useState(false);
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { budget_line_id: "", cost_code: "", description: "", amount_dollars: "" },
  ]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace(`/login?redirect=/jobs/${params.id}/purchase-orders/new`); return; }

      const [jRes, vRes, blRes] = await Promise.all([
        supabase.from("jobs").select("id, name").eq("id", params.id).is("deleted_at", null).single(),
        supabase.from("vendors").select("id, name").is("deleted_at", null).order("name"),
        supabase
          .from("budget_lines")
          .select("id, cost_code_id, revised_estimate, committed, invoiced, cost_codes:cost_code_id(code, description)")
          .eq("job_id", params.id)
          .is("deleted_at", null),
      ]);

      if (jRes.data) setJob(jRes.data as Job);
      if (vRes.data) setVendors(vRes.data as Vendor[]);
      if (blRes.data) setBudgetLines(blRes.data as unknown as BudgetLineRow[]);
    }
    load();
  }, [params.id, router]);

  const budgetLineById = useMemo(() => {
    const m = new Map<string, BudgetLineRow>();
    for (const bl of budgetLines) m.set(bl.id, bl);
    return m;
  }, [budgetLines]);

  const amountCents = useMemo(() => {
    const d = parseFloat(amount);
    return isNaN(d) ? 0 : Math.round(d * 100);
  }, [amount]);

  const lineItemTotal = useMemo(() => {
    return lineItems.reduce((s, li) => {
      const d = parseFloat(li.amount_dollars);
      return s + (isNaN(d) ? 0 : Math.round(d * 100));
    }, 0);
  }, [lineItems]);

  const effectiveAmount = useLineItems ? lineItemTotal : amountCents;

  const selectedBudgetLineRemaining = useMemo(() => {
    if (!budgetLineId) return null;
    const bl = budgetLineById.get(budgetLineId);
    if (!bl) return null;
    return bl.revised_estimate - bl.committed;
  }, [budgetLineId, budgetLineById]);

  async function handleSubmit(e: React.FormEvent, statusIfValid: "draft" | "issued") {
    e.preventDefault();
    setError(null);
    if (effectiveAmount <= 0) return setError("Amount must be greater than zero");

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        vendor_id: vendorId || null,
        po_number: poNumber || undefined,
        description: description || undefined,
        amount: useLineItems ? lineItemTotal : amountCents,
        budget_line_id: useLineItems ? null : (budgetLineId || null),
        cost_code_id: null,
        issued_date: issuedDate || null,
        notes: notes || null,
        status: statusIfValid,
      };
      if (useLineItems) {
        body.line_items = lineItems
          .filter((li) => parseFloat(li.amount_dollars) > 0 || li.description)
          .map((li, idx) => ({
            budget_line_id: li.budget_line_id || null,
            cost_code: li.cost_code || null,
            description: li.description || null,
            amount: Math.round((parseFloat(li.amount_dollars) || 0) * 100),
            sort_order: idx,
          }));
      }

      const res = await fetch(`/api/jobs/${params.id}/purchase-orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      router.push(`/purchase-orders/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
      setSaving(false);
    }
  }

  function addLine() {
    setLineItems([...lineItems, { budget_line_id: "", cost_code: "", description: "", amount_dollars: "" }]);
  }
  function removeLine(i: number) {
    setLineItems(lineItems.filter((_, idx) => idx !== i));
  }
  function updateLine(i: number, patch: Partial<LineItem>) {
    setLineItems(lineItems.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  if (!job) {
    return (
      <main className="max-w-[1600px] mx-auto px-6 py-20 text-center">
        <div className="w-8 h-8 border-2 border-stone-blue/30 border-t-teal animate-spin mx-auto" />
      </main>
    );
  }

  return (
      <main className="max-w-3xl mx-auto px-4 md:px-6 py-8">
        <Breadcrumbs
          items={[
            { label: "Jobs", href: "/jobs" },
            { label: job.name, href: `/jobs/${job.id}` },
            { label: "Purchase Orders", href: `/jobs/${job.id}/purchase-orders` },
            { label: "New" },
          ]}
        />
        <h2 className="font-display text-2xl text-slate-tile mb-6">New Purchase Order</h2>

        <form className="bg-white border border-border-def p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-medium text-tertiary uppercase tracking-wider mb-1.5 block">
                Vendor
              </label>
              <select
                className="w-full px-3 py-2 bg-bg-sub border border-border-def text-sm text-slate-tile focus:outline-none focus:border-stone-blue"
                value={vendorId}
                onChange={(e) => setVendorId(e.target.value)}
              >
                <option value="">Select vendor…</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-medium text-tertiary uppercase tracking-wider mb-1.5 block">
                PO Number
              </label>
              <input
                className="w-full px-3 py-2 bg-bg-sub border border-border-def text-sm text-slate-tile focus:outline-none focus:border-stone-blue"
                placeholder="Auto-generated (e.g. PO-001)"
                value={poNumber}
                onChange={(e) => setPoNumber(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-medium text-tertiary uppercase tracking-wider mb-1.5 block">
              Description
            </label>
            <textarea
              className="w-full px-3 py-2 bg-bg-sub border border-border-def text-sm text-slate-tile focus:outline-none focus:border-stone-blue"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Framing labor — Phase 1"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="useLineItems"
              checked={useLineItems}
              onChange={(e) => setUseLineItems(e.target.checked)}
              className="accent-teal"
            />
            <label htmlFor="useLineItems" className="text-sm text-tertiary">
              Use multiple line items (each tied to its own budget line)
            </label>
          </div>

          {!useLineItems ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-medium text-tertiary uppercase tracking-wider mb-1.5 block">
                  Budget Line
                </label>
                <select
                  className="w-full px-3 py-2 bg-bg-sub border border-border-def text-sm text-slate-tile focus:outline-none focus:border-stone-blue"
                  value={budgetLineId}
                  onChange={(e) => setBudgetLineId(e.target.value)}
                >
                  <option value="">Select budget line…</option>
                  {budgetLines.map((bl) => (
                    <option key={bl.id} value={bl.id}>
                      {bl.cost_codes?.code} — {bl.cost_codes?.description}
                    </option>
                  ))}
                </select>
                {selectedBudgetLineRemaining !== null && (
                  <p className="text-[11px] text-tertiary mt-1">
                    Remaining on this line: <span className="text-slate-tile tabular-nums">{formatCents(selectedBudgetLineRemaining)}</span>
                  </p>
                )}
              </div>
              <div>
                <label className="text-[11px] font-medium text-tertiary uppercase tracking-wider mb-1.5 block">
                  Amount ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full px-3 py-2 bg-bg-sub border border-border-def text-sm text-slate-tile focus:outline-none focus:border-stone-blue"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[11px] font-medium text-tertiary uppercase tracking-wider">
                  Line Items
                </label>
                <button
                  type="button"
                  onClick={addLine}
                  className="text-[11px] text-stone-blue hover:underline"
                >
                  + Add line
                </button>
              </div>
              <div className="space-y-2">
                {lineItems.map((li, i) => (
                  <div key={i} className="grid grid-cols-[1.5fr_1fr_120px_auto] gap-2 items-start">
                    <select
                      className="px-2 py-1 bg-bg-sub border border-border-def text-sm text-slate-tile focus:outline-none focus:border-stone-blue"
                      value={li.budget_line_id}
                      onChange={(e) => {
                        const bl = budgetLineById.get(e.target.value);
                        updateLine(i, {
                          budget_line_id: e.target.value,
                          cost_code: bl?.cost_codes?.code ?? li.cost_code,
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
                      className="px-2 py-1 bg-bg-sub border border-border-def text-sm text-slate-tile focus:outline-none focus:border-stone-blue"
                      placeholder="Description"
                      value={li.description}
                      onChange={(e) => updateLine(i, { description: e.target.value })}
                    />
                    <input
                      type="number"
                      step="0.01"
                      className="px-2 py-1 bg-bg-sub border border-border-def text-sm text-slate-tile focus:outline-none focus:border-stone-blue"
                      placeholder="$"
                      value={li.amount_dollars}
                      onChange={(e) => updateLine(i, { amount_dollars: e.target.value })}
                    />
                    <button
                      type="button"
                      onClick={() => removeLine(i)}
                      className="text-tertiary hover:text-nw-danger px-2"
                      aria-label="Remove"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-tertiary mt-2">
                Line total: <span className="text-slate-tile tabular-nums">{formatCents(lineItemTotal)}</span>
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-medium text-tertiary uppercase tracking-wider mb-1.5 block">
                Issued Date (optional)
              </label>
              <input
                type="date"
                className="w-full px-3 py-2 bg-bg-sub border border-border-def text-sm text-slate-tile focus:outline-none focus:border-stone-blue"
                value={issuedDate}
                onChange={(e) => setIssuedDate(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-medium text-tertiary uppercase tracking-wider mb-1.5 block">
              Notes
            </label>
            <textarea
              className="w-full px-3 py-2 bg-bg-sub border border-border-def text-sm text-slate-tile focus:outline-none focus:border-stone-blue"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 bg-bg-sub border border-border-def px-4 py-3">
            <div>
              <p className="text-[11px] text-tertiary uppercase tracking-wider">Total</p>
              <p className="text-lg text-stone-blue font-display tabular-nums">{formatCents(effectiveAmount)}</p>
            </div>
            {selectedBudgetLineRemaining !== null && !useLineItems && effectiveAmount > selectedBudgetLineRemaining && (
              <div>
                <p className="text-[11px] text-nw-warn uppercase tracking-wider">Exceeds remaining budget</p>
                <p className="text-sm text-nw-warn tabular-nums">
                  by {formatCents(effectiveAmount - selectedBudgetLineRemaining)}
                </p>
              </div>
            )}
          </div>

          {error && (
            <div className="border border-nw-danger/40 bg-nw-danger/5 px-4 py-2 text-sm text-nw-danger">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border-def">
            <Link
              href={`/jobs/${params.id}/purchase-orders`}
              className="px-4 py-2 text-sm text-tertiary hover:text-slate-tile transition-colors"
            >
              Cancel
            </Link>
            <button
              type="button"
              disabled={saving}
              onClick={(e) => handleSubmit(e, "draft")}
              className="px-4 py-2 border border-border-def text-sm text-slate-tile hover:bg-bg-sub disabled:opacity-60 transition-colors"
            >
              {saving ? "Saving…" : "Save as Draft"}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={(e) => handleSubmit(e, "issued")}
              className="px-5 py-2 bg-slate-deep hover:bg-slate-deeper disabled:opacity-60 text-white text-sm font-medium transition-colors"
            >
              {saving ? "Saving…" : "Issue PO"}
            </button>
          </div>
        </form>
      </main>
  );
}
