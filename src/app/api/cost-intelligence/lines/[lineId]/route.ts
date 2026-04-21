import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { ApiError, withApiError } from "@/lib/api/errors";
import { getCurrentMembership } from "@/lib/org/session";
import {
  commitLineToSpine,
  rejectExtractionLine,
} from "@/lib/cost-intelligence/commit-line-to-spine";
import { correctLine } from "@/lib/cost-intelligence/correct-line";
import type { ProposedItemData } from "@/lib/cost-intelligence/types";

export const dynamic = "force-dynamic";

type ActionBody =
  | { action: "approve" }
  | {
      action: "correct";
      corrected_item_id?: string;
      corrected_proposed_data?: ProposedItemData;
      correction_notes?: string;
    }
  | { action: "reject"; notes?: string };

/**
 * POST /api/cost-intelligence/lines/[lineId]
 *
 * Verification mutations on a single extraction line. Body:
 *   { action: "approve" } — commit as-is
 *   { action: "correct", corrected_item_id | corrected_proposed_data, ... }
 *   { action: "reject", notes? }
 */
export const POST = withApiError(async (req: NextRequest, ctx: { params: Promise<{ lineId: string }> }) => {
  const { lineId } = await ctx.params;
  const membership = await getCurrentMembership();
  if (!membership) throw new ApiError("Not authenticated", 401);
  if (!["owner", "admin", "pm", "accounting"].includes(membership.role)) {
    throw new ApiError("Insufficient permissions", 403);
  }

  const supabase = createServerClient();
  const { data: user } = await supabase.auth.getUser();
  const userId = user.user?.id ?? null;

  // Authorize: line belongs to caller's org
  const { data: line } = await supabase
    .from("invoice_extraction_lines")
    .select("id, org_id")
    .eq("id", lineId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!line) throw new ApiError("Line not found", 404);
  if ((line as { org_id: string }).org_id !== membership.org_id) {
    throw new ApiError("Line not in your org", 403);
  }

  const body: ActionBody = await req.json();

  if (body.action === "approve") {
    const result = await commitLineToSpine(supabase, lineId, {
      verifiedBy: userId,
      newStatus: "verified",
    });
    return NextResponse.json({ ok: true, result });
  }

  if (body.action === "correct") {
    if (!userId) throw new ApiError("Must be logged in to correct", 401);
    if (!body.corrected_item_id && !body.corrected_proposed_data) {
      throw new ApiError(
        "Must supply corrected_item_id or corrected_proposed_data",
        400
      );
    }
    const result = await correctLine(
      supabase,
      lineId,
      {
        corrected_item_id: body.corrected_item_id,
        corrected_proposed_data: body.corrected_proposed_data,
        correction_notes: body.correction_notes,
      },
      userId
    );
    return NextResponse.json({ ok: true, result });
  }

  if (body.action === "reject") {
    await rejectExtractionLine(supabase, lineId, userId, body.notes);
    return NextResponse.json({ ok: true });
  }

  throw new ApiError("Unknown action", 400);
});
