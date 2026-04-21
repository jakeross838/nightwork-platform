import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { ApiError, withApiError } from "@/lib/api/errors";
import { getCurrentMembership } from "@/lib/org/session";
import { getRecentLearnings } from "@/lib/cost-intelligence/recent-learnings";

export const dynamic = "force-dynamic";

/**
 * GET /api/cost-intelligence/recent-learnings?limit=5
 *
 * Returns merged chronological feed of item_aliases + item_classification_corrections
 * + confirmed unit_conversion_suggestions from the last 30 days.
 */
export const GET = withApiError(async (req: NextRequest) => {
  const membership = await getCurrentMembership();
  if (!membership) throw new ApiError("Not authenticated", 401);

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 5), 1), 25);

  const supabase = createServerClient();
  const learnings = await getRecentLearnings(supabase, membership.org_id, limit);
  return NextResponse.json({ learnings });
});
