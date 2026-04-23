import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { ApiError, withApiError } from "@/lib/api/errors";
import { getCurrentMembership } from "@/lib/org/session";

export const dynamic = "force-dynamic";

const RECLASSIFY_ALLOWED = new Set([
  "material",
  "labor",
  "scope",
  "equipment",
  "service",
]);

interface Body {
  new_line_nature?: unknown;
}

/**
 * PUT /api/cost-intelligence/extraction-lines/[id]/reclassify
 *
 * Updates line_nature on an extraction_line. Used from the Review tab when
 * a PM classifies an 'unclassified' line into a concrete bucket. Not meant
 * for reassigning bom_spec lines — use the BOM attachment endpoints for
 * that flow.
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

    const nature =
      typeof body.new_line_nature === "string" ? body.new_line_nature.toLowerCase() : "";
    if (!RECLASSIFY_ALLOWED.has(nature)) {
      throw new ApiError(
        "new_line_nature must be one of: material, labor, scope, equipment, service",
        400
      );
    }

    const supabase = createServerClient();

    const { data: line } = await supabase
      .from("document_extraction_lines")
      .select("id, org_id, line_nature")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (!line) throw new ApiError("Line not found", 404);
    const row = line as { id: string; org_id: string; line_nature: string | null };
    if (row.org_id !== membership.org_id) throw new ApiError("Line not in your org", 403);

    const { error } = await supabase
      .from("document_extraction_lines")
      .update({ line_nature: nature })
      .eq("id", id);

    if (error) throw new ApiError(error.message, 500);

    return NextResponse.json({ ok: true, line_id: id, line_nature: nature });
  }
);
