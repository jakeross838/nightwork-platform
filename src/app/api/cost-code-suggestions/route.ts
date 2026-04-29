/**
 * Phase 3.4 Step 5 — POST /api/cost-code-suggestions
 *
 * Creates a pending_cost_code_suggestions row. Called from
 * ReviewManager's "Suggest new code" modal.
 *
 * RLS already gates writes via migration 00087 — INSERT is open to
 * roles owner/admin/pm/accounting on rows where org_id matches an
 * active membership. The route mirrors the RLS as a defense-in-depth
 * application gate.
 *
 * Resolve (approve / reject) is a separate route at
 * /api/cost-code-suggestions/[id]/resolve, restricted to owner/admin.
 * That route creates the org_cost_codes row on approve.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentMembership } from "@/lib/org/session";
import { ApiError, withApiError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

const SUGGESTOR_ROLES = new Set(["owner", "admin", "pm", "accounting"]);

interface CreateBody {
  suggested_code?: string;
  suggested_name?: string;
  suggested_canonical_code_id?: string | null;
  suggested_parent_code?: string | null;
  source_proposal_line_item_id?: string | null;
  rationale?: string | null;
}

export const POST = withApiError(async (request: NextRequest) => {
  const membership = await getCurrentMembership();
  if (!membership) throw new ApiError("Not authenticated", 401);

  if (!SUGGESTOR_ROLES.has(membership.role)) {
    throw new ApiError(
      `Role ${membership.role} cannot suggest cost codes (allowed: owner, admin, pm, accounting)`,
      403
    );
  }

  const body = (await request.json().catch(() => null)) as CreateBody | null;
  const code = body?.suggested_code?.trim();
  const name = body?.suggested_name?.trim();
  if (!code) throw new ApiError("Missing suggested_code", 400);
  if (!name) throw new ApiError("Missing suggested_name", 400);

  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new ApiError("Auth user lookup failed", 401);

  const { data, error } = await supabase
    .from("pending_cost_code_suggestions")
    .insert({
      org_id: membership.org_id,
      suggested_code: code,
      suggested_name: name,
      suggested_canonical_code_id: body?.suggested_canonical_code_id ?? null,
      suggested_parent_code: body?.suggested_parent_code ?? null,
      source_proposal_line_item_id: body?.source_proposal_line_item_id ?? null,
      rationale: body?.rationale ?? null,
      status: "pending",
      suggested_by: user.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[cost-code-suggestions] insert failed:", error?.message);
    throw new ApiError(
      `Failed to create suggestion: ${error?.message ?? "no row returned"}`,
      500
    );
  }

  return NextResponse.json({ suggestion_id: data.id });
});
