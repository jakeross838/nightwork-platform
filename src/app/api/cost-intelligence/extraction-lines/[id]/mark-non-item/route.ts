import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { ApiError, withApiError } from "@/lib/api/errors";
import { getCurrentMembership } from "@/lib/org/session";
import type { TransactionLineType } from "@/lib/cost-intelligence/types";

export const dynamic = "force-dynamic";

const ALLOWED_TYPES: TransactionLineType[] = [
  "progress_payment",
  "draw",
  "rental_period",
  "service_period",
  "change_order_narrative",
  "partial_payment",
  "other",
];

/**
 * POST /api/cost-intelligence/extraction-lines/[id]/mark-non-item
 *
 * Body: { transaction_line_type: TransactionLineType, non_item_reason?: string }
 *
 * Marks an extraction line as a non-catalog item (billing event,
 * recurring service, draw payment, etc.) so it never enters the spine.
 * Does NOT create a vendor_item_pricing row. The line is removed from
 * the pending queue but preserved in the extraction for audit.
 */
export const POST = withApiError(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const membership = await getCurrentMembership();
  if (!membership) throw new ApiError("Not authenticated", 401);
  if (!["owner", "admin", "pm", "accounting"].includes(membership.role)) {
    throw new ApiError("Insufficient permissions", 403);
  }

  let body: { transaction_line_type?: string; non_item_reason?: string } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const type = body.transaction_line_type as TransactionLineType | undefined;
  if (!type || !ALLOWED_TYPES.includes(type)) {
    throw new ApiError(
      `transaction_line_type must be one of: ${ALLOWED_TYPES.join(", ")}`,
      400
    );
  }

  const supabase = createServerClient();
  const { data: userRes } = await supabase.auth.getUser();
  const userId = userRes.user?.id ?? null;

  // Authorize: line belongs to the caller's org.
  const { data: line } = await supabase
    .from("document_extraction_lines")
    .select("id, org_id, verification_status")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!line) throw new ApiError("Extraction line not found", 404);
  const row = line as { id: string; org_id: string; verification_status: string };
  if (row.org_id !== membership.org_id) throw new ApiError("Line not in your org", 403);
  if (row.verification_status !== "pending") {
    throw new ApiError(
      `Line is already ${row.verification_status} — can only mark pending lines as non-item`,
      409
    );
  }

  const { error } = await supabase
    .from("document_extraction_lines")
    .update({
      verification_status: "not_item",
      transaction_line_type: type,
      non_item_reason: body.non_item_reason ?? null,
      verified_at: new Date().toISOString(),
      verified_by: userId,
    })
    .eq("id", id);

  if (error) throw new ApiError(error.message, 500);

  return NextResponse.json({ ok: true, line_id: id, transaction_line_type: type });
});
