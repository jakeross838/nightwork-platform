import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { ApiError, withApiError } from "@/lib/api/errors";
import { getCurrentMembership } from "@/lib/org/session";
import { requireRole, ADMIN_OR_OWNER } from "@/lib/org/require";
import { recalcBudgetLine, recalcPO } from "@/lib/recalc";
import { logActivity, logStatusChange } from "@/lib/activity-log";
import { canVoidPO, formatBlockers } from "@/lib/deletion-guards";
import { updateWithLock, isLockConflict } from "@/lib/api/optimistic-lock";
import {
  getClientForRequest,
  logImpersonatedWrite,
} from "@/lib/auth/impersonation-client";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const GET = withApiError(async (_req: NextRequest, { params }: { params: { id: string } }) => {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new ApiError("Not authenticated", 401);

  const { data, error } = await supabase
    .from("purchase_orders")
    .select(`
      id, job_id, po_number, description, amount, invoiced_total, status,
      issued_date, notes, vendor_id, budget_line_id, cost_code_id,
      status_history, created_at, updated_at,
      vendors:vendor_id(id, name, email, phone),
      cost_codes:cost_code_id(id, code, description),
      budget_lines:budget_line_id(id, cost_code_id, revised_estimate, cost_codes:cost_code_id(code, description)),
      jobs:job_id(id, name, address)
    `)
    .eq("id", params.id)
    .is("deleted_at", null)
    .single();
  if (error || !data) throw new ApiError("PO not found", 404);

  const { data: lineItems } = await supabase
    .from("po_line_items")
    .select(`
      id, po_id, budget_line_id, cost_code, description, amount, sort_order,
      budget_lines:budget_line_id(id, cost_codes:cost_code_id(code, description))
    `)
    .eq("po_id", params.id)
    .is("deleted_at", null)
    .order("sort_order");

  const { data: invoiceLines } = await supabase
    .from("invoice_line_items")
    .select(`
      id, invoice_id, description, amount_cents,
      invoices:invoice_id(id, invoice_number, invoice_date, status, vendor_name_raw)
    `)
    .eq("po_id", params.id)
    .is("deleted_at", null);

  return NextResponse.json({
    purchase_order: data,
    line_items: lineItems ?? [],
    invoice_lines: invoiceLines ?? [],
  });
});

interface PatchBody {
  vendor_id?: string | null;
  budget_line_id?: string | null;
  cost_code_id?: string | null;
  po_number?: string;
  description?: string;
  amount?: number;
  status?: "draft" | "issued" | "closed" | "void";
  issued_date?: string | null;
  notes?: string | null;
  note?: string;
  expected_updated_at?: string;
  line_items?: Array<{
    id?: string;
    budget_line_id?: string | null;
    cost_code?: string;
    description?: string;
    amount: number;
    sort_order?: number;
  }>;
}

export const PATCH = withApiError(async (request: NextRequest, { params }: { params: { id: string } }) => {
  // Defense-in-depth: RLS alone is a backstop. Phase 1.2 closed a gap where
  // a PM could PATCH a PO header (flip status, edit amount) because the only
  // enforcement was RLS — which shifted over migrations. Gate explicit here.
  const membership = await requireRole(ADMIN_OR_OWNER);
  const ctx = await getClientForRequest();
  if (!ctx.ok) throw new ApiError(`Impersonation rejected: ${ctx.reason}`, 401);
  const supabase = ctx.client;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new ApiError("Not authenticated", 401);

  const body: PatchBody = await request.json();
  const { data: po, error: fetchErr } = await supabase
    .from("purchase_orders")
    .select("status, status_history, amount, issued_date, budget_line_id")
    .eq("id", params.id)
    .is("deleted_at", null)
    .single();
  if (fetchErr || !po) throw new ApiError("PO not found", 404);

  const patch: Record<string, unknown> = {};
  if (body.vendor_id !== undefined) patch.vendor_id = body.vendor_id;
  if (body.budget_line_id !== undefined) patch.budget_line_id = body.budget_line_id;
  if (body.cost_code_id !== undefined) patch.cost_code_id = body.cost_code_id;
  if (body.po_number !== undefined) patch.po_number = body.po_number.trim();
  if (body.description !== undefined) patch.description = body.description;
  if (body.amount !== undefined) patch.amount = Math.max(0, Math.round(body.amount));
  if (body.issued_date !== undefined) patch.issued_date = body.issued_date;
  if (body.notes !== undefined) patch.notes = body.notes;

  if (body.status && body.status !== po.status) {
    // Void guard: if an invoice linked to this PO is already in a draw or
    // paid, voiding would orphan that committed spend.
    if (body.status === "void") {
      const guard = await canVoidPO(params.id);
      if (!guard.allowed) {
        await logActivity({
          org_id: membership.org_id,
          user_id: user.id,
          entity_type: "purchase_order",
          entity_id: params.id,
          action: "void_blocked",
          details: { blockers: guard.blockers },
        });
        throw new ApiError(formatBlockers("void", guard), 422);
      }
    }

    const history = Array.isArray(po.status_history) ? po.status_history : [];
    patch.status = body.status;
    patch.status_history = [
      ...history,
      {
        who: user.id,
        when: new Date().toISOString(),
        old_status: po.status,
        new_status: body.status,
        note: body.note ?? `Status → ${body.status}`,
      },
    ];
    if (body.status === "issued" && !po.issued_date) {
      patch.issued_date = new Date().toISOString().slice(0, 10);
    }
  }

  const lockResult = await updateWithLock(supabase, {
    table: "purchase_orders",
    id: params.id,
    orgId: membership.org_id,
    expectedUpdatedAt: body.expected_updated_at,
    updates: patch,
  });
  if (isLockConflict(lockResult)) {
    return lockResult.response;
  }

  // Phase 7b: void cascades. When a PO flips to void, detach every invoice
  // line that pointed at it (set po_id = null) so those lines fall back to
  // their cost-code-matched budget line. Log + recalc affected lines.
  const flippedToVoid = body.status === "void" && po.status !== "void";
  let affectedBudgetLineIds: string[] = [];
  if (flippedToVoid) {
    const { data: linked } = await supabase
      .from("invoice_line_items")
      .select("id, budget_line_id")
      .eq("po_id", params.id)
      .is("deleted_at", null);
    affectedBudgetLineIds = (linked ?? [])
      .map((l) => l.budget_line_id as string | null)
      .filter((x): x is string => !!x);
    if ((linked ?? []).length > 0) {
      await supabase
        .from("invoice_line_items")
        .update({ po_id: null })
        .eq("po_id", params.id)
        .is("deleted_at", null);
    }
  }

  // Replace line items if provided.
  if (body.line_items) {
    await supabase
      .from("po_line_items")
      .update({ deleted_at: new Date().toISOString() })
      .eq("po_id", params.id)
      .is("deleted_at", null);
    const rows = body.line_items
      .filter((li) => (li.amount ?? 0) > 0 || li.description)
      .map((li, idx) => ({
        org_id: membership.org_id,
        po_id: params.id,
        budget_line_id: li.budget_line_id ?? null,
        cost_code: li.cost_code ?? null,
        description: li.description ?? null,
        amount: Math.max(0, Math.round(li.amount ?? 0)),
        sort_order: li.sort_order ?? idx,
      }));
    if (rows.length > 0) {
      const { error: liErr } = await supabase.from("po_line_items").insert(rows);
      if (liErr) throw new ApiError(liErr.message, 500);
    }
  }

  // Phase 7b: recalc + log. Recalc hits the PO itself (so invoiced_total/
  // status are fresh) and the header's budget_line plus any detached lines.
  try {
    const budgetLinesToRecalc = new Set<string>();
    if (po.budget_line_id) budgetLinesToRecalc.add(po.budget_line_id as unknown as string);
    if (body.budget_line_id && body.budget_line_id !== po.budget_line_id) {
      budgetLinesToRecalc.add(body.budget_line_id);
    }
    for (const bl of affectedBudgetLineIds) budgetLinesToRecalc.add(bl);
    // If line_items were swapped, recalc every budget_line referenced in them.
    if (body.line_items) {
      for (const li of body.line_items) {
        if (li.budget_line_id) budgetLinesToRecalc.add(li.budget_line_id);
      }
    }
    for (const bl of Array.from(budgetLinesToRecalc)) await recalcBudgetLine(bl);
    await recalcPO(params.id);
  } catch (recalcErr) {
    console.warn(
      `[po patch recalc] ${recalcErr instanceof Error ? recalcErr.message : recalcErr}`
    );
  }

  if (body.status && body.status !== po.status) {
    await logStatusChange({
      org_id: membership.org_id,
      user_id: user.id,
      entity_type: "purchase_order",
      entity_id: params.id,
      from: po.status as string,
      to: body.status,
      reason: body.note,
      extra: flippedToVoid ? { detached_invoice_lines: affectedBudgetLineIds.length } : undefined,
    });
  } else {
    await logActivity({
      org_id: membership.org_id,
      user_id: user.id,
      entity_type: "purchase_order",
      entity_id: params.id,
      action: "updated",
      details: { fields: Object.keys(patch) },
    });
  }

  await logImpersonatedWrite(ctx, {
    target_record_type: "purchase_order",
    target_record_id: params.id,
    details: { patch_fields: Object.keys(body) },
    route: `/api/purchase-orders/${params.id}`,
    method: "PATCH",
  });

  return NextResponse.json({ ok: true });
});

export const DELETE = withApiError(async (_req: NextRequest, { params }: { params: { id: string } }) => {
  const membership = await getCurrentMembership();
  if (!membership) throw new ApiError("Not authenticated", 401);
  const ctx = await getClientForRequest();
  if (!ctx.ok) throw new ApiError(`Impersonation rejected: ${ctx.reason}`, 401);
  const supabase = ctx.client;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new ApiError("Not authenticated", 401);

  const guard = await canVoidPO(params.id);
  if (!guard.allowed) {
    await logActivity({
      org_id: membership.org_id,
      user_id: user.id,
      entity_type: "purchase_order",
      entity_id: params.id,
      action: "delete_blocked",
      details: { blockers: guard.blockers },
    });
    throw new ApiError(formatBlockers("delete", guard), 422);
  }

  // Grab budget_line_id so we can recalc after soft-delete.
  const { data: existing } = await supabase
    .from("purchase_orders")
    .select("budget_line_id, status")
    .eq("id", params.id)
    .single();

  const { error } = await supabase
    .from("purchase_orders")
    .update({ deleted_at: new Date().toISOString(), status: "void" })
    .eq("id", params.id);
  if (error) throw new ApiError(error.message, 500);

  if (existing?.budget_line_id) await recalcBudgetLine(existing.budget_line_id as string);
  await logActivity({
    org_id: membership.org_id,
    user_id: user.id,
    entity_type: "purchase_order",
    entity_id: params.id,
    action: "deleted",
    details: { from_status: existing?.status ?? null },
  });

  await logImpersonatedWrite(ctx, {
    target_record_type: "purchase_order",
    target_record_id: params.id,
    details: { soft_deleted: true },
    route: `/api/purchase-orders/${params.id}`,
    method: "DELETE",
  });

  return NextResponse.json({ ok: true });
});
