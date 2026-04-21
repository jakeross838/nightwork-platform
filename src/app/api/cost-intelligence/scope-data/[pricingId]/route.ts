import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { ApiError, withApiError } from "@/lib/api/errors";
import { getCurrentMembership } from "@/lib/org/session";

export const dynamic = "force-dynamic";

const ALLOWED_SOURCES = new Set([
  "invoice_extraction",
  "manual",
  "job_characteristics",
  "daily_log",
  "plan_ai",
  "inferred",
]);

interface Body {
  scope_size_value?: number | null;
  scope_size_source?: string | null;
  scope_size_confidence?: number | null;
  scope_size_notes?: string | null;
}

/**
 * PATCH /api/cost-intelligence/scope-data/[pricingId]
 *
 * Inline update of a single vendor_item_pricing row's scope fields. Used
 * by the scope data completion view when a PM fills in scope_size_value
 * from non-invoice sources (plan, memory, job characteristics).
 */
export const PATCH = withApiError(
  async (req: NextRequest, ctx: { params: Promise<{ pricingId: string }> }) => {
    const { pricingId } = await ctx.params;
    const membership = await getCurrentMembership();
    if (!membership) throw new ApiError("Not authenticated", 401);
    if (!["owner", "admin", "pm", "accounting"].includes(membership.role)) {
      throw new ApiError("Insufficient permissions", 403);
    }

    let body: Body;
    try {
      body = (await req.json()) as Body;
    } catch {
      throw new ApiError("Invalid JSON body", 400);
    }

    const supabase = createServerClient();

    const { data: row } = await supabase
      .from("vendor_item_pricing")
      .select("id, org_id")
      .eq("id", pricingId)
      .is("deleted_at", null)
      .maybeSingle();

    if (!row) throw new ApiError("Pricing row not found", 404);
    if ((row as { org_id: string }).org_id !== membership.org_id) {
      throw new ApiError("Pricing row not in your org", 403);
    }

    const value =
      body.scope_size_value === null
        ? null
        : typeof body.scope_size_value === "number" &&
          Number.isFinite(body.scope_size_value) &&
          body.scope_size_value > 0
        ? body.scope_size_value
        : undefined;

    if (value === undefined) {
      throw new ApiError(
        "scope_size_value must be a positive number (or null to clear)",
        400
      );
    }

    const source =
      value != null
        ? typeof body.scope_size_source === "string" &&
          ALLOWED_SOURCES.has(body.scope_size_source)
          ? body.scope_size_source
          : "manual"
        : null;

    const confidence =
      value != null &&
      typeof body.scope_size_confidence === "number" &&
      Number.isFinite(body.scope_size_confidence)
        ? Math.max(0, Math.min(1, body.scope_size_confidence))
        : null;

    const notes = typeof body.scope_size_notes === "string" ? body.scope_size_notes : null;

    const { error } = await supabase
      .from("vendor_item_pricing")
      .update({
        scope_size_value: value,
        scope_size_source: source,
        scope_size_confidence: confidence,
        scope_size_notes: notes,
      })
      .eq("id", pricingId);

    if (error) throw new ApiError(error.message, 500);

    return NextResponse.json({
      ok: true,
      pricing_id: pricingId,
      scope_size_value: value,
      scope_size_source: source,
    });
  }
);
