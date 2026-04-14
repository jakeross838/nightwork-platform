import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { ApiError, withApiError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

const DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000001";

interface CreateCoBody {
  description: string;
  amount: number; // cents — base amount before GC fee
  gc_fee_rate: number; // 0..1 (e.g. 0.18, 0.20, 0)
  estimated_days_added?: number | null;
  source_invoice_id?: string | null;
  allocations?: Array<{ budget_line_id: string; amount: number }>; // cents
}

export const GET = withApiError(async (_req: NextRequest, { params }: { params: { id: string } }) => {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new ApiError("Not authenticated", 401);

  const { data, error } = await supabase
    .from("change_orders")
    .select(`
      id, pcco_number, description, amount, gc_fee_amount, gc_fee_rate,
      total_with_fee, estimated_days_added, status, approved_date, draw_number,
      source_invoice_id, status_history, created_at, updated_at
    `)
    .eq("job_id", params.id)
    .is("deleted_at", null)
    .order("pcco_number", { ascending: true });

  if (error) throw new ApiError(error.message, 500);
  return NextResponse.json({ change_orders: data ?? [] });
});

export const POST = withApiError(async (request: NextRequest, { params }: { params: { id: string } }) => {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new ApiError("Not authenticated", 401);

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["admin", "pm"].includes(profile.role)) {
    throw new ApiError("Only admins/PMs can create COs", 403);
  }

  const body: CreateCoBody = await request.json();
  if (!body.description?.trim()) throw new ApiError("Description is required", 400);
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

  const statusEntry = {
    who: "pm",
    when: new Date().toISOString(),
    old_status: null,
    new_status: "draft",
    note: body.source_invoice_id
      ? `Created from invoice ${body.source_invoice_id}`
      : "Draft created",
  };

  const { data: coRow, error } = await supabase
    .from("change_orders")
    .insert({
      job_id: params.id,
      pcco_number: nextNumber,
      description: body.description.trim(),
      amount,
      gc_fee_rate: rate,
      gc_fee_amount: feeAmount,
      total_with_fee: totalWithFee,
      estimated_days_added: body.estimated_days_added ?? 0,
      status: "draft",
      source_invoice_id: body.source_invoice_id ?? null,
      status_history: [statusEntry],
      org_id: DEFAULT_ORG_ID,
      created_by: user.id,
    })
    .select("id, pcco_number")
    .single();

  if (error) throw new ApiError(error.message, 500);

  // Insert allocations (optional)
  if (body.allocations && body.allocations.length > 0 && coRow) {
    const rows = body.allocations
      .filter((a) => a.budget_line_id && a.amount > 0)
      .map((a) => ({
        change_order_id: coRow.id,
        budget_line_id: a.budget_line_id,
        amount: Math.max(0, Math.round(a.amount)),
        org_id: DEFAULT_ORG_ID,
      }));
    if (rows.length > 0) {
      const { error: allocErr } = await (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        supabase.from("change_order_budget_lines") as any
      ).insert(rows);
      if (allocErr) throw new ApiError(allocErr.message, 500);
    }
  }

  return NextResponse.json({ id: coRow?.id, pcco_number: coRow?.pcco_number });
});
