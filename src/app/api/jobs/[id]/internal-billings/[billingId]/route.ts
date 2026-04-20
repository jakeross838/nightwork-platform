import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { ApiError, withApiError } from "@/lib/api/errors";
import { getCurrentMembership } from "@/lib/org/session";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

interface PatchBody {
  billing_type_id?: string;
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

export const PATCH = withApiError(
  async (
    request: NextRequest,
    { params }: { params: { id: string; billingId: string } }
  ) => {
    const membership = await getCurrentMembership();
    if (!membership) throw new ApiError("Not authenticated", 401);
    if (!["owner", "admin"].includes(membership.role)) throw new ApiError("Admin only", 403);

    const supabase = createServerClient();
    const body: PatchBody = await request.json();

    if (
      body.percentage != null &&
      (body.percentage < 0 || body.percentage > 1)
    ) {
      throw new ApiError("percentage must be between 0 and 1", 400);
    }

    // Build patch object from provided fields
    const patch: Record<string, unknown> = {};
    for (const k of [
      "billing_type_id",
      "cost_code_id",
      "description",
      "amount_cents",
      "rate_cents",
      "quantity",
      "percentage",
      "period_start",
      "period_end",
      "notes",
    ] as const) {
      if (body[k] !== undefined) patch[k] = body[k];
    }
    if (Object.keys(patch).length === 0) {
      throw new ApiError("Nothing to update", 400);
    }

    // For rate_x_quantity: recompute amount_cents if rate_cents or quantity changed
    if (body.rate_cents !== undefined || body.quantity !== undefined) {
      // Load current row to merge with incoming changes
      const { data: current } = await supabase
        .from("internal_billings")
        .select("rate_cents, quantity, billing_type_id, internal_billing_types!billing_type_id (calculation_method)")
        .eq("id", params.billingId)
        .eq("org_id", membership.org_id)
        .is("deleted_at", null)
        .single();

      if (!current) throw new ApiError("Billing not found", 404);

      const method = (current as { internal_billing_types?: { calculation_method?: string } })
        .internal_billing_types?.calculation_method;

      if (method === "rate_x_quantity") {
        const rate = body.rate_cents ?? (current as { rate_cents?: number }).rate_cents ?? 0;
        const qty = body.quantity ?? (current as { quantity?: number }).quantity ?? 0;
        patch.amount_cents = Math.round(rate * qty);
      }
    }

    const { data, error } = await supabase
      .from("internal_billings")
      .update(patch)
      .eq("id", params.billingId)
      .eq("org_id", membership.org_id)
      .is("deleted_at", null)
      .select("*")
      .single();

    if (error) throw new ApiError(error.message, 500);
    if (!data) throw new ApiError("Billing not found", 404);

    return NextResponse.json(data);
  }
);

export const DELETE = withApiError(
  async (
    _request: NextRequest,
    { params }: { params: { id: string; billingId: string } }
  ) => {
    const membership = await getCurrentMembership();
    if (!membership) throw new ApiError("Not authenticated", 401);
    if (!["owner", "admin"].includes(membership.role)) throw new ApiError("Admin only", 403);

    const supabase = createServerClient();

    // Load current row to check status
    const { data: billing } = await supabase
      .from("internal_billings")
      .select("id, status")
      .eq("id", params.billingId)
      .eq("org_id", membership.org_id)
      .is("deleted_at", null)
      .single();

    if (!billing) throw new ApiError("Billing not found", 404);
    if ((billing as { status: string }).status !== "draft") {
      throw new ApiError("Cannot delete non-draft billing", 409);
    }

    // Soft delete — migration 00045 added deleted_at to internal_billings.
    const { error } = await supabase
      .from("internal_billings")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", params.billingId)
      .eq("org_id", membership.org_id);

    if (error) throw new ApiError(error.message, 500);
    return NextResponse.json({ ok: true });
  }
);
