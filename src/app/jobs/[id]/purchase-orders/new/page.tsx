"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
            { label: "Purchase Orders", href: `/jobs/${job.id}/purchase-orders` },
            { label: "New" },
          ]}
        />
        <NwEyebrow tone="muted" className="mb-2">Job · Purchase Order</NwEyebrow>
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
          New Purchase Order
        </h2>

        <NwCard padding="lg"><form className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <NwEyebrow tone="muted" className="mb-1.5 block">Vendor</NwEyebrow>
              <select
                className="w-full px-3 py-2 text-sm focus:outline-none nw-input"
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
              <NwEyebrow tone="muted" className="mb-1.5 block">PO Number</NwEyebrow>
              <input
                className="w-full px-3 py-2 text-sm focus:outline-none nw-input"
                placeholder="Auto-generated (e.g. PO-001)"
                value={poNumber}
                onChange={(e) => setPoNumber(e.target.value)}
              />
            </div>
          </div>

          <div>
            <NwEyebrow tone="muted" className="mb-1.5 block">Description</NwEyebrow>
            <Textarea
              minRows={2}
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
            <label htmlFor="useLineItems" className="text-sm text-[color:var(--text-secondary)]">
              Use multiple line items (each tied to its own budget line)
            </label>
          </div>

          {!useLineItems ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <NwEyebrow tone="muted" className="mb-1.5 block">Budget Line</NwEyebrow>
                <select
                  className="w-full px-3 py-2 text-sm focus:outline-none nw-input"
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
                  <p className="text-[11px] text-[color:var(--text-secondary)] mt-1">
                    Remaining on this line: <span className="text-[color:var(--text-primary)] tabular-nums">{formatCents(selectedBudgetLineRemaining)}</span>
                  </p>
                )}
              </div>
              <div>
                <NwEyebrow tone="muted" className="mb-1.5 block">Amount ($)</NwEyebrow>
                <input
                  type="number"
                  step="0.01"
                  className="w-full px-3 py-2 text-sm focus:outline-none nw-input"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-2">
                <NwEyebrow tone="muted">Line Items</NwEyebrow>
                <button
                  type="button"
                  onClick={addLine}
                  className="text-[11px] text-[color:var(--nw-stone-blue)] hover:underline"
                >
                  + Add line
                </button>
              </div>
              <div className="space-y-2">
                {lineItems.map((li, i) => (
                  <div key={i} className="grid grid-cols-[1.5fr_1fr_120px_auto] gap-2 items-start">
                    <select
                      className="px-2 py-1 text-sm focus:outline-none nw-input"
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
                      className="px-2 py-1 text-sm focus:outline-none nw-input"
                      placeholder="Description"
                      value={li.description}
                      onChange={(e) => updateLine(i, { description: e.target.value })}
                    />
                    <input
                      type="number"
                      step="0.01"
                      className="px-2 py-1 text-sm focus:outline-none nw-input"
                      placeholder="$"
                      value={li.amount_dollars}
                      onChange={(e) => updateLine(i, { amount_dollars: e.target.value })}
                    />
                    <button
                      type="button"
                      onClick={() => removeLine(i)}
                      className="text-[color:var(--text-secondary)] hover:text-[color:var(--nw-danger)] px-2"
                      aria-label="Remove"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-[color:var(--text-secondary)] mt-2">
                Line total: <span className="text-[color:var(--text-primary)] tabular-nums">{formatCents(lineItemTotal)}</span>
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <NwEyebrow tone="muted" className="mb-1.5 block">Issued Date (optional)</NwEyebrow>
              <input
                type="date"
                className="w-full px-3 py-2 text-sm focus:outline-none nw-input"
                value={issuedDate}
                onChange={(e) => setIssuedDate(e.target.value)}
              />
            </div>
          </div>

          <div>
            <NwEyebrow tone="muted" className="mb-1.5 block">Notes</NwEyebrow>
            <Textarea
              minRows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div
            className="grid grid-cols-2 gap-3 border px-4 py-3"
            style={{ background: "var(--bg-subtle)", borderColor: "var(--border-default)" }}
          >
            <div className="flex flex-col gap-1">
              <NwEyebrow tone="accent">Total</NwEyebrow>
              <NwMoney cents={effectiveAmount} size="lg" variant="emphasized" />
            </div>
            {selectedBudgetLineRemaining !== null && !useLineItems && effectiveAmount > selectedBudgetLineRemaining && (
              <div className="flex flex-col gap-1">
                <NwEyebrow tone="warn">Exceeds remaining budget</NwEyebrow>
                <NwMoney cents={effectiveAmount - selectedBudgetLineRemaining} size="md" prefix="by $" />
              </div>
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
              href={`/jobs/${params.id}/purchase-orders`}
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
              onClick={(e) => handleSubmit(e as unknown as React.FormEvent, "draft")}
              loading={saving}
            >
              {saving ? "Saving" : "Save as Draft"}
            </NwButton>
            <NwButton
              type="button"
              variant="primary"
              size="md"
              disabled={saving}
              onClick={(e) => handleSubmit(e as unknown as React.FormEvent, "issued")}
              loading={saving}
            >
              {saving ? "Saving" : "Issue PO"}
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
