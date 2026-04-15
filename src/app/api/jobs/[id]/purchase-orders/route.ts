import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { ApiError, withApiError } from "@/lib/api/errors";
import { getCurrentMembership } from "@/lib/org/session";

export const dynamic = "force-dynamic";

interface CreatePoBody {
  vendor_id?: string | null;
  po_number?: string;
  description?: string;
  amount?: number; // cents
  budget_line_id?: string | null;
  cost_code_id?: string | null;
  issued_date?: string | null;
  notes?: string | null;
  line_items?: Array<{
    budget_line_id?: string | null;
    cost_code?: string;
    description?: string;
    amount: number;
    sort_order?: number;
  }>;
  status?: "draft" | "issued";
}

export const GET = withApiError(async (_req: NextRequest, { params }: { params: { id: string } }) => {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new ApiError("Not authenticated", 401);

  const { data, error } = await supabase
    .from("purchase_orders")
    .select(`
      id, po_number, description, amount, invoiced_total, status,
      issued_date, notes, vendor_id, budget_line_id, cost_code_id,
      created_at, updated_at,
      vendors:vendor_id(id, name),
      cost_codes:cost_code_id(id, code, description),
      budget_lines:budget_line_id(id, cost_code_id, cost_codes:cost_code_id(code, description))
    `)
    .eq("job_id", params.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) throw new ApiError(error.message, 500);
  return NextResponse.json({ purchase_orders: data ?? [] });
});

export const POST = withApiError(async (request: NextRequest, { params }: { params: { id: string } }) => {
  const membership = await getCurrentMembership();
  if (!membership) throw new ApiError("Not authenticated", 401);
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new ApiError("Not authenticated", 401);

  const body: CreatePoBody = await request.json();
  const amount = Math.max(0, Math.round(body.amount ?? 0));
  if (amount <= 0 && (!body.line_items || body.line_items.length === 0)) {
    throw new ApiError("Amount (or line items) is required", 400);
  }

  let poNumber = body.po_number?.trim();
  if (!poNumber) {
    const { data: nextNum } = await supabase.rpc("next_po_number", { p_org_id: membership.org_id });
    poNumber = (nextNum as string) || `PO-${Date.now()}`;
  }

  // Duplicate check within the org.
  const { data: existingPo } = await supabase
    .from("purchase_orders")
    .select("id")
    .eq("org_id", membership.org_id)
    .eq("po_number", poNumber)
    .is("deleted_at", null)
    .maybeSingle();
  if (existingPo) {
    throw new ApiError(`PO number "${poNumber}" already exists`, 409);
  }

  const status = body.status ?? "draft";
  const statusEntry = {
    who: user.id,
    when: new Date().toISOString(),
    old_status: null,
    new_status: status,
    note: "PO created",
  };

  // Compute total from line items if provided, otherwise use header amount.
  const lineTotal = (body.line_items ?? []).reduce((s, li) => s + Math.max(0, Math.round(li.amount ?? 0)), 0);
  const finalAmount = lineTotal > 0 ? lineTotal : amount;

  const { data: inserted, error: insertErr } = await supabase
    .from("purchase_orders")
    .insert({
      org_id: membership.org_id,
      job_id: params.id,
      vendor_id: body.vendor_id ?? null,
      cost_code_id: body.cost_code_id ?? null,
      budget_line_id: body.budget_line_id ?? null,
      po_number: poNumber,
      description: body.description ?? null,
      amount: finalAmount,
      status,
      issued_date: body.issued_date ?? (status === "issued" ? new Date().toISOString().slice(0, 10) : null),
      notes: body.notes ?? null,
      status_history: [statusEntry],
      created_by: user.id,
    })
    .select("id, po_number")
    .single();

  if (insertErr || !inserted) throw new ApiError(insertErr?.message ?? "Create failed", 500);

  // Insert line items.
  if (body.line_items && body.line_items.length > 0) {
    const rows = body.line_items
      .filter((li) => (li.amount ?? 0) > 0 || li.description)
      .map((li, idx) => ({
        org_id: membership.org_id,
        po_id: inserted.id,
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

  return NextResponse.json({ id: inserted.id, po_number: inserted.po_number });
});
