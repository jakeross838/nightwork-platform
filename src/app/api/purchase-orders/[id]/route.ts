import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { ApiError, withApiError } from "@/lib/api/errors";
import { getCurrentMembership } from "@/lib/org/session";

export const dynamic = "force-dynamic";

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
  const membership = await getCurrentMembership();
  if (!membership) throw new ApiError("Not authenticated", 401);
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new ApiError("Not authenticated", 401);

  const body: PatchBody = await request.json();
  const { data: po, error: fetchErr } = await supabase
    .from("purchase_orders")
    .select("status, status_history, amount, issued_date")
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

  const { error: updateErr } = await supabase
    .from("purchase_orders")
    .update(patch)
    .eq("id", params.id);
  if (updateErr) throw new ApiError(updateErr.message, 500);

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

  return NextResponse.json({ ok: true });
});

export const DELETE = withApiError(async (_req: NextRequest, { params }: { params: { id: string } }) => {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new ApiError("Not authenticated", 401);

  const { error } = await supabase
    .from("purchase_orders")
    .update({ deleted_at: new Date().toISOString(), status: "void" })
    .eq("id", params.id);
  if (error) throw new ApiError(error.message, 500);
  return NextResponse.json({ ok: true });
});
