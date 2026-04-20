import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { ApiError, withApiError } from "@/lib/api/errors";
import { getCurrentMembership } from "@/lib/org/session";
import { recomputePercentageBillings } from "@/lib/recompute-percentage-billings";
import {
  getClientForRequest,
  logImpersonatedWrite,
} from "@/lib/auth/impersonation-client";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

type AllocationInput = {
  cost_code_id: string;
  amount_cents: number;
  description?: string | null;
};

export const GET = withApiError(async (
  _req: NextRequest,
  context: { params: { id: string } }
) => {
  const membership = await getCurrentMembership();
  if (!membership) throw new ApiError("Not authenticated", 401);
  const supabase = createServerClient();

  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, org_id, total_amount, cost_code_id, description")
    .eq("id", context.params.id)
    .single();
  if (!invoice || invoice.org_id !== membership.org_id) {
    throw new ApiError("Invoice not found", 404);
  }

  const { data: existing } = await supabase
    .from("invoice_allocations")
    .select("id, invoice_id, cost_code_id, amount_cents, description, created_at")
    .eq("invoice_id", context.params.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  // BACKWARD COMPAT: invoices created before Phase D have no explicit
  // allocations. On first GET, materialize a single allocation matching
  // the legacy single-cost-code field so the editor has something to
  // display. New invoices created via Phase D UI will already have
  // explicit allocations.
  if ((existing ?? []).length === 0 && invoice.total_amount != null) {
    if (!invoice.cost_code_id) {
      return NextResponse.json({
        allocations: [],
        total: invoice.total_amount,
        auto_created: false,
      });
    }
    const { data: inserted } = await supabase
      .from("invoice_allocations")
      .insert({
        invoice_id: invoice.id,
        cost_code_id: invoice.cost_code_id,
        amount_cents: invoice.total_amount,
        description: invoice.description ?? null,
      })
      .select("id, invoice_id, cost_code_id, amount_cents, description, created_at")
      .single();
    return NextResponse.json({
      allocations: inserted ? [inserted] : [],
      total: invoice.total_amount,
      auto_created: true,
    });
  }

  return NextResponse.json({
    allocations: existing ?? [],
    total: invoice.total_amount,
    auto_created: false,
  });
});

export const PUT = withApiError(async (
  req: NextRequest,
  context: { params: { id: string } }
) => {
  const membership = await getCurrentMembership();
  if (!membership) throw new ApiError("Not authenticated", 401);
  if (!["owner", "admin", "pm"].includes(membership.role)) {
    throw new ApiError("Only admins/PMs can split invoices", 403);
  }
  const ctx = await getClientForRequest();
  if (!ctx.ok) throw new ApiError(`Impersonation rejected: ${ctx.reason}`, 401);
  const supabase = ctx.client;

  const body = (await req.json()) as { allocations: AllocationInput[] };
  if (!Array.isArray(body.allocations) || body.allocations.length === 0) {
    throw new ApiError("At least one allocation is required", 400);
  }

  const missing = body.allocations.some((a) => !a.cost_code_id);
  if (missing) {
    throw new ApiError("Every allocation must have a cost_code_id", 400);
  }

  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, org_id, total_amount, status, draw_id")
    .eq("id", context.params.id)
    .single();
  if (!invoice || invoice.org_id !== membership.org_id) {
    throw new ApiError("Invoice not found", 404);
  }
  if (["in_draw", "paid"].includes(invoice.status as string)) {
    throw new ApiError(
      `Cannot edit allocations on a ${invoice.status} invoice`,
      400
    );
  }

  const drawId = invoice.draw_id;
  if (drawId) {
    const { data: draw } = await supabase
      .from("draws")
      .select("status")
      .eq("id", drawId)
      .single();
    if (draw && !["draft", "pm_review"].includes(draw.status as string)) {
      throw new ApiError(
        "Cannot modify allocations: invoice is on a non-draft draw.",
        409
      );
    }
  }

  const sum = body.allocations.reduce((s, a) => s + Math.round(a.amount_cents ?? 0), 0);
  if (sum !== invoice.total_amount) {
    throw new ApiError(
      `Allocations sum to ${sum} cents but invoice total is ${invoice.total_amount} cents`,
      400
    );
  }

  // Soft-delete existing live allocations so the replacement set is clean.
  // Hard delete would lose audit history; past rows stay via deleted_at IS NOT NULL.
  await supabase
    .from("invoice_allocations")
    .update({ deleted_at: new Date().toISOString() })
    .eq("invoice_id", context.params.id)
    .is("deleted_at", null);

  const toInsert = body.allocations.map((a) => ({
    invoice_id: context.params.id,
    cost_code_id: a.cost_code_id,
    amount_cents: Math.round(a.amount_cents ?? 0),
    description: a.description ?? null,
  }));
  const { error: insErr } = await supabase
    .from("invoice_allocations")
    .insert(toInsert);
  if (insErr) throw new ApiError(insErr.message, 500);

  if (drawId) {
    await recomputePercentageBillings(drawId);
  }

  await logImpersonatedWrite(ctx, {
    target_record_type: "invoice",
    target_record_id: context.params.id,
    details: { allocations: toInsert, sum },
    route: `/api/invoices/${context.params.id}/allocations`,
    method: "PUT",
  });

  return NextResponse.json({ ok: true, count: toInsert.length });
});
