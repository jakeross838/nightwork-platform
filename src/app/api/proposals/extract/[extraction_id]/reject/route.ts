/**
 * Phase 3.4 Step 5 — POST /api/proposals/extract/[extraction_id]/reject
 *
 * Marks a document_extractions row as rejected without creating a
 * proposals entity. Called from ReviewManager's "Reject" button when
 * the PM determines the extraction shouldn't be committed (wrong
 * vendor, duplicate, mis-classified, etc.).
 *
 * The verification_status enum on document_extractions has the
 * 'rejected' value already, so we set it directly. status_history
 * isn't a column on document_extractions (it's a future-shape field
 * per migration 00076 Amendment B); we leave the audit trail to
 * api_usage + the verified_by/verified_at fields.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentMembership } from "@/lib/org/session";
import { ApiError, withApiError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: { extraction_id: string };
}

export const POST = withApiError(async (
  request: NextRequest,
  context: RouteContext
) => {
  const membership = await getCurrentMembership();
  if (!membership) throw new ApiError("Not authenticated", 401);

  const { extraction_id } = context.params;
  if (!extraction_id) throw new ApiError("Missing extraction_id", 400);

  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Validate the row exists, is a proposal, and isn't committed yet.
  const { data: row, error: loadError } = await supabase
    .from("document_extractions")
    .select(
      "id, classified_type, target_entity_type, target_entity_id, verification_status, deleted_at"
    )
    .eq("id", extraction_id)
    .eq("org_id", membership.org_id)
    .is("deleted_at", null)
    .maybeSingle();

  if (loadError) throw new ApiError(`Failed to load extraction: ${loadError.message}`, 500);
  if (!row) throw new ApiError("Extraction not found", 404);
  if (row.classified_type !== "proposal") {
    throw new ApiError(
      `Extraction is classified ${row.classified_type ?? "unknown"}, not proposal`,
      409
    );
  }
  if (row.target_entity_id) {
    throw new ApiError(
      "Extraction has already been committed; cannot reject after commit",
      409
    );
  }
  if (row.verification_status === "rejected") {
    return NextResponse.json({ extraction_id, status: "rejected", noop: true });
  }

  const { error: updateError } = await supabase
    .from("document_extractions")
    .update({
      verification_status: "rejected",
      verified_by: user?.id ?? null,
      verified_at: new Date().toISOString(),
    })
    .eq("id", extraction_id)
    .eq("org_id", membership.org_id);

  if (updateError) {
    throw new ApiError(`Failed to mark rejected: ${updateError.message}`, 500);
  }

  return NextResponse.json({ extraction_id, status: "rejected" });
});
