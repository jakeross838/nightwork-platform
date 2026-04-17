import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { ApiError, withApiError } from "@/lib/api/errors";
import { getCurrentMembership } from "@/lib/org/session";
import { recalcDraftDrawsForJob } from "@/lib/draw-calc";
import { recomputePercentageBillings } from "@/lib/recompute-percentage-billings";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

type AttachBody = {
  /** IDs of internal_billings to attach to this draw. */
  billing_ids: string[];
  /**
   * Optional per-billing override amounts (cents). Only used when the
   * billing type is 'percentage' — if omitted, the server computes the
   * amount from the current draw total × percentage.
   */
  overrides?: Record<string, { amount: number; note?: string }>;
};

export const GET = withApiError(async (
  _req: NextRequest,
  context: { params: { id: string } }
) => {
  // Return the current draw's base-work total (used by the client to
  // recompute percentage billings live without server round-trips).
  const membership = await getCurrentMembership();
  if (!membership) throw new ApiError("Not authenticated", 401);

  const supabase = createServerClient();
  const { data: draw } = await supabase
    .from("draws")
    .select("job_id, total_completed_to_date")
    .eq("id", context.params.id)
    .eq("org_id", membership.org_id)
    .single();
  if (!draw) throw new ApiError("Draw not found", 404);

  // Base = every existing line except percentage-billing-sourced ones.
  const { data: rows } = await supabase
    .from("draw_line_items")
    .select("this_period, internal_billing_id")
    .eq("draw_id", context.params.id)
    .is("deleted_at", null);
  type LI = { this_period?: number; internal_billing_id?: string | null };
  const typed = (rows ?? []) as unknown as LI[];
  const billingIds = typed
    .map((r) => r.internal_billing_id)
    .filter((x): x is string => !!x);
  let pctSet = new Set<string>();
  if (billingIds.length > 0) {
    const { data: ab } = await supabase
      .from("internal_billings")
      .select("id, internal_billing_types:billing_type_id (calculation_method)")
      .in("id", billingIds);
    pctSet = new Set(
      ((ab ?? []) as unknown as Array<{
        id: string;
        internal_billing_types?: { calculation_method?: string };
      }>)
        .filter((x) => x.internal_billing_types?.calculation_method === "percentage")
        .map((x) => x.id)
    );
  }
  const base = typed
    .filter((r) => !r.internal_billing_id || !pctSet.has(r.internal_billing_id))
    .reduce((s, r) => s + (r.this_period ?? 0), 0);

  return NextResponse.json({ base_cents: base, job_id: draw.job_id });
});

export const POST = withApiError(async (
  req: NextRequest,
  context: { params: { id: string } }
) => {
  const membership = await getCurrentMembership();
  if (!membership) throw new ApiError("Not authenticated", 401);
  if (!["owner", "admin", "pm"].includes(membership.role)) {
    throw new ApiError("Only admins/PMs can attach billings to a draw", 403);
  }
  const supabase = createServerClient();
  const body = (await req.json()) as AttachBody;
  if (!Array.isArray(body.billing_ids) || body.billing_ids.length === 0) {
    throw new ApiError("billing_ids is required", 400);
  }

  // Verify the draw and its job.
  const { data: draw } = await supabase
    .from("draws")
    .select("id, job_id, status")
    .eq("id", context.params.id)
    .eq("org_id", membership.org_id)
    .is("deleted_at", null)
    .single();
  if (!draw) throw new ApiError("Draw not found", 404);
  if (!["draft", "pm_review"].includes(draw.status as string)) {
    throw new ApiError(`Cannot attach to a ${draw.status} draw`, 400);
  }

  // Fetch the billings + their types.
  const { data: billings, error: bErr } = await supabase
    .from("internal_billings")
    .select(
      "id, job_id, billing_type_id, cost_code_id, amount, percentage, status, " +
        "internal_billing_types:billing_type_id (id, calculation_method)"
    )
    .in("id", body.billing_ids)
    .eq("job_id", draw.job_id)
    .eq("org_id", membership.org_id)
    .is("deleted_at", null);
  if (bErr) throw new ApiError(bErr.message, 500);
  if (!billings || billings.length === 0) throw new ApiError("No valid billings", 400);

  type BillingRow = {
    id: string;
    amount?: number;
    percentage?: number;
    cost_code_id?: string | null;
    internal_billing_types?: { calculation_method?: string } | null;
  };

  // Process non-percentage billings first so their amounts contribute to
  // the base that percentage billings compute against. Percentage billings
  // get amount=0 on insert and are filled in by recomputePercentageBillings
  // at the end (which sees the final state of the draw, including invoices).
  const sorted = (billings as unknown as BillingRow[]).slice().sort((a, b) => {
    const ap = a.internal_billing_types?.calculation_method === "percentage" ? 1 : 0;
    const bp = b.internal_billing_types?.calculation_method === "percentage" ? 1 : 0;
    return ap - bp;
  });

  const inserted: string[] = [];
  for (const raw of sorted) {
    const method = raw.internal_billing_types?.calculation_method ?? "manual";

    let amount = raw.amount ?? 0;
    if (method === "percentage") {
      const override = body.overrides?.[raw.id];
      if (override && typeof override.amount === "number") {
        amount = override.amount;
      } else {
        amount = 0;
      }
    }

    const costCodeId = raw.cost_code_id ?? null;
    let budgetLineId: string | null = null;
    if (costCodeId) {
      const { data: bl } = await supabase
        .from("budget_lines")
        .select("id")
        .eq("job_id", draw.job_id)
        .eq("cost_code_id", costCodeId)
        .is("deleted_at", null)
        .maybeSingle();
      if (bl) budgetLineId = (bl as { id: string }).id;
    }

    const { data: line, error: insErr } = await supabase
      .from("draw_line_items")
      .insert({
        draw_id: context.params.id,
        budget_line_id: budgetLineId,
        source_type: "internal",
        internal_billing_id: raw.id,
        previous_applications: 0,
        this_period: amount,
        total_to_date: amount,
        percent_complete: 0,
        balance_to_finish: 0,
        org_id: membership.org_id,
      })
      .select("id")
      .single();
    if (insErr) throw new ApiError(`Insert failed for ${raw.id}: ${insErr.message}`, 500);
    const lineId = (line as { id: string }).id;

    await supabase
      .from("internal_billings")
      .update({
        draw_line_item_id: lineId,
        status: "billed",
        amount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", raw.id);

    inserted.push(lineId);
  }

  // Mutation invariant: any change to a draft draw's line items re-triggers
  // the percentage recompute so base/pct stays in sync. (No-op when the
  // change was itself a percentage-billing attach, since attach already
  // computed from the fresh base — but cheap to run defensively.)
  await recomputePercentageBillings(context.params.id);

  // Recompute draft-draw totals so current_payment_due reflects the new
  // internal lines right away. (No-op for submitted/approved/locked draws.)
  try {
    await recalcDraftDrawsForJob(draw.job_id as string);
  } catch {
    /* non-fatal — totals will recompute on next draw open anyway */
  }

  return NextResponse.json({ ok: true, inserted_count: inserted.length, inserted });
});

export const DELETE = withApiError(async (
  req: NextRequest,
  context: { params: { id: string } }
) => {
  // Detach a single billing (soft-delete its draw_line_item, clear the
  // billing's link, and flip it back to draft).
  const membership = await getCurrentMembership();
  if (!membership) throw new ApiError("Not authenticated", 401);
  if (!["owner", "admin", "pm"].includes(membership.role)) {
    throw new ApiError("Forbidden", 403);
  }
  const { searchParams } = new URL(req.url);
  const billingId = searchParams.get("billing_id");
  if (!billingId) throw new ApiError("billing_id is required", 400);

  const supabase = createServerClient();
  const { data: billing } = await supabase
    .from("internal_billings")
    .select("id, draw_line_item_id")
    .eq("id", billingId)
    .eq("org_id", membership.org_id)
    .single();
  if (!billing) throw new ApiError("Billing not found", 404);

  if (billing.draw_line_item_id) {
    await supabase
      .from("draw_line_items")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", billing.draw_line_item_id);
  }
  await supabase
    .from("internal_billings")
    .update({
      draw_line_item_id: null,
      status: "draft",
      updated_at: new Date().toISOString(),
    })
    .eq("id", billingId);

  // Recompute percentage billings on this draw + totals. Detaching any
  // billing (even a non-percentage one) changes the base that percentage
  // billings pivot off of, so recompute unconditionally.
  await recomputePercentageBillings(context.params.id);

  return NextResponse.json({ ok: true });
});
