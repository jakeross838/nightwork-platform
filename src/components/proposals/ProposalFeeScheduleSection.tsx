"use client";

import { useState } from "react";
import NwButton from "@/components/nw/Button";

/**
 * Phase 3.4 Issue 2 — additional fee schedule editor.
 *
 * Extracted from the inline FeeScheduleSection in ReviewManager.tsx.
 * Renders rows of (rate_type, description, rate_cents, unit) — explicit
 * hourly/blended rates the vendor will bill at for additional services
 * outside the line-item scope. `entries === null` means "single
 * payment / no rate table extracted"; `entries === []` means "table
 * was present but PM emptied it".
 *
 * Self-contained: declares FeeScheduleEntryForm + private FormField +
 * cents helpers locally so each section file can be edited and tested
 * in isolation. ReviewManager keeps a structurally identical copy of
 * FeeScheduleEntryForm until commit 11 consolidates form types.
 */

export interface FeeScheduleEntryForm {
  rate_type: string;
  description: string | null;
  rate_cents: number | null;
  unit: string | null;
}

interface Props {
  entries: FeeScheduleEntryForm[] | null;
  onChange: (next: FeeScheduleEntryForm[] | null) => void;
}

export default function ProposalFeeScheduleSection({ entries, onChange }: Props) {
  const [open, setOpen] = useState(entries !== null && entries.length > 0);
  const list = entries ?? [];
  const addRow = () =>
    onChange([
      ...list,
      { rate_type: "", description: null, rate_cents: null, unit: null },
    ]);
  const removeRow = (idx: number) => {
    const next = list.slice();
    next.splice(idx, 1);
    onChange(next.length === 0 ? null : next);
  };
  const updateRow = (idx: number, patch: Partial<FeeScheduleEntryForm>) => {
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
          {open ? "▼" : "▶"} Additional fee schedule ({list.length})
        </button>
        {open && (
          <NwButton variant="ghost" size="sm" onClick={addRow}>
            + Add rate
          </NwButton>
        )}
      </div>
      {open && (
        <>
          {list.length === 0 ? (
            <p className="text-xs text-[color:var(--text-tertiary)]">
              No rate table extracted. Add a row if the proposal lists hourly or
              blended rates the vendor will bill at for additional services.
            </p>
          ) : (
            <div className="space-y-2">
              {list.map((row, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-12 gap-2 rounded border border-[var(--border-default)] p-2"
                >
                  <div className="col-span-3">
                    <FormField label="Type">
                      <input
                        className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1 text-sm text-[color:var(--text-primary)]"
                        value={row.rate_type}
                        onChange={(e) =>
                          updateRow(idx, { rate_type: e.target.value })
                        }
                        placeholder="hourly"
                      />
                    </FormField>
                  </div>
                  <div className="col-span-4">
                    <FormField label="Description">
                      <input
                        className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1 text-sm text-[color:var(--text-primary)]"
                        value={row.description ?? ""}
                        onChange={(e) =>
                          updateRow(idx, { description: e.target.value || null })
                        }
                      />
                    </FormField>
                  </div>
                  <div className="col-span-2">
                    <FormField label="Rate">
                      <input
                        type="number"
                        step="0.01"
                        className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1 text-sm text-[color:var(--text-primary)]"
                        value={centsToDollars(row.rate_cents)}
                        onChange={(e) =>
                          updateRow(idx, {
                            rate_cents: dollarsToCents(e.target.value),
                          })
                        }
                      />
                    </FormField>
                  </div>
                  <div className="col-span-2">
                    <FormField label="Unit">
                      <input
                        className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1 text-sm text-[color:var(--text-primary)]"
                        value={row.unit ?? ""}
                        onChange={(e) =>
                          updateRow(idx, { unit: e.target.value || null })
                        }
                        placeholder="hr"
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
