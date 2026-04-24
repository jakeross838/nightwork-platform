"use client";

import { useEffect, useMemo, useState } from "react";
import { formatCents } from "@/lib/utils/format";
import NwButton from "@/components/nw/Button";
import NwEyebrow from "@/components/nw/Eyebrow";
import NwMoney from "@/components/nw/Money";

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
  const [initialSnapshot, setInitialSnapshot] = useState<string>("[]");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [autoCreated, setAutoCreated] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/invoices/${invoiceId}/allocations`);
    const data = await res.json();
    const loaded: Allocation[] = data.allocations ?? [];
    setRows(loaded);
    setInitialSnapshot(JSON.stringify(loaded));
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
  const isDirty = JSON.stringify(rows) !== initialSnapshot;

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
    return <div className="text-xs text-[color:var(--text-secondary)] py-2">Loading allocations...</div>;
  }

  const canEdit = !readOnly && !locked;

  return (
    <div
      className="mt-2 border px-4 py-3"
      style={{
        background: "var(--bg-subtle)",
        borderColor: "var(--border-default)",
      }}
    >
      <div className="flex items-center justify-between mb-2 gap-3">
        <div className="min-w-0">
          <NwEyebrow tone="default">Allocations</NwEyebrow>
          <p
            className="text-[11px] mt-0.5"
            style={{ color: "var(--text-secondary)" }}
          >
            Split this invoice across multiple cost codes. Sum must equal the invoice total.
            {autoCreated && " (Auto-created from invoice-level cost code \u2014 edit to split.)"}
          </p>
        </div>
        {canEdit && (
          <NwButton variant="secondary" size="sm" onClick={addRow} disabled={saving}>
            + Split row
          </NwButton>
        )}
      </div>

      {locked && (
        <div className="mb-2 text-[11px] text-[color:var(--nw-warn)] border border-[rgba(201,138,59,0.35)] bg-[rgba(201,138,59,0.08)] px-2 py-1">
          Cannot edit: this invoice is on a submitted draw.
        </div>
      )}

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left border-b" style={{ borderColor: "var(--border-default)" }}>
            <th className="py-1.5 pr-2">
              <NwEyebrow tone="muted">Cost code</NwEyebrow>
            </th>
            <th className="py-1.5 pr-2">
              <NwEyebrow tone="muted">Description</NwEyebrow>
            </th>
            <th className="py-1.5 pr-2 text-right">
              <NwEyebrow tone="muted">Amount ($)</NwEyebrow>
            </th>
            <th className="py-1" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-[var(--border-default)] last:border-0">
              <td className="py-1 pr-2">
                <select
                  className={`input text-xs${!r.cost_code_id ? " border-[rgba(176,85,78,0.55)]" : ""}`}
                  value={r.cost_code_id ?? ""}
                  onChange={(e) => updateRow(i, { cost_code_id: e.target.value || null })}
                  disabled={!canEdit}
                >
                  <option value="">-- select cost code --</option>
                  {costCodes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.description}
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
                    className="text-[11px] text-[color:var(--nw-danger)] hover:underline"
                  >
                    Remove
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2" style={{ borderColor: "var(--border-strong)" }}>
            <td className="py-2 pr-2">
              <NwEyebrow tone="default">Total</NwEyebrow>
            </td>
            <td />
            <td className="py-2 pr-2 text-right">
              <NwMoney
                cents={sum}
                variant={balanced ? "emphasized" : "negative"}
                size="md"
              />
              <span style={{ color: "var(--text-tertiary)", marginLeft: "4px" }}>
                / <NwMoney cents={invoiceTotalCents} variant="muted" size="md" />
              </span>
            </td>
            <td />
          </tr>
        </tfoot>
      </table>

      {error && (
        <div className="mt-2 border border-[rgba(176,85,78,0.35)] bg-[rgba(176,85,78,0.08)] px-2 py-1 text-xs text-[color:var(--nw-danger)]">
          {error}
        </div>
      )}

      {canEdit && (isDirty || !balanced || anyCostCodeMissing) && (
        <div className="mt-2 flex items-center gap-3 flex-wrap">
          <NwButton
            variant="primary"
            size="sm"
            onClick={save}
            disabled={saving || !balanced || anyCostCodeMissing}
            loading={saving}
            title={
              anyCostCodeMissing
                ? "Every allocation needs a cost code"
                : !balanced
                  ? "Allocations must sum to the invoice total"
                  : ""
            }
          >
            Save allocations
          </NwButton>
          {!balanced && (
            <span className="text-[11px]" style={{ color: "var(--nw-danger)" }}>
              {sum > invoiceTotalCents
                ? `Over by ${formatCents(sum - invoiceTotalCents)}`
                : `Under by ${formatCents(invoiceTotalCents - sum)}`}
            </span>
          )}
          {anyCostCodeMissing && balanced && (
            <span className="text-[11px]" style={{ color: "var(--nw-danger)" }}>
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
          border-color: var(--nw-stone-blue);
        }
        /* Match globals.css input:disabled. styled-jsx scopes .input
           with an auto-attribute that boosts its specificity above
           bare element+:disabled, so we repeat the rule here for
           parity. Same tokens, both themes. */
        .input:disabled {
          background: var(--bg-muted);
          color: var(--text-tertiary);
          border-color: var(--border-subtle);
          opacity: 0.7;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
