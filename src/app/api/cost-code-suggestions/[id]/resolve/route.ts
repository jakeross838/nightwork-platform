/**
 * Phase 3.4 Step 5 — POST /api/cost-code-suggestions/[id]/resolve
 *
 * Owner/admin-only resolve action. Approve creates an org_cost_codes
 * row from the suggestion's fields and links the suggestion's
 * approved_org_cost_code_id; reject sets status='rejected' with a
 * resolution_note.
 *
 * RLS already gates the UPDATE to owner/admin per migration 00087's
 * pcs_org_resolve policy. The route enforces the same role check at
 * the application layer (defense-in-depth).
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentMembership } from "@/lib/org/session";
import { ApiError, withApiError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

const RESOLVER_ROLES = new Set(["owner", "admin"]);

interface RouteContext {
  params: { id: string };
}

interface ResolveBody {
  action?: "approve" | "reject";
  resolution_note?: string | null;
}

export const POST = withApiError(async (
  request: NextRequest,
  context: RouteContext
) => {
  const membership = await getCurrentMembership();
  if (!membership) throw new ApiError("Not authenticated", 401);

  if (!RESOLVER_ROLES.has(membership.role)) {
    throw new ApiError(
      `Role ${membership.role} cannot resolve cost-code suggestions (owner/admin only)`,
      403
    );
  }

  const { id } = context.params;
  if (!id) throw new ApiError("Missing suggestion id", 400);

  const body = (await request.json().catch(() => null)) as ResolveBody | null;
  const action = body?.action;
  if (action !== "approve" && action !== "reject") {
    throw new ApiError("action must be 'approve' or 'reject'", 400);
  }
  const note = body?.resolution_note ?? null;
  if (action === "reject" && (!note || note.trim() === "")) {
    throw new ApiError("resolution_note is required when rejecting a suggestion", 400);
  }

  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new ApiError("Auth user lookup failed", 401);

  const { data: suggestion, error: loadError } = await supabase
    .from("pending_cost_code_suggestions")
    .select(
      "id, org_id, suggested_code, suggested_name, suggested_canonical_code_id, suggested_parent_code, status"
    )
    .eq("id", id)
    .eq("org_id", membership.org_id)
    .maybeSingle();

  if (loadError) throw new ApiError(`Failed to load suggestion: ${loadError.message}`, 500);
  if (!suggestion) throw new ApiError("Suggestion not found", 404);
  if (suggestion.status !== "pending") {
    throw new ApiError(
      `Suggestion is already ${suggestion.status}; cannot resolve again`,
      409
    );
  }

  const nowIso = new Date().toISOString();

  if (action === "reject") {
    const { error } = await supabase
      .from("pending_cost_code_suggestions")
      .update({
        status: "rejected",
        resolved_by: user.id,
        resolved_at: nowIso,
        resolution_note: note,
      })
      .eq("id", id)
      .eq("org_id", membership.org_id);
    if (error) throw new ApiError(`Failed to reject: ${error.message}`, 500);
    return NextResponse.json({ suggestion_id: id, status: "rejected" });
  }

  // Approve: create the org_cost_codes row, then link it on the suggestion.
  const { data: newCode, error: insertError } = await supabase
    .from("org_cost_codes")
    .insert({
      org_id: membership.org_id,
      code: suggestion.suggested_code,
      name: suggestion.suggested_name,
      parent_code: suggestion.suggested_parent_code,
      canonical_code_id: suggestion.suggested_canonical_code_id,
      is_active: true,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (insertError || !newCode) {
    // Could happen on UNIQUE(org_id, code) collision if the code was
    // separately created by another path (e.g., a duplicate pending row
    // was already approved). Surface the specific error for the operator.
    throw new ApiError(
      `Failed to create org_cost_codes row: ${insertError?.message ?? "no row returned"}`,
      500
    );
  }

  const { error: updateError } = await supabase
    .from("pending_cost_code_suggestions")
    .update({
      status: "approved",
      approved_org_cost_code_id: newCode.id,
      resolved_by: user.id,
      resolved_at: nowIso,
      resolution_note: note,
    })
    .eq("id", id)
    .eq("org_id", membership.org_id);

  if (updateError) {
    // org_cost_codes row already created — log but don't roll back. Operator
    // can manually link if needed. Future iteration could wrap both updates
    // in a SECURITY DEFINER function for atomicity.
    console.error(
      "[cost-code-suggestions/resolve] approval update failed after org_cost_codes insert:",
      updateError.message
    );
    throw new ApiError(
      `Created org_cost_codes row but failed to link suggestion: ${updateError.message}`,
      500
    );
  }

  return NextResponse.json({
    suggestion_id: id,
    status: "approved",
    approved_org_cost_code_id: newCode.id,
  });
});
