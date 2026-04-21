/**
 * Detect + allocate invoice-level overhead charges.
 *
 * Problem: construction invoices routinely include DELIVERY, FREIGHT, FUEL
 * SURCHARGE, HANDLING, etc. as line items in the PDF. Treating them as real
 * line items corrupts the item catalog (a $45 "delivery" line becomes a $45
 * "item" in vendor_item_pricing) and leaves real lines understated.
 *
 * Approach:
 *   1. At extraction time, detect overhead lines via strict anchored regex —
 *      we only flag lines whose ENTIRE description is about the overhead
 *      charge. "DELIVERY CHARGE" matches; "2X4X10 TIMBERSTRAND 1.3E
 *      DELIVERY" does not (it's a product where the word happens to appear).
 *   2. Mark overhead extraction_lines with is_allocated_overhead=true +
 *      overhead_type — they stay visible in the verification UI but do
 *      NOT commit to the spine.
 *   3. Sum overhead cents and allocate proportionally to real (non-overhead)
 *      lines, weighted by each line's pre-tax total. Rounding residual lands
 *      on the largest line so the sum is exact.
 *   4. Tax proration works the same way: if the invoice has a total tax but
 *      no per-line breakdown, distribute proportionally across taxable lines
 *      (default to all lines if taxability unknown).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type OverheadType =
  | "delivery"
  | "freight"
  | "shipping"
  | "fuel_surcharge"
  | "handling"
  | "restocking"
  | "core_charge";

export interface OverheadDetection {
  overhead_type: OverheadType;
}

/**
 * Strict anchored patterns. A line is overhead only if its whole description
 * is one of these — "SHIPPING" alone yes; "SHIPPING WEIGHT 24LB" no.
 */
const OVERHEAD_PATTERNS: Array<{ type: OverheadType; regex: RegExp }> = [
  // delivery
  { type: "delivery", regex: /^\s*delivery(\s*(charge|fee|cost))?(\s+from\s+[\w\s&.-]+)?\s*$/i },
  { type: "delivery", regex: /^\s*(local\s+)?delivery\s*(charge|fee)?\s*$/i },
  { type: "delivery", regex: /^\s*(truck|home)\s*delivery\s*$/i },

  // freight / shipping
  { type: "freight", regex: /^\s*freight(\s*(charge|cost|fee|out))?\s*$/i },
  { type: "freight", regex: /^\s*freight\s+&?\s+handling\s*$/i },
  { type: "shipping", regex: /^\s*shipping(\s*(charge|cost|fee|&\s*handling))?\s*$/i },
  { type: "shipping", regex: /^\s*s\s*&\s*h\s*$/i },

  // fuel surcharge
  { type: "fuel_surcharge", regex: /^\s*fuel\s*(surcharge|charge|fee)?\s*$/i },

  // handling (only if short / anchored — "handling charge" yes)
  { type: "handling", regex: /^\s*handling\s*(charge|fee)?\s*$/i },

  // restocking
  { type: "restocking", regex: /^\s*re-?stocking\s*(charge|fee)?\s*$/i },

  // core charge (auto parts / plumbing cores)
  { type: "core_charge", regex: /^\s*core\s*charge\s*$/i },
];

export function detectOverheadLine(description: string | null): OverheadDetection | null {
  if (!description) return null;
  const trimmed = description.trim();
  if (trimmed.length === 0 || trimmed.length > 60) return null;

  // Reject obvious product lines: leading digit, leading product pattern NxM.
  if (/^\d/.test(trimmed)) return null;
  if (/\d+\s*[xX]\s*\d+/.test(trimmed)) return null;

  for (const pat of OVERHEAD_PATTERNS) {
    if (pat.regex.test(trimmed)) return { overhead_type: pat.type };
  }
  return null;
}

export interface AllocationLine {
  id: string;
  raw_total_cents: number;
  is_allocated_overhead: boolean;
  /** null = taxability unknown (treated as taxable for proration purposes). */
  line_is_taxable: boolean | null;
}

export interface AllocationResult {
  overhead_total_cents: number;
  tax_total_cents: number;
  updates: Array<{
    id: string;
    overhead_allocated_cents: number;
    line_tax_cents: number;
  }>;
}

/**
 * Pure function: compute per-line overhead + tax proration from invoice-level
 * totals. No DB access so it's easy to unit test.
 *
 * - overhead is always proportional to pre-tax line total across all
 *   non-allocated lines.
 * - tax is proportional to pre-tax line total across lines where
 *   line_is_taxable is not false (null treated as true — conservative).
 *
 * Rounding residual lands on the largest-line share so sums are exact.
 */
export function computeAllocations(
  lines: AllocationLine[],
  overheadTotalCents: number,
  invoiceTaxCents: number
): AllocationResult {
  const real = lines.filter((l) => !l.is_allocated_overhead);
  const updates = real.map((l) => ({
    id: l.id,
    overhead_allocated_cents: 0,
    line_tax_cents: 0,
  }));

  // Overhead allocation
  if (overheadTotalCents > 0 && real.length > 0) {
    const base = real.reduce((s, l) => s + Math.max(l.raw_total_cents, 0), 0);
    if (base > 0) {
      let assignedOverhead = 0;
      let largestIdx = 0;
      let largestVal = -1;
      real.forEach((l, idx) => {
        const share = Math.round((l.raw_total_cents / base) * overheadTotalCents);
        updates[idx].overhead_allocated_cents = share;
        assignedOverhead += share;
        if (l.raw_total_cents > largestVal) {
          largestVal = l.raw_total_cents;
          largestIdx = idx;
        }
      });
      const overheadResidual = overheadTotalCents - assignedOverhead;
      if (overheadResidual !== 0) {
        updates[largestIdx].overhead_allocated_cents += overheadResidual;
      }
    }
  }

  // Tax allocation — default to taxable (null) so we don't silently drop tax
  if (invoiceTaxCents > 0) {
    const taxable = real
      .map((l, idx) => ({ line: l, idx }))
      .filter(({ line }) => line.line_is_taxable !== false);
    const taxBase = taxable.reduce((s, { line }) => s + Math.max(line.raw_total_cents, 0), 0);
    if (taxable.length > 0 && taxBase > 0) {
      let assignedTax = 0;
      let largestIdx = taxable[0].idx;
      let largestVal = -1;
      taxable.forEach(({ line, idx }) => {
        const share = Math.round((line.raw_total_cents / taxBase) * invoiceTaxCents);
        updates[idx].line_tax_cents = share;
        assignedTax += share;
        if (line.raw_total_cents > largestVal) {
          largestVal = line.raw_total_cents;
          largestIdx = idx;
        }
      });
      const taxResidual = invoiceTaxCents - assignedTax;
      if (taxResidual !== 0) {
        updates[largestIdx].line_tax_cents += taxResidual;
      }
    }
  }

  return { overhead_total_cents: overheadTotalCents, tax_total_cents: invoiceTaxCents, updates };
}

/**
 * Persist allocations to invoice_extraction_lines.
 */
export async function applyAllocationsToLines(
  supabase: SupabaseClient,
  result: AllocationResult
): Promise<void> {
  for (const u of result.updates) {
    const { error } = await supabase
      .from("invoice_extraction_lines")
      .update({
        overhead_allocated_cents: u.overhead_allocated_cents,
        line_tax_cents: u.line_tax_cents,
      })
      .eq("id", u.id);
    if (error) {
      console.warn(
        `[allocate-overhead] failed to update line ${u.id}: ${error.message}`
      );
    }
  }
}
