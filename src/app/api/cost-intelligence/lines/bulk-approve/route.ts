import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { ApiError, withApiError } from "@/lib/api/errors";
import { getCurrentMembership } from "@/lib/org/session";
import { commitLineToSpine } from "@/lib/cost-intelligence/commit-line-to-spine";
import type { MatchTier } from "@/lib/cost-intelligence/types";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const ALLOWED_TIERS: MatchTier[] = [
  "alias_match",
  "trigram_match",
  "ai_semantic_match",
];

interface Body {
  confidence_threshold?: number;
  match_tiers?: MatchTier[];
  /** Optional — restrict to a specific extraction. */
  extraction_id?: string;
}

/**
 * POST /api/cost-intelligence/lines/bulk-approve
 *
 * Bulk-commits all pending extraction_lines whose match_tier is in
 * match_tiers and match_confidence >= confidence_threshold. Defaults:
 *   - confidence_threshold = 0.95 (per Wave 1B plan)
 *   - match_tiers = alias_match, trigram_match, ai_semantic_match
 *   - ai_new_item is never eligible (new items always need review)
 *   - is_allocated_overhead rows are always excluded
 */
export const POST = withApiError(async (req: NextRequest) => {
  const membership = await getCurrentMembership();
  if (!membership) throw new ApiError("Not authenticated", 401);
  if (!["owner", "admin", "pm", "accounting"].includes(membership.role)) {
    throw new ApiError("Insufficient permissions", 403);
  }

  const supabase = createServerClient();
  const { data: user } = await supabase.auth.getUser();
  const userId = user.user?.id ?? null;

  const body: Body = await req.json().catch(() => ({}));
  const threshold =
    typeof body.confidence_threshold === "number" &&
    body.confidence_threshold >= 0 &&
    body.confidence_threshold <= 1
      ? body.confidence_threshold
      : 0.95;
  const requestedTiers = Array.isArray(body.match_tiers) ? body.match_tiers : ALLOWED_TIERS;
  const tiers = requestedTiers.filter((t) => ALLOWED_TIERS.includes(t));

  if (tiers.length === 0) {
    throw new ApiError("No valid match_tiers provided", 400);
  }

  let query = supabase
    .from("document_extraction_lines")
    .select("id, match_tier, match_confidence")
    .eq("org_id", membership.org_id)
    .eq("verification_status", "pending")
    .eq("is_allocated_overhead", false)
    .is("deleted_at", null)
    .in("match_tier", tiers)
    .gte("match_confidence", threshold);

  if (body.extraction_id) query = query.eq("extraction_id", body.extraction_id);

  const { data: candidates, error: candidateErr } = await query;
  if (candidateErr) {
    throw new ApiError(`Failed to load candidates: ${candidateErr.message}`, 500);
  }

  const rows = (candidates ?? []) as Array<{
    id: string;
    match_tier: MatchTier | null;
    match_confidence: number | null;
  }>;

  let approved = 0;
  const errors: Array<{ id: string; error: string }> = [];

  for (const r of rows) {
    try {
      await commitLineToSpine(supabase, r.id, {
        verifiedBy: userId,
        newStatus: "verified",
      });
      approved++;
    } catch (err) {
      errors.push({
        id: r.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({
    count_eligible: rows.length,
    count_approved: approved,
    count_failed: errors.length,
    threshold,
    match_tiers: tiers,
    errors,
  });
});

/**
 * GET /api/cost-intelligence/lines/bulk-approve?extraction_id=...
 *
 * Returns the count of lines eligible for bulk-approve under the default
 * (≥0.95 alias/trigram/ai_semantic) or user-supplied threshold.
 */
export const GET = withApiError(async (req: NextRequest) => {
  const membership = await getCurrentMembership();
  if (!membership) throw new ApiError("Not authenticated", 401);

  const url = new URL(req.url);
  const threshold = Number(url.searchParams.get("threshold") ?? "0.95");
  const extractionId = url.searchParams.get("extraction_id");

  const supabase = createServerClient();

  let query = supabase
    .from("document_extraction_lines")
    .select("id", { count: "exact", head: true })
    .eq("org_id", membership.org_id)
    .eq("verification_status", "pending")
    .eq("is_allocated_overhead", false)
    .is("deleted_at", null)
    .in("match_tier", ALLOWED_TIERS)
    .gte("match_confidence", threshold);

  if (extractionId) query = query.eq("extraction_id", extractionId);

  const { count } = await query;

  return NextResponse.json({
    count: count ?? 0,
    threshold,
  });
});
