import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { ApiError, withApiError } from "@/lib/api/errors";
import { getCurrentMembership } from "@/lib/org/session";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const VALID_METHODS = ["fixed", "rate_x_quantity", "percentage", "manual"] as const;

export const GET = withApiError(async (request: NextRequest) => {
  const membership = await getCurrentMembership();
  if (!membership) throw new ApiError("Not authenticated", 401);

  const includeInactive = request.nextUrl.searchParams.get("all") === "true";

  const supabase = createServerClient();
  let query = supabase
    .from("internal_billing_types")
    .select("*")
    .eq("org_id", membership.org_id);

  if (!includeInactive) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) throw new ApiError(error.message, 500);
  return NextResponse.json(data ?? []);
});

interface CreateBody {
  name: string;
  calculation_method: string;
  default_amount_cents?: number | null;
  default_rate_cents?: number | null;
  default_quantity_unit?: string | null;
  default_percentage?: number | null;
  default_cost_code_id?: string | null;
  sort_order?: number;
}

export const POST = withApiError(async (request: NextRequest) => {
  const membership = await getCurrentMembership();
  if (!membership) throw new ApiError("Not authenticated", 401);
  if (!["owner", "admin"].includes(membership.role)) throw new ApiError("Admin only", 403);

  const supabase = createServerClient();
  const body: CreateBody = await request.json();

  if (!body.name?.trim()) throw new ApiError("Name is required", 400);
  if (!VALID_METHODS.includes(body.calculation_method as typeof VALID_METHODS[number])) {
    throw new ApiError(
      `calculation_method must be one of: ${VALID_METHODS.join(", ")}`,
      400
    );
  }
  if (
    body.default_percentage != null &&
    (body.default_percentage < 0 || body.default_percentage > 1)
  ) {
    throw new ApiError("default_percentage must be between 0 and 1", 400);
  }

  const { data, error } = await supabase
    .from("internal_billing_types")
    .insert({
      org_id: membership.org_id,
      name: body.name.trim(),
      calculation_method: body.calculation_method,
      default_amount_cents: body.default_amount_cents ?? null,
      default_rate_cents: body.default_rate_cents ?? null,
      default_quantity_unit: body.default_quantity_unit ?? null,
      default_percentage: body.default_percentage ?? null,
      default_cost_code_id: body.default_cost_code_id ?? null,
      sort_order: body.sort_order ?? 0,
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new ApiError(`Billing type "${body.name}" already exists`, 409);
    }
    throw new ApiError(error.message, 500);
  }
  return NextResponse.json(data);
});
