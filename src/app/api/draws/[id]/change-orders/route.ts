import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { ApiError, withApiError } from "@/lib/api/errors";
import { getCurrentMembership } from "@/lib/org/session";
import { recalcDraftDrawsForJob } from "@/lib/draw-calc";
import { recomputePercentageBillings } from "@/lib/recompute-percentage-billings";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

type AttachBody = { change_order_ids: string[] };

/**
 * GET: COs already attached to this draw + approved COs available to
 * attach (not yet on any draw).
 */
export const GET = withApiError(async (
  _req: NextRequest,
  context: { params: { id: string } }
) => {
  const membership = await getCurrentMembership();
  if (!membership) throw new ApiError("Not authenticated", 401);
  const supabase = createServerClient();

  const { data: draw } = await supabase
    .from("draws")
    .select("id, job_id")
    .eq("id", context.params.id)
    .eq("org_id", membership.org_id)
    .single();
  if (!draw) throw new ApiError("Draw not found", 404);

  const { data: attached } = await supabase
    .from("draw_line_items")
    .select(
      "id, change_order_id, this_period, " +
        "change_orders:change_order_id (id, pcco_number, title, description, amount, gc_fee_amount, gc_fee_rate, total_with_fee, status, co_type)"
    )
    .eq("draw_id", context.params.id)
    .eq("source_type", "change_order")
    .is("deleted_at", null);

  const { data: available } = await supabase
    .from("change_orders")
    .select(
      "id, pcco_number, title, description, amount, gc_fee_amount, gc_fee_rate, total_with_fee, application_number, co_type, status"
    )
    .eq("job_id", draw.job_id)
    .eq("org_id", membership.org_id)
    .in("status", ["approved", "executed"])
    .is("deleted_at", null)
    .is("draw_number", null)
    .order("pcco_number", { ascending: true });

  return NextResponse.json({
    attached: attached ?? [],
    available: available ?? [],
    job_id: draw.job_id,
  });
});

export const POST = withApiError(async (
  req: NextRequest,
  context: { params: { id: string } }
) => {
  const membership = await getCurrentMembership();
  if (!membership) throw new ApiError("Not authenticated", 401);
  if (!["owner", "admin", "pm"].includes(membership.role)) {
    throw new ApiError("Forbidden", 403);
  }
  const supabase = createServerClient();
  const body = (await req.json()) as AttachBody;
  if (!Array.isArray(body.change_order_ids) || body.change_order_ids.length === 0) {
    throw new ApiError("change_order_ids is required", 400);
  }

  const { data: draw } = await supabase
    .from("draws")
    .select("id, job_id, draw_number, status")
    .eq("id", context.params.id)
    .eq("org_id", membership.org_id)
    .is("deleted_at", null)
    .single();
  if (!draw) throw new ApiError("Draw not found", 404);
  if (!["draft", "pm_review"].includes(draw.status as string)) {
    throw new ApiError(`Cannot attach to a ${draw.status} draw`, 400);
  }

  const { data: cos } = await supabase
    .from("change_orders")
    .select("id, total_with_fee, amount, gc_fee_amount")
    .in("id", body.change_order_ids)
    .eq("job_id", draw.job_id)
    .eq("org_id", membership.org_id)
    .is("deleted_at", null);
  if (!cos || cos.length === 0) throw new ApiError("No valid change orders", 400);

  const { data: job } = await supabase
    .from("jobs")
    .select("starting_application_number")
    .eq("id", draw.job_id)
    .single();
  const startingAppNum = job?.starting_application_number ?? null;
  const appNumber = startingAppNum !== null
    ? startingAppNum + (draw.draw_number as number) - 1
    : null;

  type CO = { id: string; total_with_fee: number; amount: number; gc_fee_amount: number };
  const inserted: string[] = [];
  for (const co of (cos ?? []) as CO[]) {
    const amt = co.total_with_fee ?? co.amount + (co.gc_fee_amount ?? 0);

    const { data: line, error: insErr } = await supabase
      .from("draw_line_items")
      .insert({
        draw_id: context.params.id,
        budget_line_id: null,
        source_type: "change_order",
        change_order_id: co.id,
        previous_applications: 0,
        this_period: amt,
        total_to_date: amt,
        percent_complete: 0,
        balance_to_finish: 0,
        org_id: membership.org_id,
      })
      .select("id")
      .single();
    if (insErr) throw new ApiError(`Insert failed for CO ${co.id}: ${insErr.message}`, 500);

    await supabase
      .from("change_orders")
      .update({
        draw_number: draw.draw_number,
        application_number: appNumber,
        updated_at: new Date().toISOString(),
      })
      .eq("id", co.id);

    inserted.push((line as { id: string }).id);
  }

  await recomputePercentageBillings(context.params.id);
  try {
    await recalcDraftDrawsForJob(draw.job_id as string);
  } catch {
    /* non-fatal */
  }

  return NextResponse.json({ ok: true, inserted_count: inserted.length });
});

export const DELETE = withApiError(async (
  req: NextRequest,
  context: { params: { id: string } }
) => {
  const membership = await getCurrentMembership();
  if (!membership) throw new ApiError("Not authenticated", 401);
  if (!["owner", "admin", "pm"].includes(membership.role)) {
    throw new ApiError("Forbidden", 403);
  }
  const { searchParams } = new URL(req.url);
  const coId = searchParams.get("change_order_id");
  if (!coId) throw new ApiError("change_order_id is required", 400);

  const supabase = createServerClient();
  const { data: line } = await supabase
    .from("draw_line_items")
    .select("id")
    .eq("draw_id", context.params.id)
    .eq("org_id", membership.org_id)
    .eq("change_order_id", coId)
    .is("deleted_at", null)
    .maybeSingle();
  if (line) {
    await supabase
      .from("draw_line_items")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", (line as { id: string }).id)
      .eq("org_id", membership.org_id);
  }
  await supabase
    .from("change_orders")
    .update({ draw_number: null, application_number: null, updated_at: new Date().toISOString() })
    .eq("id", coId)
    .eq("org_id", membership.org_id);

  await recomputePercentageBillings(context.params.id);
  const { data: draw } = await supabase
    .from("draws")
    .select("job_id")
    .eq("id", context.params.id)
    .eq("org_id", membership.org_id)
    .single();
  if (draw?.job_id) {
    try {
      await recalcDraftDrawsForJob(draw.job_id as string);
    } catch {
      /* non-fatal */
    }
  }

  return NextResponse.json({ ok: true });
});
