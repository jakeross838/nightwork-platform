import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { ApiError, withApiError } from "@/lib/api/errors";
import { getCurrentMembership } from "@/lib/org/session";

export const dynamic = "force-dynamic";

/**
 * POST /api/cost-intelligence/bom-attachments/[id]/confirm
 *
 * Marks an ai_suggested BOM attachment as confirmed by the PM. Idempotent:
 * confirming an already-confirmed attachment is a no-op. Confirming a
 * rejected attachment is a 409 — it was soft-deleted, the caller should
 * create a new attachment instead.
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
    const { data: userRes } = await supabase.auth.getUser();
    const userId = userRes.user?.id ?? null;

    const { data: attachment } = await supabase
      .from("line_bom_attachments")
      .select("id, org_id, confirmation_status, deleted_at")
      .eq("id", id)
      .maybeSingle();

    if (!attachment) throw new ApiError("Attachment not found", 404);
    const row = attachment as {
      id: string;
      org_id: string;
      confirmation_status: string;
      deleted_at: string | null;
    };
    if (row.org_id !== membership.org_id) {
      throw new ApiError("Attachment not in your org", 403);
    }
    if (row.deleted_at) {
      throw new ApiError(
        "Attachment was removed — create a new one instead of confirming",
        409
      );
    }
    if (row.confirmation_status === "confirmed") {
      return NextResponse.json({ ok: true, attachment_id: id, already: true });
    }

    const { error } = await supabase
      .from("line_bom_attachments")
      .update({
        confirmation_status: "confirmed",
        confirmed_by: userId,
        confirmed_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) throw new ApiError(error.message, 500);

    return NextResponse.json({ ok: true, attachment_id: id });
  }
);
