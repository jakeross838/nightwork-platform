import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { ApiError, withApiError } from "@/lib/api/errors";
import { getCurrentMembership } from "@/lib/org/session";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

interface PatchBody {
  name?: string;
  calculation_method?: string;
  default_amount_cents?: number | null;
  default_rate_cents?: number | null;
  default_quantity_unit?: string | null;
  default_percentage?: number | null;
  default_cost_code_id?: string | null;
  is_active?: boolean;
  sort_order?: number;
}

const VALID_METHODS = ["fixed", "rate_x_quantity", "percentage", "manual"] as const;

export const PATCH = withApiError(
  async (request: NextRequest, { params }: { params: { id: string } }) => {
    const membership = await getCurrentMembership();
    if (!membership) throw new ApiError("Not authenticated", 401);
    if (!["owner", "admin"].includes(membership.role)) throw new ApiError("Admin only", 403);

    const supabase = createServerClient();
    const body: PatchBody = await request.json();

    if (
      body.calculation_method !== undefined &&
      !VALID_METHODS.includes(body.calculation_method as typeof VALID_METHODS[number])
    ) {
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

    const patch: Record<string, unknown> = {};
    for (const k of [
      "name",
      "calculation_method",
      "default_amount_cents",
      "default_rate_cents",
      "default_quantity_unit",
      "default_percentage",
      "default_cost_code_id",
      "is_active",
      "sort_order",
    ] as const) {
      if (body[k] !== undefined) patch[k] = body[k];
    }
    if (Object.keys(patch).length === 0) {
      throw new ApiError("Nothing to update", 400);
    }

    const { data, error } = await supabase
      .from("internal_billing_types")
      .update(patch)
      .eq("id", params.id)
      .eq("org_id", membership.org_id)
      .select("*")
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new ApiError("A billing type with that name already exists", 409);
      }
      throw new ApiError(error.message, 500);
    }
    if (!data) throw new ApiError("Billing type not found", 404);

    return NextResponse.json(data);
  }
);
