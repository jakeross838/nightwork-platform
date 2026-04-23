import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { ApiError, withApiError } from "@/lib/api/errors";
import { getCurrentMembership } from "@/lib/org/session";

export const dynamic = "force-dynamic";

interface Body {
  estimated_material_cents?: unknown;
}

/**
 * PUT /api/cost-intelligence/extraction-lines/[id]/split-scope
 *
 * Splits a scope line's single labor_and_material component into two:
 *   material    = body.estimated_material_cents
 *   labor       = raw_total_cents - estimated_material_cents
 *
 * The total always equals raw_total_cents — we don't fabricate amounts.
 * Existing components are soft-deleted; the two new rows are inserted.
 * scope_split_into_components + scope_estimated_material_cents are set on
 * the line so the UI can render the split view and allow revert.
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

    const materialCents =
      typeof body.estimated_material_cents === "number" &&
      Number.isFinite(body.estimated_material_cents)
        ? Math.round(body.estimated_material_cents)
        : null;
    if (materialCents == null || materialCents < 0) {
      throw new ApiError("estimated_material_cents must be a non-negative number", 400);
    }

    const supabase = createServerClient();

    const { data: line } = await supabase
      .from("document_extraction_lines")
      .select("id, org_id, line_nature, raw_total_cents, verification_status")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (!line) throw new ApiError("Line not found", 404);
    const row = line as {
      id: string;
      org_id: string;
      line_nature: string | null;
      raw_total_cents: number | null;
      verification_status: string;
    };
    if (row.org_id !== membership.org_id) throw new ApiError("Line not in your org", 403);
    if (row.line_nature !== "scope") {
      throw new ApiError("Split only applies to scope lines", 400);
    }
    const totalCents = row.raw_total_cents ?? 0;
    if (materialCents > totalCents) {
      throw new ApiError(
        `Material estimate ($${(materialCents / 100).toFixed(2)}) exceeds line total ($${(
          totalCents / 100
        ).toFixed(2)})`,
        400
      );
    }

    const laborCents = totalCents - materialCents;
    const now = new Date().toISOString();

    // Soft-delete existing components so the new split rows stand alone.
    await supabase
      .from("line_cost_components")
      .update({ deleted_at: now })
      .eq("invoice_extraction_line_id", id)
      .is("deleted_at", null);

    const rows: Array<Record<string, unknown>> = [];
    if (materialCents > 0) {
      rows.push({
        org_id: membership.org_id,
        invoice_extraction_line_id: id,
        component_type: "material",
        amount_cents: materialCents,
        source: "human_added",
        notes: "Material estimate from PM split",
        display_order: 0,
      });
    }
    if (laborCents > 0) {
      rows.push({
        org_id: membership.org_id,
        invoice_extraction_line_id: id,
        component_type: "labor",
        amount_cents: laborCents,
        source: "human_added",
        notes: "Labor = scope total − material estimate",
        display_order: 1,
      });
    }
    if (rows.length === 0) {
      // Degenerate: total is 0 — skip component rewrite but still mark split.
      rows.push({
        org_id: membership.org_id,
        invoice_extraction_line_id: id,
        component_type: "labor_and_material",
        amount_cents: 0,
        source: "default_bundled",
        display_order: 0,
      });
    }

    const { error: insertErr } = await supabase.from("line_cost_components").insert(rows);
    if (insertErr) throw new ApiError(insertErr.message, 500);

    const { error: lineErr } = await supabase
      .from("document_extraction_lines")
      .update({
        scope_split_into_components: true,
        scope_estimated_material_cents: materialCents,
      })
      .eq("id", id);
    if (lineErr) throw new ApiError(lineErr.message, 500);

    return NextResponse.json({
      ok: true,
      line_id: id,
      material_cents: materialCents,
      labor_cents: laborCents,
    });
  }
);
