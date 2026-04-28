"use client";

import { useState } from "react";
import NwButton from "@/components/nw/Button";

/**
 * Phase 3.4 Issue 2 — payment schedule editor.
 *
 * Extracted from the inline PaymentScheduleSection in ReviewManager.tsx.
 * Renders milestone rows of (milestone, percentage_pct, amount_cents,
 * trigger). `entries === null` means "single payment / no milestones
 * on the proposal"; `entries === []` means "milestone table existed
 * but PM emptied it" — both are persisted distinctly so the commit
 * route can preserve vendor intent.
 *
 * Self-contained: declares PaymentScheduleEntryForm + private
 * FormField + cents helpers locally.
 */

export interface PaymentScheduleEntryForm {
  milestone: string;
  percentage_pct: number | null;
  amount_cents: number | null;
  trigger: string | null;
}

interface Props {
  entries: PaymentScheduleEntryForm[] | null;
  onChange: (next: PaymentScheduleEntryForm[] | null) => void;
}

export default function ProposalPaymentScheduleSection({
  entries,
  onChange,
}: Props) {
  const [open, setOpen] = useState(entries !== null && entries.length > 0);
  const list = entries ?? [];
  const addRow = () =>
    onChange([
      ...list,
      { milestone: "", percentage_pct: null, amount_cents: null, trigger: null },
    ]);
  const removeRow = (idx: number) => {
    const next = list.slice();
    next.splice(idx, 1);
    onChange(next.length === 0 ? null : next);
  };
  const updateRow = (
    idx: number,
    patch: Partial<PaymentScheduleEntryForm>
  ) => {
    const next = list.slice();
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  };

  return (
    <section className="rounded border border-[var(--border-default)] bg-[var(--bg-card)] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setOpen((s) => !s)}
          className="text-sm font-semibold text-[color:var(--text-primary)] hover:underline"
        >
          {open ? "▼" : "▶"} Payment schedule ({list.length})
        </button>
        {open && (
          <NwButton variant="ghost" size="sm" onClick={addRow}>
            + Add milestone
          </NwButton>
        )}
      </div>
      {open && (
        <>
          {list.length === 0 ? (
            <p className="text-xs text-[color:var(--text-tertiary)]">
              No milestones extracted. Add a row if the proposal specifies
              multi-step billing (e.g., 50% deposit + 50% on completion).
            </p>
          ) : (
            <div className="space-y-2">
              {list.map((row, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-12 gap-2 rounded border border-[var(--border-default)] p-2"
                >
                  <div className="col-span-3">
                    <FormField label="Milestone">
                      <input
                        className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1 text-sm text-[color:var(--text-primary)]"
                        value={row.milestone}
                        onChange={(e) =>
                          updateRow(idx, { milestone: e.target.value })
                        }
                        placeholder="deposit"
                      />
                    </FormField>
                  </div>
                  <div className="col-span-2">
                    <FormField label="%">
                      <input
                        type="number"
                        step="0.01"
                        className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1 text-sm text-[color:var(--text-primary)]"
                        value={row.percentage_pct ?? ""}
                        onChange={(e) => {
                          const v =
                            e.target.value === "" ? null : Number(e.target.value);
                          updateRow(idx, {
                            percentage_pct: Number.isFinite(v)
                              ? (v as number)
                              : null,
                          });
                        }}
                      />
                    </FormField>
                  </div>
                  <div className="col-span-2">
                    <FormField label="Amount">
                      <input
                        type="number"
                        step="0.01"
                        className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1 text-sm text-[color:var(--text-primary)]"
                        value={centsToDollars(row.amount_cents)}
                        onChange={(e) =>
                          updateRow(idx, {
                            amount_cents: dollarsToCents(e.target.value),
                          })
                        }
                      />
                    </FormField>
                  </div>
                  <div className="col-span-4">
                    <FormField label="Trigger">
                      <input
                        className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1 text-sm text-[color:var(--text-primary)]"
                        value={row.trigger ?? ""}
                        onChange={(e) =>
                          updateRow(idx, { trigger: e.target.value || null })
                        }
                        placeholder="upon contract signing"
                      />
                    </FormField>
                  </div>
                  <div className="col-span-1 flex items-end">
                    <NwButton
                      variant="ghost"
                      size="sm"
                      onClick={() => removeRow(idx)}
                    >
                      ✕
                    </NwButton>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

// ── Private helpers ───────────────────────────────────────────────

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-[0.12em] text-[color:var(--text-tertiary)] font-mono">
        {label}
      </span>
      {children}
    </label>
  );
}

function centsToDollars(cents: number | null): string {
  if (cents === null) return "";
  return (cents / 100).toFixed(2);
}

function dollarsToCents(dollars: string): number | null {
  if (dollars === "") return null;
  const n = Number(dollars);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}
