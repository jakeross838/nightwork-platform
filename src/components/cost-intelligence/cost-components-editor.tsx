"use client";

import { useMemo } from "react";
import NwEyebrow from "@/components/nw/Eyebrow";
import NwMoney from "@/components/nw/Money";
import NwButton from "@/components/nw/Button";
import type { ComponentType, ComponentSource } from "@/lib/cost-intelligence/types";
import {
  COMPONENT_TYPE_LABELS,
  COMPONENT_SOURCE_LABELS,
  type ComponentDraft,
} from "./queue-types";

const COMPONENT_TYPES: ComponentType[] = [
  "material",
  "fabrication",
  "installation",
  "labor",
  "equipment_rental",
  "delivery",
  "fuel_surcharge",
  "handling",
  "restocking",
  "tax",
  "waste_disposal",
  "permit_fee",
  "bundled",
  "other",
];

interface Props {
  components: ComponentDraft[];
  lineTotalCents: number;
  onChange: (next: ComponentDraft[]) => void;
  /** When true, renders the non-splittable scope-item display. */
  scopeMode?: boolean;
  /** Advanced override (scope-only) to allow a manual split. */
  allowScopeSplit?: boolean;
  onToggleAllowScopeSplit?: (next: boolean) => void;
}

function tempId(): string {
  return `t-${Math.random().toString(36).slice(2, 10)}`;
}

function parseDollarsToCents(input: string): number | null {
  const cleaned = input.replace(/[$,\s]/g, "");
  if (!cleaned) return 0;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

export default function CostComponentsEditor({
  components,
  lineTotalCents,
  onChange,
  scopeMode = false,
  allowScopeSplit = false,
  onToggleAllowScopeSplit,
}: Props) {
  const sum = useMemo(
    () => components.reduce((s, c) => s + c.amount_cents, 0),
    [components]
  );
  const diff = sum - lineTotalCents;
  const mismatch = Math.abs(diff) > 5;
  const singleComponent = components.length === 1;
  const scopeLocked = scopeMode && !allowScopeSplit;

  const updateOne = (tempIdToUpdate: string, patch: Partial<ComponentDraft>) => {
    onChange(components.map((c) => (c.temp_id === tempIdToUpdate ? { ...c, ...patch } : c)));
  };

  const addComponent = () => {
    onChange([
      ...components,
      {
        temp_id: tempId(),
        existing_id: null,
        component_type: "material",
        amount_cents: 0,
        source: "human_added",
        notes: "",
        quantity: null,
        unit: "",
        unit_rate_cents: null,
      },
    ]);
  };

  const removeComponent = (tempIdToRemove: string) => {
    const next = components.filter((c) => c.temp_id !== tempIdToRemove);
    if (next.length === 0) {
      onChange([
        {
          temp_id: tempId(),
          existing_id: null,
          component_type: "bundled",
          amount_cents: lineTotalCents,
          source: "default_bundled",
          notes: "",
          quantity: null,
          unit: "",
          unit_rate_cents: null,
        },
      ]);
    } else {
      onChange(next);
    }
  };

  const splitIntoComponents = () => {
    if (components.length !== 1) return;
    const base = components[0];
    onChange([
      { ...base, component_type: "material", source: "human_added" },
      {
        temp_id: tempId(),
        existing_id: null,
        component_type: "installation",
        amount_cents: 0,
        source: "human_added",
        notes: "",
        quantity: null,
        unit: "",
        unit_rate_cents: null,
      },
    ]);
  };

  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between">
        <NwEyebrow tone="accent">Cost components</NwEyebrow>
        <span className="text-[11px] text-[var(--text-tertiary)]">What this line is made of</span>
      </div>

      <div className="border border-[var(--border-default)] bg-[var(--bg-card)]">
        {/* header strip */}
        <div
          className="grid grid-cols-[1fr_120px_90px_90px_32px] gap-2 items-center px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)] border-b border-[var(--border-default)]"
          style={{ fontFamily: "var(--font-jetbrains-mono)" }}
        >
          <span>Type</span>
          <span className="text-right">Amount</span>
          <span>Source</span>
          <span>Notes</span>
          <span></span>
        </div>

        {components.map((c) => (
          <div
            key={c.temp_id}
            className="grid grid-cols-[1fr_120px_90px_90px_32px] gap-2 items-center px-3 py-2 border-b border-[var(--border-default)] last:border-b-0"
          >
            <select
              value={c.component_type}
              onChange={(e) =>
                updateOne(c.temp_id, { component_type: e.target.value as ComponentType })
              }
              className="h-[30px] px-2 border border-[var(--border-default)] bg-[var(--bg-card)] text-[12px] text-[var(--text-primary)]"
            >
              {COMPONENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {COMPONENT_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
            <input
              type="text"
              inputMode="decimal"
              value={centsToInput(c.amount_cents)}
              onChange={(e) => {
                const cents = parseDollarsToCents(e.target.value);
                if (cents == null) return;
                updateOne(c.temp_id, { amount_cents: cents });
              }}
              className="h-[30px] px-2 border border-[var(--border-default)] bg-[var(--bg-card)] text-[12px] text-right text-[var(--text-primary)]"
              style={{ fontFamily: "var(--font-jetbrains-mono)", fontVariantNumeric: "tabular-nums" }}
            />
            <select
              value={c.source}
              onChange={(e) =>
                updateOne(c.temp_id, { source: e.target.value as ComponentSource })
              }
              className="h-[30px] px-2 border border-[var(--border-default)] bg-[var(--bg-card)] text-[10px] text-[var(--text-secondary)] uppercase tracking-[0.12em]"
              style={{ fontFamily: "var(--font-jetbrains-mono)" }}
            >
              {(Object.keys(COMPONENT_SOURCE_LABELS) as ComponentSource[]).map((s) => (
                <option key={s} value={s}>
                  {COMPONENT_SOURCE_LABELS[s]}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={c.notes}
              onChange={(e) => updateOne(c.temp_id, { notes: e.target.value })}
              placeholder="—"
              className="h-[30px] px-2 border border-[var(--border-default)] bg-[var(--bg-card)] text-[12px] text-[var(--text-primary)]"
            />
            <button
              type="button"
              onClick={() => removeComponent(c.temp_id)}
              className="h-[30px] w-[30px] inline-flex items-center justify-center border border-[var(--border-default)] text-[12px] text-[var(--text-tertiary)] hover:text-[var(--nw-danger)] hover:border-[var(--nw-danger)]"
              title="Remove component"
              aria-label="Remove component"
            >
              ×
            </button>
          </div>
        ))}

        {/* total strip */}
        <div
          className="grid grid-cols-[1fr_120px_90px_90px_32px] gap-2 items-center px-3 py-2 border-t border-[var(--border-default)] bg-[var(--bg-subtle)]"
          style={{ fontFamily: "var(--font-jetbrains-mono)" }}
        >
          <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
            Sum of components
          </span>
          <span className="text-right text-[12px] text-[var(--text-primary)]">
            <NwMoney cents={sum} size="sm" />
          </span>
          <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
            Line total
          </span>
          <span className="text-[12px] text-[var(--text-primary)]">
            <NwMoney cents={lineTotalCents} size="sm" />
          </span>
          <span></span>
        </div>
      </div>

      {mismatch && (
        <p className="text-[11px] text-[var(--nw-warn)]">
          Components sum off by {diff >= 0 ? "+" : "−"}$
          {(Math.abs(diff) / 100).toFixed(2)} vs line total. You can still save — real
          invoices round.
        </p>
      )}

      <div className="flex items-center gap-2 pt-1 flex-wrap">
        <NwButton
          variant="ghost"
          size="sm"
          onClick={addComponent}
          disabled={scopeLocked}
          title={
            scopeLocked
              ? "Scope work combines labor and material into one total and isn't typically split."
              : undefined
          }
        >
          + Add component
        </NwButton>
        {singleComponent && (
          <NwButton
            variant="ghost"
            size="sm"
            onClick={splitIntoComponents}
            disabled={scopeLocked}
            title={
              scopeLocked
                ? "Scope work combines labor and material into one total and isn't typically split. Advanced users can override below."
                : undefined
            }
          >
            Split into components
          </NwButton>
        )}
        {scopeMode && onToggleAllowScopeSplit && (
          <label className="ml-auto flex items-center gap-2 text-[11px] text-[var(--text-secondary)] cursor-pointer">
            <input
              type="checkbox"
              checked={allowScopeSplit}
              onChange={(e) => onToggleAllowScopeSplit(e.target.checked)}
              className="h-[14px] w-[14px]"
            />
            Advanced: allow component split
          </label>
        )}
      </div>

      {scopeLocked && (
        <p className="text-[11px] text-[var(--text-tertiary)] italic">
          Scope work combines labor and material into one total and isn&rsquo;t typically split.
          Toggle &ldquo;Advanced: allow component split&rdquo; if you need to override.
        </p>
      )}
    </section>
  );
}
