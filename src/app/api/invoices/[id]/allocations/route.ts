import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { ApiError, withApiError } from "@/lib/api/errors";
import { getCurrentMembership } from "@/lib/org/session";
import { recomputePercentageBillings } from "@/lib/recompute-percentage-billings";
import {
  getClientForRequest,
  logImpersonatedWrite,
} from "@/lib/auth/impersonation-client";
import {
  isInvoiceLocked,
  canEditLockedFields,
} from "@/lib/invoice-permissions";
import { logFieldEdit } from "@/lib/audit/log-field-edit";

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
  // allocations. On first GET, materialize allocations from whatever
  // richer data we have.
  //
  // Priority:
  //   1. If invoice_line_items rows exist with assigned cost codes AND
  //      their amounts sum to invoice.total_amount, insert one
  //      allocation per cost-code group (summed amount, first line's
  //      description as the allocation description). This preserves
  //      the PM-approved split.
  //   2. Else fall back to a single allocation matching the legacy
  //      invoice-level cost_code_id (pre-existing behaviour).
  //   3. Else (no invoice-level cost code either) return an empty set
  //      so the editor prompts the user to create allocations.
  //
  // Guards:
  //   - Only runs when the allocations set is currently empty —
  //     user-created allocations are never overwritten.
  //   - Line-item backfill requires the line items to sum exactly to
  //     invoice.total_amount (the invariant the PUT route enforces);
  //     any mismatch falls through to the single-row stub so the
  //     invariant never gets violated by the auto-create path.
  if ((existing ?? []).length === 0 && invoice.total_amount != null) {
    const { data: lineItems } = await supabase
      .from("invoice_line_items")
      .select("cost_code_id, amount_cents, description, line_index")
      .eq("invoice_id", context.params.id)
      .is("deleted_at", null)
      .order("line_index", { ascending: true });

    const assignedLineItems = (lineItems ?? []).filter(
      (li): li is { cost_code_id: string; amount_cents: number; description: string | null; line_index: number } =>
        li.cost_code_id != null
    );
    const lineItemSum = assignedLineItems.reduce(
      (s, li) => s + (li.amount_cents ?? 0),
      0
    );

    if (assignedLineItems.length > 0 && lineItemSum === invoice.total_amount) {
      const groups = new Map<
        string,
        { amount_cents: number; description: string | null }
      >();
      for (const li of assignedLineItems) {
        const prev = groups.get(li.cost_code_id);
        if (prev) {
          prev.amount_cents += li.amount_cents;
        } else {
          // Preserve the first (lowest line_index) line's description
          // as the allocation description — deterministic and the
          // earliest-dated context is usually the most descriptive.
          groups.set(li.cost_code_id, {
            amount_cents: li.amount_cents,
            description: li.description ?? null,
          });
        }
      }
      const toInsert = Array.from(groups.entries()).map(
        ([cost_code_id, g]) => ({
          invoice_id: invoice.id,
          cost_code_id,
          amount_cents: g.amount_cents,
          description: g.description,
        })
      );
      const { data: inserted } = await supabase
        .from("invoice_allocations")
        .insert(toInsert)
        .select("id, invoice_id, cost_code_id, amount_cents, description, created_at")
        .order("created_at", { ascending: true });
      return NextResponse.json({
        allocations: inserted ?? [],
        total: invoice.total_amount,
        auto_created: true,
      });
    }

    // Fall through to the legacy single-row stub.
    if (assignedLineItems.length > 0 && lineItemSum !== invoice.total_amount) {
      console.warn(
        `[allocations auto-create] invoice ${invoice.id}: assigned line items sum ${lineItemSum}¢ ≠ total ${invoice.total_amount}¢ — falling back to invoice-level stub`
      );
    }
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
  // accounting joins owner/admin/pm as of Phase 3a — accounting
  // must be able to edit allocations on locked invoices as part of
  // the QA-into-main-page unification.
  if (!["owner", "admin", "pm", "accounting"].includes(membership.role)) {
    throw new ApiError("Unauthorized", 403);
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
  // Phase 3a: lock-aware authorization. Non-privileged roles (pm)
  // cannot modify allocations on locked invoices — privileged roles
  // (accounting, admin, owner) can, and the edit is audit-logged
  // further down.
  const invoiceLocked = isInvoiceLocked(invoice.status as string);
  if (invoiceLocked && !canEditLockedFields(membership.role)) {
    throw new ApiError(
      `Cannot edit allocations on a ${invoice.status} invoice — requires privileged role`,
      403
    );
  }
  // Hard data-integrity block: in_draw/paid are also locked per
  // Phase 3a spec, but even privileged users cannot edit allocations
  // on an invoice already attached to a submitted draw or paid out
  // — that would desync draw math / payment records. Separate check
  // so the 400 message is distinct from the lock 403.
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

  // Capture the pre-save allocation set for the audit log below.
  // Only needed when this is a privileged override on a locked
  // invoice — but cheap to fetch either way, and keeps the audit
  // path simple.
  const { data: previousAllocations } = await supabase
    .from("invoice_allocations")
    .select("cost_code_id, amount_cents, description")
    .eq("invoice_id", context.params.id)
    .is("deleted_at", null);

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

  // Phase 3a: audit-log privileged edits on locked invoices. The
  // `if (!locked)` early-return keeps normal pm_review saves out of
  // activity_log — that's just routine editing, not an override.
  if (invoiceLocked && canEditLockedFields(membership.role)) {
    const {
      data: { user: auditUser },
    } = await supabase.auth.getUser();
    if (auditUser) {
      await logFieldEdit({
        invoiceId: context.params.id,
        orgId: membership.org_id,
        userId: auditUser.id,
        field: "allocations",
        oldValue: previousAllocations ?? [],
        newValue: toInsert.map((a) => ({
          cost_code_id: a.cost_code_id,
          amount_cents: a.amount_cents,
          description: a.description,
        })),
        byRole: membership.role,
      });
    }
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
