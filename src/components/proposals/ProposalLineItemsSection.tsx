"use client";

import Money from "@/components/nw/Money";
import ProposalLineItemRow, {
  type ProposalLineItemForm,
  type CostCodePick,
} from "@/components/proposals/ProposalLineItemRow";
import type {
  OrgCostCodeOption,
  LegacyCostCodeOption,
  PendingSuggestionOption,
} from "@/app/proposals/review/[extraction_id]/page";

/**
 * Phase 3.4 Issue 2 — line-items section (rows + total).
 *
 * Wraps the list of ProposalLineItemRow components in a Slate card
 * with a header row that shows line count + roll-up total. Sits below
 * the 50/50 hero in the new layout: it's "operational content" (per
 * Jake's prompt 205 split — document-identity content goes in the
 * right rail, operational content goes in the main flow).
 *
 * Inverts no business logic — pure presentation + key-driven mapping
 * from the orchestrator's `form.line_items` array to row callbacks.
 */

interface Props {
  lineItems: ProposalLineItemForm[];
  totalCents: number;
  /** Optional roll-up confidence for the line-items group (form.confidence_details.line_items). */
  lineItemsConfidence: number | undefined;
  orgCostCodes: OrgCostCodeOption[];
  legacyCostCodes: LegacyCostCodeOption[];
  pendingSuggestions: PendingSuggestionOption[];
  onLineChange: (idx: number, patch: Partial<ProposalLineItemForm>) => void;
  onPickFromValue: (idx: number, value: string) => void;
  pickToValue: (pick: CostCodePick) => string;
  onSuggestNew: (idx: number) => void;
}

export default function ProposalLineItemsSection({
  lineItems,
  totalCents,
  lineItemsConfidence,
  orgCostCodes,
  legacyCostCodes,
  pendingSuggestions,
  onLineChange,
  onPickFromValue,
  pickToValue,
  onSuggestNew,
}: Props) {
  return (
    <section className="rounded border border-[var(--border-default)] bg-[var(--bg-card)] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[color:var(--text-primary)]">
          Line items ({lineItems.length})
        </h2>
        <span className="text-xs text-[color:var(--text-tertiary)]">
          Total{" "}
          <Money cents={totalCents} variant="emphasized" size="md" />
        </span>
      </div>
      {lineItems.length === 0 ? (
        <p className="text-sm text-[color:var(--text-tertiary)]">
          No line items extracted. Vendor proposal may have been a lump-sum
          quote without itemized pricing.
        </p>
      ) : (
        <div className="space-y-3">
          {lineItems.map((li, idx) => (
            <ProposalLineItemRow
              key={idx}
              line={li}
              idx={idx}
              confidence={lineItemsConfidence}
              orgCostCodes={orgCostCodes}
              legacyCostCodes={legacyCostCodes}
              pendingSuggestions={pendingSuggestions}
              onChange={(patch) => onLineChange(idx, patch)}
              onPickFromValue={(v) => onPickFromValue(idx, v)}
              pickToValue={pickToValue}
              onSuggestNew={() => onSuggestNew(idx)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
