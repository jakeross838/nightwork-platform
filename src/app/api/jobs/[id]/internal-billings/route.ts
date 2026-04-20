import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { tryCreateServiceRoleClient } from "@/lib/supabase/service";
import { ApiError, withApiError } from "@/lib/api/errors";
import { getCurrentMembership } from "@/lib/org/session";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const GET = withApiError(
  async (_req: NextRequest, { params }: { params: { id: string } }) => {
    const membership = await getCurrentMembership();
    if (!membership) throw new ApiError("Not authenticated", 401);

    const supabase = tryCreateServiceRoleClient() ?? createServerClient();
    const { data, error } = await supabase
      .from("internal_billings")
      .select(
        `*, internal_billing_types!billing_type_id (name, calculation_method), cost_codes!cost_code_id (code, description)`
      )
      .eq("job_id", params.id)
      .eq("org_id", membership.org_id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) throw new ApiError(error.message, 500);
    return NextResponse.json(data ?? []);
  }
);

interface CreateBody {
  billing_type_id: string;
  cost_code_id?: string | null;
  description?: string | null;
  amount_cents?: number;
  rate_cents?: number | null;
  quantity?: number | null;
  percentage?: number | null;
  period_start?: string | null;
  period_end?: string | null;
  notes?: string | null;
}

export const POST = withApiError(
  async (request: NextRequest, { params }: { params: { id: string } }) => {
    const membership = await getCurrentMembership();
    if (!membership) throw new ApiError("Not authenticated", 401);
    if (!["owner", "admin"].includes(membership.role)) throw new ApiError("Admin only", 403);

    const supabase = createServerClient();
    const body: CreateBody = await request.json();

    if (!body.billing_type_id) {
      throw new ApiError("billing_type_id is required", 400);
    }
    if (
      body.percentage != null &&
      (body.percentage < 0 || body.percentage > 1)
    ) {
      throw new ApiError("percentage must be between 0 and 1", 400);
    }

    // Look up the billing type to determine calculation_method
    const { data: billingType } = await supabase
      .from("internal_billing_types")
      .select("calculation_method")
      .eq("id", body.billing_type_id)
      .single();

    let amountCents = Math.round(body.amount_cents ?? 0);
    const method = (billingType as { calculation_method: string } | null)?.calculation_method;

    if (method === "rate_x_quantity" && body.rate_cents != null && body.quantity != null) {
      amountCents = Math.round(body.rate_cents * body.quantity);
    } else if (method === "percentage") {
      // Percentage billings are computed at attach-time
      amountCents = 0;
    }

    const { data, error } = await supabase
      .from("internal_billings")
      .insert({
        org_id: membership.org_id,
        job_id: params.id,
        billing_type_id: body.billing_type_id,
        cost_code_id: body.cost_code_id ?? null,
        description: body.description ?? null,
        amount_cents: amountCents,
        rate_cents: body.rate_cents ?? null,
        quantity: body.quantity ?? null,
        percentage: body.percentage ?? null,
        period_start: body.period_start ?? null,
        period_end: body.period_end ?? null,
        notes: body.notes ?? null,
        status: "draft",
      })
      .select("*")
      .single();

    if (error) throw new ApiError(error.message, 500);
    return NextResponse.json(data);
  }
);
