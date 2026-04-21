import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { ApiError, withApiError } from "@/lib/api/errors";
import { getCurrentMembership } from "@/lib/org/session";

export const dynamic = "force-dynamic";

/**
 * POST /api/cost-intelligence/extraction-lines/[id]/unflag
 *
 * Moves a previously-flagged extraction line (is_transaction_line=true or
 * verification_status='not_item') back into the normal classification flow
 * so the PM can re-classify it as a real catalog item. Typically invoked
 * from the Flagged / Notes tabs when something was auto-flagged that
 * actually deserves an item classification.
 */
export const POST = withApiError(
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
      .select("id, org_id, verification_status")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (!line) throw new ApiError("Line not found", 404);
    const row = line as { id: string; org_id: string; verification_status: string };
    if (row.org_id !== membership.org_id) throw new ApiError("Line not in your org", 403);

    const { error } = await supabase
      .from("invoice_extraction_lines")
      .update({
        is_transaction_line: false,
        transaction_line_type: null,
        non_item_reason: null,
        verification_status: "pending",
        verified_at: null,
        verified_by: null,
      })
      .eq("id", id);

    if (error) throw new ApiError(error.message, 500);

    return NextResponse.json({ ok: true, line_id: id });
  }
);
