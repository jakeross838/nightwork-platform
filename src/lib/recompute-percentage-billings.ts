import { createServiceRoleClient } from "@/lib/supabase/service";
import { recalcDraftDrawsForJob } from "@/lib/draw-calc";

/**
 * Recompute the this_period amount for all percentage-based internal billings
 * attached to a given draw. Percentage billings are computed as:
 *
 *   amount = baseCents * percentage
 *
 * where baseCents = sum of this_period for all budget + change_order source
 * type lines on the same draw (i.e. the "real work" total that the percentage
 * fee applies to).
 *
 * After updating individual line amounts, triggers a full draw recalc via
 * recalcDraftDrawsForJob so G702 totals stay in sync.
 */
export async function recomputePercentageBillings(drawId: string): Promise<void> {
  const supabase = createServiceRoleClient();

  // 1. Load draw
  const { data: draw } = await supabase
    .from("draws")
    .select("id, job_id, status")
    .eq("id", drawId)
    .maybeSingle();
  if (!draw || (draw as { status: string }).status !== "draft") return;

  // 2. Get base: sum of this_period for budget + change_order source types
  const { data: baseLines } = await supabase
    .from("draw_line_items")
    .select("this_period")
    .eq("draw_id", drawId)
    .in("source_type", ["budget", "change_order"])
    .is("deleted_at", null);
  const baseCents = (baseLines ?? []).reduce(
    (s, l) => s + ((l as { this_period: number }).this_period ?? 0),
    0
  );

  // 3. Get internal source lines on this draw
  const { data: pctLines } = await supabase
    .from("draw_line_items")
    .select("id, internal_billing_id")
    .eq("draw_id", drawId)
    .eq("source_type", "internal")
    .is("deleted_at", null);

  for (const line of pctLines ?? []) {
    if (!line.internal_billing_id) continue;

    const { data: billing } = await supabase
      .from("internal_billings")
      .select(
        "id, percentage, billing_type_id, internal_billing_types!billing_type_id (calculation_method)"
      )
      .eq("id", line.internal_billing_id as string)
      .maybeSingle();

    // Check if billing type is percentage
    const method = (
      billing as {
        internal_billing_types?: { calculation_method?: string };
      } | null
    )?.internal_billing_types?.calculation_method;
    if (method !== "percentage" || !billing?.percentage) continue;

    const pct = Number(billing.percentage); // fraction, e.g. 0.18
    const newAmount = Math.round(baseCents * pct);

    // Update draw_line_items.this_period
    await supabase
      .from("draw_line_items")
      .update({ this_period: newAmount, total_to_date: newAmount })
      .eq("id", line.id as string);

    // Update internal_billings.amount_cents
    await supabase
      .from("internal_billings")
      .update({ amount_cents: newAmount })
      .eq("id", line.internal_billing_id as string);
  }

  // 4. Recalc draw totals
  await recalcDraftDrawsForJob(draw.job_id as string);
}
