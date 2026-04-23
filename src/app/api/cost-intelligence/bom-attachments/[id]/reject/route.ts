import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { ApiError, withApiError } from "@/lib/api/errors";
import { getCurrentMembership } from "@/lib/org/session";

export const dynamic = "force-dynamic";

/**
 * POST /api/cost-intelligence/bom-attachments/[id]/reject
 *
 * Soft-deletes a BOM attachment and reclassifies the underlying $0 spec
 * line back to 'unclassified' so the PM sees it in the Review tab. The
 * attachment row is preserved (deleted_at set) so the audit trail survives.
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

    const { data: attachment } = await supabase
      .from("line_bom_attachments")
      .select("id, org_id, bom_extraction_line_id, deleted_at")
      .eq("id", id)
      .maybeSingle();

    if (!attachment) throw new ApiError("Attachment not found", 404);
    const row = attachment as {
      id: string;
      org_id: string;
      bom_extraction_line_id: string;
      deleted_at: string | null;
    };
    if (row.org_id !== membership.org_id) {
      throw new ApiError("Attachment not in your org", 403);
    }
    if (row.deleted_at) {
      return NextResponse.json({ ok: true, attachment_id: id, already: true });
    }

    const now = new Date().toISOString();

    const { error: attachErr } = await supabase
      .from("line_bom_attachments")
      .update({ confirmation_status: "rejected", deleted_at: now })
      .eq("id", id);
    if (attachErr) throw new ApiError(attachErr.message, 500);

    // The $0 spec line becomes an orphan — move it to the Review tab so the
    // PM can decide what to do (re-attach elsewhere, reclassify, or skip).
    const { error: lineErr } = await supabase
      .from("document_extraction_lines")
      .update({ line_nature: "unclassified" })
      .eq("id", row.bom_extraction_line_id)
      .eq("org_id", membership.org_id);
    if (lineErr) throw new ApiError(lineErr.message, 500);

    return NextResponse.json({
      ok: true,
      attachment_id: id,
      bom_line_id: row.bom_extraction_line_id,
    });
  }
);
