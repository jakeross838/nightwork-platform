import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { ApiError, withApiError } from "@/lib/api/errors";
import { getCurrentMembership } from "@/lib/org/session";
import { recalcBudgetLine, recalcJobContract } from "@/lib/recalc";
import { logActivity, logStatusChange } from "@/lib/activity-log";
import { canVoidCO, formatBlockers } from "@/lib/deletion-guards";

export const dynamic = "force-dynamic";

export const GET = withApiError(async (_req: NextRequest, { params }: { params: { id: string } }) => {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new ApiError("Not authenticated", 401);

  const { data, error } = await supabase
    .from("change_orders")
    .select(`
      id, job_id, pcco_number, title, description, amount, gc_fee_amount,
      gc_fee_rate, total_with_fee, estimated_days_added, status, co_type,
      submitted_date, approved_date, approved_by, denied_reason, draw_number,
      source_invoice_id, status_history, created_at,
      jobs:job_id(id, name, original_contract_amount, current_contract_amount)
    `)
    .eq("id", params.id)
    .is("deleted_at", null)
    .single();
  if (error || !data) throw new ApiError("Change order not found", 404);

  const { data: lines } = await supabase
    .from("change_order_lines")
    .select(`
      id, budget_line_id, cost_code, description, amount, sort_order,
      budget_lines:budget_line_id(id, cost_codes:cost_code_id(code, description))
    `)
    .eq("co_id", params.id)
    .is("deleted_at", null)
    .order("sort_order");

  return NextResponse.json({ change_order: data, lines: lines ?? [] });
});

interface PatchBody {
  title?: string;
  description?: string;
  amount?: number;
  gc_fee_rate?: number;
  estimated_days_added?: number | null;
  co_type?: "owner" | "internal";
  status?: "draft" | "pending" | "approved" | "denied" | "void" | "executed";
  denied_reason?: string;
  note?: string;
  lines?: Array<{
    budget_line_id?: string | null;
    cost_code?: string;
    description?: string;
    amount: number;
    sort_order?: number;
  }>;
}

export const PATCH = withApiError(async (request: NextRequest, { params }: { params: { id: string } }) => {
  const membership = await getCurrentMembership();
  if (!membership) throw new ApiError("Not authenticated", 401);
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new ApiError("Not authenticated", 401);

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["admin", "pm", "owner"].includes(profile.role)) {
    throw new ApiError("Only admins/PMs/owners can edit COs", 403);
  }

  const body: PatchBody = await request.json();

  const { data: co, error: fetchErr } = await supabase
    .from("change_orders")
    .select("job_id, status, status_history, amount, gc_fee_rate")
    .eq("id", params.id)
    .is("deleted_at", null)
    .single();
  if (fetchErr || !co) throw new ApiError("Change order not found", 404);

  // Once approved/executed, no edits except void.
  if (["approved", "executed"].includes(co.status) && body.status !== "void") {
    throw new ApiError("Approved change orders cannot be edited — void first", 422);
  }

  const patch: Record<string, unknown> = {};
  let amount = co.amount;
  let rate = co.gc_fee_rate;
  if (body.title !== undefined) patch.title = body.title;
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
  if (body.co_type !== undefined) patch.co_type = body.co_type;

  // Status transitions
  if (body.status && body.status !== co.status) {
    // Only owner/admin can approve or deny.
    if (["approved", "denied"].includes(body.status) && !["owner", "admin"].includes(profile.role)) {
      throw new ApiError("Only owners/admins can approve or deny change orders", 403);
    }

    // Void guard: block if draws were submitted after the CO was approved.
    if (body.status === "void" && ["approved", "executed"].includes(co.status)) {
      const guard = await canVoidCO(params.id);
      if (!guard.allowed) {
        await logActivity({
          org_id: membership.org_id,
          user_id: user.id,
          entity_type: "change_order",
          entity_id: params.id,
          action: "void_blocked",
          details: { blockers: guard.blockers },
        });
        throw new ApiError(formatBlockers("void", guard), 422);
      }
    }

    const history = Array.isArray(co.status_history) ? co.status_history : [];
    patch.status = body.status;
    patch.status_history = [
      ...history,
      {
        who: user.id,
        when: new Date().toISOString(),
        old_status: co.status,
        new_status: body.status,
        note: body.note ?? (body.status === "denied" && body.denied_reason ? body.denied_reason : `Status → ${body.status}`),
      },
    ];
    if (body.status === "pending") {
      patch.submitted_date = new Date().toISOString().slice(0, 10);
    }
    if (body.status === "approved") {
      patch.approved_date = new Date().toISOString().slice(0, 10);
      patch.approved_by = user.id;
    }
    if (body.status === "denied") {
      patch.denied_reason = body.denied_reason ?? body.note ?? "Denied";
    }
  }

  const { error: updateErr } = await supabase
    .from("change_orders")
    .update(patch)
    .eq("id", params.id);
  if (updateErr) throw new ApiError(updateErr.message, 500);

  // Replace lines if provided.
  if (body.lines) {
    await supabase
      .from("change_order_lines")
      .update({ deleted_at: new Date().toISOString() })
      .eq("co_id", params.id)
      .is("deleted_at", null);
    const rows = body.lines
      .filter((l) => l.amount !== 0 || l.description)
      .map((l, idx) => ({
        org_id: membership.org_id,
        co_id: params.id,
        budget_line_id: l.budget_line_id ?? null,
        cost_code: l.cost_code ?? null,
        description: l.description ?? null,
        amount: Math.round(l.amount ?? 0),
        sort_order: l.sort_order ?? idx,
      }));
    if (rows.length > 0) {
      const { error: lineErr } = await supabase.from("change_order_lines").insert(rows);
      if (lineErr) throw new ApiError(lineErr.message, 500);
    }
  }

  // Phase 7b: on status flip or line changes, recalc every budget line the
  // CO touches + the job contract; log the transition.
  try {
    const { data: allLines } = await supabase
      .from("change_order_lines")
      .select("budget_line_id, cost_code")
      .eq("co_id", params.id)
      .is("deleted_at", null);
    const budgetLineIds = new Set<string>();
    for (const l of allLines ?? []) {
      if (l.budget_line_id) budgetLineIds.add(l.budget_line_id as string);
    }

    // On approval, any CO line that references a cost_code without a
    // matching budget_line gets a new budget_line auto-created with
    // original_estimate=0 so the CO adjustment has somewhere to land.
    if (body.status === "approved") {
      const missing = (allLines ?? []).filter(
        (l) => !l.budget_line_id && l.cost_code
      );
      if (missing.length > 0) {
        const { data: codes } = await supabase
          .from("cost_codes")
          .select("id, code")
          .eq("org_id", membership.org_id)
          .in(
            "code",
            missing.map((m) => String(m.cost_code))
          )
          .is("deleted_at", null);
        const byCode = new Map((codes ?? []).map((c) => [c.code, c.id as string]));
        for (const l of missing) {
          const ccId = byCode.get(String(l.cost_code));
          if (!ccId) continue;
          const { data: created } = await supabase
            .from("budget_lines")
            .insert({
              org_id: membership.org_id,
              job_id: co.job_id,
              cost_code_id: ccId,
              original_estimate: 0,
              revised_estimate: 0,
              previous_applications_baseline: 0,
            })
            .select("id")
            .single();
          if (created?.id) {
            budgetLineIds.add(created.id as string);
            await supabase
              .from("change_order_lines")
              .update({ budget_line_id: created.id })
              .eq("co_id", params.id)
              .eq("cost_code", l.cost_code)
              .is("deleted_at", null);
          }
        }
      }
    }

    for (const bl of Array.from(budgetLineIds)) await recalcBudgetLine(bl);
    await recalcJobContract(co.job_id);
  } catch (recalcErr) {
    console.warn(
      `[co patch recalc] ${recalcErr instanceof Error ? recalcErr.message : recalcErr}`
    );
  }

  if (body.status && body.status !== co.status) {
    await logStatusChange({
      org_id: membership.org_id,
      user_id: user.id,
      entity_type: "change_order",
      entity_id: params.id,
      from: co.status as string,
      to: body.status,
      reason: body.denied_reason ?? body.note,
    });
  } else {
    await logActivity({
      org_id: membership.org_id,
      user_id: user.id,
      entity_type: "change_order",
      entity_id: params.id,
      action: "updated",
      details: { fields: Object.keys(patch) },
    });
  }

  return NextResponse.json({ ok: true });
});
