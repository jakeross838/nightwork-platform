import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { ApiError, withApiError } from "@/lib/api/errors";
import { getCurrentMembership } from "@/lib/org/session";
import { logActivity } from "@/lib/activity-log";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

interface CreateCoBody {
  title?: string;
  description?: string;
  amount?: number; // cents — base amount before GC fee
  gc_fee_rate?: number;
  estimated_days_added?: number | null;
  co_type?: "owner" | "internal";
  source_invoice_id?: string | null;
  submit_for_approval?: boolean;
  lines?: Array<{
    budget_line_id?: string | null;
    cost_code?: string;
    description?: string;
    amount: number;
    sort_order?: number;
  }>;
}

export const GET = withApiError(async (_req: NextRequest, { params }: { params: { id: string } }) => {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new ApiError("Not authenticated", 401);

  const { data, error } = await supabase
    .from("change_orders")
    .select(`
      id, job_id, pcco_number, title, description, amount,
      gc_fee_amount, gc_fee_rate, total_with_fee, estimated_days_added,
      status, co_type, submitted_date, approved_date, approved_by,
      denied_reason, draw_number, source_invoice_id, status_history,
      created_at, updated_at
    `)
    .eq("job_id", params.id)
    .is("deleted_at", null)
    .order("pcco_number", { ascending: true });

  if (error) throw new ApiError(error.message, 500);
  return NextResponse.json({ change_orders: data ?? [] });
});

export const POST = withApiError(async (request: NextRequest, { params }: { params: { id: string } }) => {
  const membership = await getCurrentMembership();
  if (!membership) throw new ApiError("Not authenticated", 401);
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new ApiError("Not authenticated", 401);

  if (!["admin", "pm", "owner"].includes(membership.role)) {
    throw new ApiError("Only admins/PMs/owners can create COs", 403);
  }

  const body: CreateCoBody = await request.json();
  const title = (body.title ?? body.description ?? "").trim();
  if (!title) throw new ApiError("Title is required", 400);

  const coType = body.co_type ?? "owner";
  const amount = Math.max(0, Math.round(body.amount ?? 0));
  const rate = Math.max(0, Math.min(1, body.gc_fee_rate ?? 0));
  const feeAmount = Math.round(amount * rate);
  const totalWithFee = amount + feeAmount;

  // Next pcco_number per job
  const { data: maxRow } = await supabase
    .from("change_orders")
    .select("pcco_number")
    .eq("job_id", params.id)
    .is("deleted_at", null)
    .order("pcco_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextNumber = ((maxRow as { pcco_number?: number } | null)?.pcco_number ?? 0) + 1;

  const initialStatus = body.submit_for_approval ? "pending" : "draft";
  const statusEntry = {
    who: user.id,
    when: new Date().toISOString(),
    old_status: null,
    new_status: initialStatus,
    note: body.source_invoice_id
      ? `Created from invoice ${body.source_invoice_id}`
      : initialStatus === "pending" ? "Submitted for approval" : "Draft created",
  };

  const { data: coRow, error } = await supabase
    .from("change_orders")
    .insert({
      org_id: membership.org_id,
      job_id: params.id,
      pcco_number: nextNumber,
      title,
      description: body.description ?? null,
      amount,
      gc_fee_rate: rate,
      gc_fee_amount: feeAmount,
      total_with_fee: totalWithFee,
      estimated_days_added: body.estimated_days_added ?? 0,
      status: initialStatus,
      co_type: coType,
      submitted_date: initialStatus === "pending" ? new Date().toISOString().slice(0, 10) : null,
      source_invoice_id: body.source_invoice_id ?? null,
      status_history: [statusEntry],
      created_by: user.id,
    })
    .select("id, pcco_number")
    .single();

  if (error) throw new ApiError(error.message, 500);

  if (coRow && body.lines && body.lines.length > 0) {
    const rows = body.lines
      .filter((l) => l.amount !== 0 || l.description)
      .map((l, idx) => ({
        org_id: membership.org_id,
        co_id: coRow.id,
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

  if (coRow) {
    await logActivity({
      org_id: membership.org_id,
      user_id: user.id,
      entity_type: "change_order",
      entity_id: coRow.id,
      action: "created",
      details: {
        pcco_number: coRow.pcco_number,
        amount,
        co_type: coType,
        initial_status: initialStatus,
      },
    });
  }

  return NextResponse.json({ id: coRow?.id, pcco_number: coRow?.pcco_number });
});
