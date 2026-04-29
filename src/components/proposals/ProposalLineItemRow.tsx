"use client";

import { useState } from "react";
import NwButton from "@/components/nw/Button";
import NwBadge from "@/components/nw/Badge";
import type {
  OrgCostCodeOption,
  LegacyCostCodeOption,
  PendingSuggestionOption,
} from "@/app/proposals/review/[extraction_id]/page";

/**
 * Phase 3.4 Issue 2 — proposal line-item editor row.
 *
 * Extracted from the inline LineItemRow function in ReviewManager.tsx.
 * Renders a single line of the proposal: description (verbatim) +
 * AI-normalized description + qty/UoM/unit price/amount + cost-code
 * dropdown (org/legacy/pending optgroups) + "Suggest new code" trigger
 * + collapsible cost breakdown (material/labor/sub/tax/delivery/notes).
 *
 * Form types are declared locally so this file is self-contained;
 * ReviewManager keeps a structurally identical copy until commit 11
 * (the orchestrator refactor) consolidates form types in one place.
 */

// ── Local form types ──────────────────────────────────────────────

export type CostCodePick =
  | { kind: "none" }
  | { kind: "org"; org_cost_code_id: string; code: string; name: string }
  | { kind: "legacy"; cost_code_id: string; code: string; description: string }
  | {
      kind: "pending";
      suggestion_id: string;
      suggested_code: string;
      suggested_name: string;
    };

export interface ProposalLineItemForm {
  line_number: number;
  description: string;
  description_normalized: string | null;
  quantity: number | null;
  unit_of_measure: string | null;
  unit_price_cents: number | null;
  total_price_cents: number;
  cost_code_pick: CostCodePick;
  material_cost_cents: number | null;
  labor_cost_cents: number | null;
  subcontract_cost_cents: number | null;
  tax_cents: number | null;
  delivery_cents: number | null;
  notes_cents: number | null;
  attributes: Record<string, unknown>;
  ai_cost_code_suggestion: string | null;
}

// ── Props ─────────────────────────────────────────────────────────

export interface ProposalLineItemRowProps {
  line: ProposalLineItemForm;
  idx: number;
  /** Per-line confidence (0..1). Undefined means "no per-line score reported". */
  confidence: number | undefined;
  orgCostCodes: OrgCostCodeOption[];
  legacyCostCodes: LegacyCostCodeOption[];
  pendingSuggestions: PendingSuggestionOption[];
  onChange: (patch: Partial<ProposalLineItemForm>) => void;
  /** Maps a CostCodePick back to the dropdown's <option value="…"> string. */
  pickToValue: (pick: CostCodePick) => string;
  /** Parses a dropdown <option value> back into a CostCodePick. */
  onPickFromValue: (value: string) => void;
  /** Opens the parent's "Suggest new code" modal scoped to this line. */
  onSuggestNew: () => void;
}

// ── Component ─────────────────────────────────────────────────────

export default function ProposalLineItemRow(props: ProposalLineItemRowProps) {
  const { line, confidence } = props;
  const [showBreakdown, setShowBreakdown] = useState(false);
  const pickValue = props.pickToValue(line.cost_code_pick);

  return (
    <div className="rounded border border-[var(--border-default)] p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-[color:var(--text-tertiary)]">
          Line {line.line_number}
          <ConfidenceDot score={confidence} />
        </span>
        {line.cost_code_pick.kind === "pending" && (
          <NwBadge variant="warning" size="sm">
            Pending: {line.cost_code_pick.suggested_code}
          </NwBadge>
        )}
      </div>
      <FormField label="Description (verbatim)">
        <textarea
          rows={2}
          className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1 text-sm text-[color:var(--text-primary)]"
          value={line.description}
          onChange={(e) => props.onChange({ description: e.target.value })}
        />
      </FormField>
      <FormField label="Description (AI-normalized — feeds embedding)">
        <input
          className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1 text-sm text-[color:var(--text-primary)]"
          value={line.description_normalized ?? ""}
          onChange={(e) =>
            props.onChange({ description_normalized: e.target.value || null })
          }
          placeholder="(none)"
        />
      </FormField>
      <div className="grid grid-cols-4 gap-2">
        <FormField label="Qty">
          <input
            type="number"
            step="0.01"
            className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1 text-sm text-[color:var(--text-primary)]"
            value={line.quantity ?? ""}
            onChange={(e) => {
              const v = e.target.value === "" ? null : Number(e.target.value);
              props.onChange({
                quantity: Number.isFinite(v) ? (v as number) : null,
              });
            }}
          />
        </FormField>
        <FormField label="UoM">
          <input
            className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1 text-sm text-[color:var(--text-primary)]"
            value={line.unit_of_measure ?? ""}
            onChange={(e) =>
              props.onChange({ unit_of_measure: e.target.value || null })
            }
            placeholder="EA, LF, SF..."
          />
        </FormField>
        <FormField label="Unit price">
          <input
            type="number"
            step="0.01"
            className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1 text-sm text-[color:var(--text-primary)]"
            value={centsToDollars(line.unit_price_cents)}
            onChange={(e) =>
              props.onChange({ unit_price_cents: dollarsToCents(e.target.value) })
            }
          />
        </FormField>
        <FormField label="Amount">
          <input
            type="number"
            step="0.01"
            className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1 text-sm text-[color:var(--text-primary)]"
            value={centsToDollars(line.total_price_cents)}
            onChange={(e) =>
              props.onChange({
                total_price_cents: dollarsToCents(e.target.value) ?? 0,
              })
            }
          />
        </FormField>
      </div>

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <FormField label="Cost code">
            <select
              className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1 text-sm text-[color:var(--text-primary)]"
              value={pickValue}
              onChange={(e) => props.onPickFromValue(e.target.value)}
            >
              <option value="">— pick code —</option>
              {props.orgCostCodes.length > 0 && (
                <optgroup label="Active codes">
                  {props.orgCostCodes.map((c) => (
                    <option key={c.id} value={`org:${c.id}`}>
                      {c.code} — {c.name}
                    </option>
                  ))}
                </optgroup>
              )}
              {props.legacyCostCodes.length > 0 && (
                <optgroup label="Cost intelligence codes">
                  {props.legacyCostCodes.map((c) => (
                    <option key={c.id} value={`legacy:${c.id}`}>
                      {c.code} — {c.description}
                    </option>
                  ))}
                </optgroup>
              )}
              {props.pendingSuggestions.length > 0 && (
                <optgroup label="Pending suggestions">
                  {props.pendingSuggestions.map((s) => (
                    <option key={s.id} value={`pending:${s.id}`}>
                      {s.suggested_code} — {s.suggested_name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </FormField>
          {line.ai_cost_code_suggestion && (
            <p className="mt-1 text-xs text-[color:var(--text-tertiary)]">
              AI suggestion: {line.ai_cost_code_suggestion}
            </p>
          )}
        </div>
        <NwButton variant="ghost" size="sm" onClick={props.onSuggestNew}>
          Suggest new
        </NwButton>
      </div>

      <div>
        <button
          type="button"
          onClick={() => setShowBreakdown((s) => !s)}
          className="text-xs text-[color:var(--text-secondary)] underline"
        >
          {showBreakdown ? "Hide" : "Show"} cost breakdown
        </button>
        {showBreakdown && (
          <div className="mt-2 grid grid-cols-3 gap-2">
            {(
              [
                ["material_cost_cents", "Material"],
                ["labor_cost_cents", "Labor"],
                ["subcontract_cost_cents", "Subcontract"],
                ["tax_cents", "Tax"],
                ["delivery_cents", "Delivery"],
                ["notes_cents", "Other / notes"],
              ] as const
            ).map(([key, label]) => (
              <FormField key={key} label={label}>
                <input
                  type="number"
                  step="0.01"
                  className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1 text-sm text-[color:var(--text-primary)]"
                  value={centsToDollars(line[key])}
                  onChange={(e) =>
                    props.onChange({
                      [key]: dollarsToCents(e.target.value),
                    } as Partial<ProposalLineItemForm>)
                  }
                  placeholder="(null = not on proposal)"
                />
              </FormField>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Private helpers ───────────────────────────────────────────────

const CONFIDENCE_GREEN = 0.85;
const CONFIDENCE_YELLOW = 0.7;

function ConfidenceDot({
  score,
  title,
}: {
  score: number | undefined;
  title?: string;
}) {
  if (score === undefined) return null;
  const color =
    score >= CONFIDENCE_GREEN
      ? "var(--nw-success)"
      : score >= CONFIDENCE_YELLOW
        ? "var(--nw-warn)"
        : "var(--nw-danger)";
  return (
    <span
      className="inline-block w-2 h-2 ml-1.5 rounded-full align-middle"
      style={{ background: color }}
      title={title ?? `Confidence ${Math.round(score * 100)}%`}
      aria-label={`Confidence ${Math.round(score * 100)}%`}
    />
  );
}

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
