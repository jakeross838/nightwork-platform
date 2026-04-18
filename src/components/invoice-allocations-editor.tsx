"use client";

import { useEffect, useMemo, useState } from "react";
import { formatCents } from "@/lib/utils/format";

type CostCode = { id: string; code: string; description: string };

type Allocation = {
  id?: string;
  cost_code_id: string | null;
  amount_cents: number;
  description: string | null;
};

export default function InvoiceAllocationsEditor({
  invoiceId,
  invoiceTotalCents,
  costCodes,
  readOnly,
  onChange,
}: {
  invoiceId: string;
  invoiceTotalCents: number;
  costCodes: CostCode[];
  readOnly?: boolean;
  onChange?: () => void;
}) {
  const [rows, setRows] = useState<Allocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [autoCreated, setAutoCreated] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/invoices/${invoiceId}/allocations`);
    const data = await res.json();
    setRows(data.allocations ?? []);
    setAutoCreated(!!data.auto_created);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId]);

  const sum = useMemo(
    () => rows.reduce((s, r) => s + Math.round(r.amount_cents || 0), 0),
    [rows]
  );
  const balanced = sum === invoiceTotalCents;
  const anyCostCodeMissing = rows.some((r) => !r.cost_code_id);

  function updateRow(i: number, patch: Partial<Allocation>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function addRow() {
    const remaining = Math.max(0, invoiceTotalCents - sum);
    setRows((prev) => [
      ...prev,
      {
        cost_code_id: null,
        amount_cents: remaining,
        description: null,
      },
    ]);
  }
  function removeRow(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function save() {
    if (!balanced) {
      setError(`Rows sum to ${formatCents(sum)} but invoice total is ${formatCents(invoiceTotalCents)}.`);
      return;
    }
    if (anyCostCodeMissing) {
      setError("Every allocation must have a cost code.");
      return;
    }
    setSaving(true);
    setError(null);
    setLocked(false);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/allocations`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          allocations: rows.map((r) => ({
            cost_code_id: r.cost_code_id,
            amount_cents: Math.round(r.amount_cents || 0),
            description: r.description,
          })),
        }),
      });
      const data = await res.json();
      if (res.status === 409) {
        setLocked(true);
        setError(data.error ?? "Cannot edit: this invoice is on a submitted draw.");
        return;
      }
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      await load();
      onChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="text-xs text-tertiary py-2">Loading allocations...</div>;
  }

  const canEdit = !readOnly && !locked;

  return (
    <div className="mt-3 border border-border-def bg-bg-sub/30 p-3">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h4 className="text-sm font-medium text-slate-tile">Allocations</h4>
          <p className="text-[11px] text-tertiary">
            Split this invoice across multiple cost codes. Sum must equal the invoice total.
            {autoCreated && " (Auto-created from invoice-level cost code \u2014 edit to split.)"}
          </p>
        </div>
        {canEdit && (
          <button
            onClick={addRow}
            disabled={saving}
            className="text-xs px-2 py-1 border border-stone-blue text-stone-blue hover:bg-stone-blue/10"
          >
            + Split row
          </button>
        )}
      </div>

      {locked && (
        <div className="mb-2 text-[11px] text-nw-warn border border-nw-warn/40 bg-nw-warn/5 px-2 py-1">
          Cannot edit: this invoice is on a submitted draw.
        </div>
      )}

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wider text-tertiary border-b border-border-def">
            <th className="py-1 pr-2">Cost code</th>
            <th className="py-1 pr-2">Description</th>
            <th className="py-1 pr-2 text-right">Amount ($)</th>
            <th className="py-1" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-border-sub last:border-0">
              <td className="py-1 pr-2">
                <select
                  className={`input text-xs${!r.cost_code_id ? " border-nw-danger/60" : ""}`}
                  value={r.cost_code_id ?? ""}
                  onChange={(e) => updateRow(i, { cost_code_id: e.target.value || null })}
                  disabled={!canEdit}
                >
                  <option value="">-- select cost code --</option>
                  {costCodes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} \u2014 {c.description}
                    </option>
                  ))}
                </select>
              </td>
              <td className="py-1 pr-2">
                <input
                  className="input text-xs"
                  value={r.description ?? ""}
                  onChange={(e) => updateRow(i, { description: e.target.value })}
                  disabled={!canEdit}
                  placeholder="Optional note"
                />
              </td>
              <td className="py-1 pr-2">
                <input
                  type="number"
                  step="0.01"
                  className="input text-xs text-right"
                  value={(r.amount_cents / 100).toFixed(2)}
                  onChange={(e) =>
                    updateRow(i, { amount_cents: Math.round((parseFloat(e.target.value) || 0) * 100) })
                  }
                  disabled={!canEdit}
                />
              </td>
              <td className="py-1 text-right">
                {canEdit && rows.length > 1 && (
                  <button
                    onClick={() => removeRow(i)}
                    className="text-[11px] text-nw-danger hover:underline"
                  >
                    Remove
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-border-def">
            <td className="py-1 pr-2 text-[11px] text-tertiary uppercase tracking-wider">Total</td>
            <td />
            <td className="py-1 pr-2 text-right font-medium">
              <span className={balanced ? "text-stone-blue" : "text-nw-danger"}>
                {formatCents(sum)}
              </span>
              <span className="text-tertiary"> / {formatCents(invoiceTotalCents)}</span>
            </td>
            <td />
          </tr>
        </tfoot>
      </table>

      {error && (
        <div className="mt-2 border border-nw-danger/40 bg-nw-danger/5 px-2 py-1 text-xs text-nw-danger">
          {error}
        </div>
      )}

      {canEdit && (
        <div className="mt-2 flex items-center gap-2">
          <button
            onClick={save}
            disabled={saving || !balanced || anyCostCodeMissing}
            className="px-3 py-1 bg-slate-deep text-white text-xs font-medium hover:bg-stone-blue/90 disabled:opacity-60"
            title={
              anyCostCodeMissing
                ? "Every allocation needs a cost code"
                : !balanced
                  ? "Allocations must sum to the invoice total"
                  : ""
            }
          >
            {saving ? "Saving..." : "Save allocations"}
          </button>
          {!balanced && (
            <span className="text-[11px] text-nw-danger">
              {sum > invoiceTotalCents
                ? `Over by ${formatCents(sum - invoiceTotalCents)}`
                : `Under by ${formatCents(invoiceTotalCents - sum)}`}
            </span>
          )}
          {anyCostCodeMissing && balanced && (
            <span className="text-[11px] text-nw-danger">
              Assign a cost code to every row
            </span>
          )}
        </div>
      )}

      <style jsx>{`
        .input {
          width: 100%;
          padding: 0.25rem 0.5rem;
          background: var(--bg-subtle, #f5f5f5);
          border: 1px solid var(--border-default, #e8e8e8);
          color: var(--text-primary);
        }
        .input:focus {
          outline: none;
          border-color: var(--org-primary);
        }
      `}</style>
    </div>
  );
}
