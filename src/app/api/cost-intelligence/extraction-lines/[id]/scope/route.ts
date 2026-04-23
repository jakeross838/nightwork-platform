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
  pricing_model?: "unit" | "scope";
  scope_size_metric?: string | null;
  scope_size_value?: number | null;
  scope_size_source?: string | null;
  scope_size_confidence?: number | null;
}

/**
 * PUT /api/cost-intelligence/extraction-lines/[id]/scope
 *
 * Updates proposed_pricing_model + proposed_scope_size_metric +
 * extracted_scope_size_value / confidence / source on a pending extraction
 * line. Used by the verification detail panel when a PM fills in (or
 * corrects) a scope size before committing.
 */
export const PUT = withApiError(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
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

    const { data: line } = await supabase
      .from("document_extraction_lines")
      .select("id, org_id, verification_status")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (!line) throw new ApiError("Line not found", 404);
    const row = line as { id: string; org_id: string; verification_status: string };
    if (row.org_id !== membership.org_id) throw new ApiError("Line not in your org", 403);

    const pricingModel = body.pricing_model === "scope" ? "scope" : "unit";
    const metric =
      pricingModel === "scope" && typeof body.scope_size_metric === "string"
        ? body.scope_size_metric.trim().toLowerCase().replace(/\s+/g, "_") || null
        : null;

    const value =
      pricingModel === "scope" &&
      typeof body.scope_size_value === "number" &&
      Number.isFinite(body.scope_size_value) &&
      body.scope_size_value > 0
        ? body.scope_size_value
        : null;

    const source =
      pricingModel === "scope" && value != null
        ? typeof body.scope_size_source === "string" &&
          ALLOWED_SOURCES.has(body.scope_size_source)
          ? body.scope_size_source
          : "manual"
        : null;

    const confidence =
      pricingModel === "scope" &&
      value != null &&
      typeof body.scope_size_confidence === "number" &&
      Number.isFinite(body.scope_size_confidence)
        ? Math.max(0, Math.min(1, body.scope_size_confidence))
        : null;

    const { error } = await supabase
      .from("document_extraction_lines")
      .update({
        proposed_pricing_model: pricingModel,
        proposed_scope_size_metric: metric,
        extracted_scope_size_value: value,
        extracted_scope_size_source: source,
        extracted_scope_size_confidence: confidence,
      })
      .eq("id", id);

    if (error) throw new ApiError(error.message, 500);

    return NextResponse.json({
      ok: true,
      line_id: id,
      pricing_model: pricingModel,
      scope_size_value: value,
      scope_size_metric: metric,
      scope_size_source: source,
    });
  }
);
