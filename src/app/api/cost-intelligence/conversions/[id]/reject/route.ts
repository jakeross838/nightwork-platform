import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { ApiError, withApiError } from "@/lib/api/errors";
import { getCurrentMembership } from "@/lib/org/session";

export const dynamic = "force-dynamic";

/**
 * POST /api/cost-intelligence/conversions/[id]/reject
 *
 * Marks the suggestion as rejected. Does not change existing pricing
 * rows — they keep their ai_suggested_pending source so we can still
 * identify rows that need attention later. Rejected suggestions stay
 * in the table as an audit trail (we don't want the AI proposing the
 * exact same bad ratio twice without a human noticing).
 */
export const POST = withApiError(async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const membership = await getCurrentMembership();
  if (!membership) throw new ApiError("Not authenticated", 401);
  if (!["owner", "admin", "pm", "accounting"].includes(membership.role)) {
    throw new ApiError("Insufficient permissions", 403);
  }

  const supabase = createServerClient();
  const { data: userRes } = await supabase.auth.getUser();
  const userId = userRes.user?.id ?? null;

  const { data: suggestion } = await supabase
    .from("unit_conversion_suggestions")
    .select("id, org_id, status")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!suggestion) throw new ApiError("Suggestion not found", 404);
  const s = suggestion as { id: string; org_id: string; status: string };
  if (s.org_id !== membership.org_id) throw new ApiError("Suggestion not in your org", 403);
  if (s.status !== "pending") throw new ApiError(`Suggestion already ${s.status}`, 409);

  const { error } = await supabase
    .from("unit_conversion_suggestions")
    .update({
      status: "rejected",
      confirmed_by: userId,
      confirmed_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new ApiError(error.message, 500);

  return NextResponse.json({ ok: true });
});
