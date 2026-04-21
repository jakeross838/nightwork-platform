import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { ApiError, withApiError } from "@/lib/api/errors";
import { getCurrentMembership } from "@/lib/org/session";

export const dynamic = "force-dynamic";

/**
 * PUT /api/cost-intelligence/extraction-lines/[id]/revert-split
 *
 * Undoes a prior split-scope call: soft-deletes the material + labor
 * components and restores a single labor_and_material component equal to
 * raw_total_cents. scope_split_into_components is cleared.
 */
export const PUT = withApiError(
  async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const membership = await getCurrentMembership();
    if (!membership) throw new ApiError("Not authenticated", 401);
    if (!["owner", "admin", "pm", "accounting"].includes(membership.role)) {
      throw new ApiError("Insufficient permissions", 403);
    }

    const supabase = createServerClient();

    const { data: line } = await supabase
      .from("invoice_extraction_lines")
      .select("id, org_id, line_nature, raw_total_cents")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (!line) throw new ApiError("Line not found", 404);
    const row = line as {
      id: string;
      org_id: string;
      line_nature: string | null;
      raw_total_cents: number | null;
    };
    if (row.org_id !== membership.org_id) throw new ApiError("Line not in your org", 403);
    if (row.line_nature !== "scope") {
      throw new ApiError("Revert-split only applies to scope lines", 400);
    }

    const now = new Date().toISOString();
    const totalCents = row.raw_total_cents ?? 0;

    await supabase
      .from("line_cost_components")
      .update({ deleted_at: now })
      .eq("invoice_extraction_line_id", id)
      .is("deleted_at", null);

    const { error: insertErr } = await supabase.from("line_cost_components").insert([
      {
        org_id: membership.org_id,
        invoice_extraction_line_id: id,
        component_type: "labor_and_material",
        amount_cents: totalCents,
        source: "default_bundled",
        display_order: 0,
      },
    ]);
    if (insertErr) throw new ApiError(insertErr.message, 500);

    const { error: lineErr } = await supabase
      .from("invoice_extraction_lines")
      .update({
        scope_split_into_components: false,
        scope_estimated_material_cents: null,
      })
      .eq("id", id);
    if (lineErr) throw new ApiError(lineErr.message, 500);

    return NextResponse.json({ ok: true, line_id: id });
  }
);
