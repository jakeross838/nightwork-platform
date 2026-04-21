import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { ApiError, withApiError } from "@/lib/api/errors";
import { getCurrentMembership } from "@/lib/org/session";

export const dynamic = "force-dynamic";

/**
 * GET /api/cost-intelligence/items?q=search&type=material&limit=20
 *
 * Search items for the current org. Used by the correction modal's item
 * picker and the cost lookup widget.
 */
export const GET = withApiError(async (req: NextRequest) => {
  const membership = await getCurrentMembership();
  if (!membership) throw new ApiError("Not authenticated", 401);

  const supabase = createServerClient();
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  const itemType = searchParams.get("type");
  const limit = Math.min(Number(searchParams.get("limit") ?? 20), 100);

  let query = supabase
    .from("items")
    .select("id, canonical_name, description, item_type, category, subcategory, unit, specs, default_cost_code_id, ai_confidence, human_verified, created_at")
    .eq("org_id", membership.org_id)
    .is("deleted_at", null);

  if (itemType) query = query.eq("item_type", itemType);

  if (q.length > 0) {
    query = query.ilike("canonical_name", `%${q}%`);
  }

  const { data, error } = await query.order("canonical_name").limit(limit);
  if (error) throw new ApiError(error.message, 500);

  return NextResponse.json({ items: data ?? [] });
});
