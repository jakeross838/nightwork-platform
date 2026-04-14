import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { ApiError, withApiError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

export const GET = withApiError(async (_req: NextRequest, { params }: { params: { id: string } }) => {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new ApiError("Not authenticated", 401);

  const { data, error } = await supabase
    .from("change_orders")
    .select(`
      id, job_id, pcco_number, description, amount, gc_fee_amount, gc_fee_rate,
      total_with_fee, estimated_days_added, status, approved_date, draw_number,
      source_invoice_id, status_history, created_at
    `)
    .eq("id", params.id)
    .is("deleted_at", null)
    .single();
  if (error || !data) throw new ApiError("Change order not found", 404);

  const { data: alloc } = await (supabase
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from("change_order_budget_lines") as any)
    .select("id, budget_line_id, amount")
    .eq("change_order_id", params.id)
    .is("deleted_at", null);

  return NextResponse.json({ change_order: data, allocations: alloc ?? [] });
});

interface PatchBody {
  description?: string;
  amount?: number;
  gc_fee_rate?: number;
  estimated_days_added?: number | null;
  status?: "draft" | "pending_approval" | "approved" | "executed" | "void";
  note?: string;
  allocations?: Array<{ budget_line_id: string; amount: number }>;
}

export const PATCH = withApiError(async (request: NextRequest, { params }: { params: { id: string } }) => {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new ApiError("Not authenticated", 401);

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["admin", "pm"].includes(profile.role)) {
    throw new ApiError("Only admins/PMs can edit COs", 403);
  }

  const body: PatchBody = await request.json();

  const { data: co, error: fetchErr } = await supabase
    .from("change_orders")
    .select("job_id, status, status_history, amount, gc_fee_rate")
    .eq("id", params.id)
    .is("deleted_at", null)
    .single();
  if (fetchErr || !co) throw new ApiError("Change order not found", 404);

  // Once executed, no edits.
  if (co.status === "executed" && body.status !== "void") {
    throw new ApiError("Executed change orders cannot be edited", 422);
  }

  const patch: Record<string, unknown> = {};
  let amount = co.amount;
  let rate = co.gc_fee_rate;
  if (body.description !== undefined) patch.description = body.description;
  if (body.amount !== undefined) {
    amount = Math.max(0, Math.round(body.amount));
    patch.amount = amount;
  }
  if (body.gc_fee_rate !== undefined) {
    rate = Math.max(0, Math.min(1, body.gc_fee_rate));
    patch.gc_fee_rate = rate;
  }
  if (body.amount !== undefined || body.gc_fee_rate !== undefined) {
    const feeAmount = Math.round(amount * rate);
    patch.gc_fee_amount = feeAmount;
    patch.total_with_fee = amount + feeAmount;
  }
  if (body.estimated_days_added !== undefined) patch.estimated_days_added = body.estimated_days_added;

  // Status transitions
  if (body.status && body.status !== co.status) {
    const history = Array.isArray(co.status_history) ? co.status_history : [];
    const entry = {
      who: "pm",
      when: new Date().toISOString(),
      old_status: co.status,
      new_status: body.status,
      note: body.note ?? `Status → ${body.status}`,
    };
    patch.status = body.status;
    patch.status_history = [...history, entry];
    if (body.status === "approved") {
      patch.approved_date = new Date().toISOString().slice(0, 10);
    }
    // Executing triggers budget line revision + job contract update.
    if (body.status === "executed") {
      patch.approved_date = patch.approved_date ?? new Date().toISOString().slice(0, 10);
      await executeCo(supabase, params.id, co.job_id, amount + Math.round(amount * rate));
    }
  }

  const { error: updateErr } = await supabase
    .from("change_orders")
    .update(patch)
    .eq("id", params.id);
  if (updateErr) throw new ApiError(updateErr.message, 500);

  // Replace allocations if provided
  if (body.allocations) {
    await (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase.from("change_order_budget_lines") as any
    )
      .update({ deleted_at: new Date().toISOString() })
      .eq("change_order_id", params.id)
      .is("deleted_at", null);
    const rows = body.allocations
      .filter((a) => a.budget_line_id && a.amount > 0)
      .map((a) => ({
        change_order_id: params.id,
        budget_line_id: a.budget_line_id,
        amount: Math.max(0, Math.round(a.amount)),
        org_id: "00000000-0000-0000-0000-000000000001",
      }));
    if (rows.length > 0) {
      const { error: allocErr } = await (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        supabase.from("change_order_budget_lines") as any
      ).insert(rows);
      if (allocErr) throw new ApiError(allocErr.message, 500);
    }
  }

  return NextResponse.json({ ok: true });
});

async function executeCo(
  supabase: ReturnType<typeof createServerClient>,
  coId: string,
  jobId: string,
  contractDelta: number
) {
  // Apply allocations to budget_lines.revised_estimate
  const { data: allocs } = await (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase.from("change_order_budget_lines") as any
  )
    .select("budget_line_id, amount")
    .eq("change_order_id", coId)
    .is("deleted_at", null);

  if (allocs && allocs.length > 0) {
    for (const a of allocs as Array<{ budget_line_id: string; amount: number }>) {
      const { data: bl } = await supabase
        .from("budget_lines")
        .select("revised_estimate")
        .eq("id", a.budget_line_id)
        .single();
      const cur = (bl as { revised_estimate?: number } | null)?.revised_estimate ?? 0;
      await supabase
        .from("budget_lines")
        .update({ revised_estimate: cur + a.amount })
        .eq("id", a.budget_line_id);
    }
  }

  // Update job current contract amount
  const { data: job } = await supabase
    .from("jobs")
    .select("current_contract_amount")
    .eq("id", jobId)
    .single();
  const cur = (job as { current_contract_amount?: number } | null)?.current_contract_amount ?? 0;
  await supabase
    .from("jobs")
    .update({ current_contract_amount: cur + contractDelta })
    .eq("id", jobId);
}
