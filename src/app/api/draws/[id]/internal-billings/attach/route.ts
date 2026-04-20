import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { ApiError, withApiError } from "@/lib/api/errors";
import { getCurrentMembership } from "@/lib/org/session";
import { recomputePercentageBillings } from "@/lib/recompute-percentage-billings";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

/**
 * Resolve the budget_line_id for a given cost_code on this job.
 * draw_line_items.budget_line_id is NOT NULL, so internal billings must
 * map through a budget_line. If one doesn't exist yet for this cost code
 * we create it with zero estimates (same recovery pattern used by the
 * draw detail GET endpoint).
 */
async function resolveBudgetLineId(
  supabase: ReturnType<typeof createServerClient>,
  jobId: string,
  costCodeId: string | null,
  orgId: string
): Promise<string> {
  if (!costCodeId) {
    throw new ApiError(
      "Internal billing must have a cost_code_id to attach to a draw",
      400
    );
  }

  // Look for existing budget_line on this job for the cost code
  const { data: existing } = await supabase
    .from("budget_lines")
    .select("id")
    .eq("job_id", jobId)
    .eq("cost_code_id", costCodeId)
    .is("deleted_at", null)
    .maybeSingle();

  if (existing) return (existing as { id: string }).id;

  // Auto-create a zero-estimate budget line (same pattern as draw detail GET)
  const { data: created, error } = await supabase
    .from("budget_lines")
    .insert({
      job_id: jobId,
      cost_code_id: costCodeId,
      original_estimate: 0,
      revised_estimate: 0,
      previous_applications_baseline: 0,
      org_id: orgId,
    })
    .select("id")
    .single();

  if (error || !created) {
    throw new ApiError(`Failed to create budget line: ${error?.message}`, 500);
  }
  return (created as { id: string }).id;
}

export const POST = withApiError(
  async (request: NextRequest, { params }: { params: { id: string } }) => {
    const membership = await getCurrentMembership();
    if (!membership) throw new ApiError("Not authenticated", 401);
    if (!["owner", "admin"].includes(membership.role)) throw new ApiError("Admin only", 403);

    const supabase = createServerClient();
    const { billing_ids } = (await request.json()) as { billing_ids: string[] };

    if (!Array.isArray(billing_ids) || billing_ids.length === 0) {
      throw new ApiError("billing_ids array is required", 400);
    }

    // Load draw and verify draft status
    const { data: draw } = await supabase
      .from("draws")
      .select("id, job_id, status")
      .eq("id", params.id)
      .eq("org_id", membership.org_id)
      .single();

    if (!draw) throw new ApiError("Draw not found", 404);
    if ((draw as { status: string }).status !== "draft") {
      throw new ApiError("Can only attach billings to a draft draw", 400);
    }

    const jobId = draw.job_id as string;
    const attached: Array<{ billing_id: string; draw_line_item_id: string; this_period: number }> = [];

    for (const billingId of billing_ids) {
      // Load billing and verify draft status
      const { data: billing } = await supabase
        .from("internal_billings")
        .select("id, status, amount_cents, percentage, cost_code_id, billing_type_id, internal_billing_types!billing_type_id (calculation_method)")
        .eq("id", billingId)
        .eq("org_id", membership.org_id)
        .single();

      if (!billing) {
        throw new ApiError(`Billing ${billingId} not found`, 404);
      }
      if ((billing as { status: string }).status === "attached") {
        throw new ApiError(`Billing ${billingId} is already attached`, 409);
      }

      const method = (billing as { internal_billing_types?: { calculation_method?: string } })
        .internal_billing_types?.calculation_method;

      // Determine this_period amount
      let thisPeriod = 0;
      if (method === "percentage") {
        // Will be computed by recomputePercentageBillings below
        thisPeriod = 0;
      } else {
        thisPeriod = (billing as { amount_cents: number }).amount_cents ?? 0;
      }

      // Resolve budget_line_id (NOT NULL on draw_line_items)
      const budgetLineId = await resolveBudgetLineId(
        supabase,
        jobId,
        (billing as { cost_code_id: string | null }).cost_code_id,
        membership.org_id
      );

      // Insert draw_line_items row
      const { data: lineItem, error: lineErr } = await supabase
        .from("draw_line_items")
        .insert({
          draw_id: params.id,
          budget_line_id: budgetLineId,
          source_type: "internal",
          internal_billing_id: billingId,
          this_period: thisPeriod,
          previous_applications: 0,
          total_to_date: thisPeriod,
          percent_complete: 0,
          balance_to_finish: 0,
          org_id: membership.org_id,
        })
        .select("id")
        .single();

      if (lineErr) throw new ApiError(lineErr.message, 500);
      const lineId = (lineItem as { id: string }).id;

      // Update internal_billings: status='attached', draw_line_item_id = new row id
      const { error: updateErr } = await supabase
        .from("internal_billings")
        .update({ status: "attached", draw_line_item_id: lineId })
        .eq("id", billingId);

      if (updateErr) throw new ApiError(updateErr.message, 500);

      attached.push({
        billing_id: billingId,
        draw_line_item_id: lineId,
        this_period: thisPeriod,
      });
    }

    // Recompute percentage billings now that all are attached
    await recomputePercentageBillings(params.id);

    return NextResponse.json({ attached });
  }
);

export const DELETE = withApiError(
  async (request: NextRequest, { params }: { params: { id: string } }) => {
    const membership = await getCurrentMembership();
    if (!membership) throw new ApiError("Not authenticated", 401);
    if (!["owner", "admin"].includes(membership.role)) throw new ApiError("Admin only", 403);

    const supabase = createServerClient();
    const url = new URL(request.url);
    const billingId = url.searchParams.get("billing_id");

    if (!billingId) {
      throw new ApiError("billing_id query parameter is required", 400);
    }

    // Find the draw_line_items row
    const { data: lineItem } = await supabase
      .from("draw_line_items")
      .select("id")
      .eq("draw_id", params.id)
      .eq("internal_billing_id", billingId)
      .is("deleted_at", null)
      .maybeSingle();

    if (!lineItem) {
      throw new ApiError("Billing is not attached to this draw", 404);
    }

    // Soft delete the draw_line_items row (draw_line_items HAS deleted_at)
    const { error: deleteErr } = await supabase
      .from("draw_line_items")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", (lineItem as { id: string }).id);

    if (deleteErr) throw new ApiError(deleteErr.message, 500);

    // Reset internal_billings back to draft
    const { error: updateErr } = await supabase
      .from("internal_billings")
      .update({ status: "draft", draw_line_item_id: null })
      .eq("id", billingId);

    if (updateErr) throw new ApiError(updateErr.message, 500);

    // Recompute percentage billings
    await recomputePercentageBillings(params.id);

    return NextResponse.json({ ok: true });
  }
);
