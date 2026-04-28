/**
 * Phase 3.4 Step 5 — POST /api/proposals/[proposal_id]/convert-to-po
 *
 * STUB. Phase 3.5 will replace this with the real PO-generation
 * pipeline (see amendment-1 §Phase 3.5). Until then, this route
 * returns 501 Not Implemented with a clear message so the review
 * form's "Convert to PO" action surfaces a soft "saved but not
 * converted" alert (proposal save already succeeded via
 * /api/proposals/commit before this route was hit).
 *
 * The route is auth-gated and org-scoped so an unauthorized caller
 * can't probe for proposal ids — same defense-in-depth as live
 * routes. We do NOT mutate the proposal status here; flipping to
 * 'converted_to_po' without an actual PO would corrupt the audit
 * trail. Phase 3.5 owns the real status transition once a PO is
 * generated.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentMembership } from "@/lib/org/session";
import { ApiError, withApiError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: { proposal_id: string };
}

export const POST = withApiError(async (
  request: NextRequest,
  context: RouteContext
) => {
  const membership = await getCurrentMembership();
  if (!membership) throw new ApiError("Not authenticated", 401);

  const { proposal_id } = context.params;
  if (!proposal_id) throw new ApiError("Missing proposal_id", 400);

  const supabase = createServerClient();
  const { data: row, error } = await supabase
    .from("proposals")
    .select("id, status, deleted_at")
    .eq("id", proposal_id)
    .eq("org_id", membership.org_id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw new ApiError(`Failed to load proposal: ${error.message}`, 500);
  if (!row) throw new ApiError("Proposal not found", 404);

  return NextResponse.json(
    {
      error: "Convert to PO not yet implemented",
      detail:
        "Phase 3.5 will ship the PO-generation pipeline. Until then, the proposal has been saved but no PO has been created.",
      phase: "3.5",
      proposal_id,
      proposal_status: row.status,
    },
    { status: 501 }
  );
});
