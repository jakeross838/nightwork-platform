import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { ApiError, withApiError } from "@/lib/api/errors";
import { getCurrentMembership } from "@/lib/org/session";

export const dynamic = "force-dynamic";

/**
 * GET /api/cost-intelligence/items/[id]
 *
 * Full detail: item + aliases + pricing history (grouped by vendor) +
 * recent pricing rows + job activity.
 */
export const GET = withApiError(async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const membership = await getCurrentMembership();
  if (!membership) throw new ApiError("Not authenticated", 401);

  const supabase = createServerClient();

  const { data: item } = await supabase
    .from("items")
    .select("*, default_cost_code:cost_codes(id,code,description)")
    .eq("id", id)
    .eq("org_id", membership.org_id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!item) throw new ApiError("Item not found", 404);

  const { data: aliases } = await supabase
    .from("item_aliases")
    .select("id, alias_text, vendor_id, source_type, occurrence_count, first_seen_at, last_seen_at, vendors(id,name)")
    .eq("item_id", id)
    .eq("org_id", membership.org_id)
    .order("occurrence_count", { ascending: false })
    .limit(100);

  const { data: pricing } = await supabase
    .from("vendor_item_pricing")
    .select("id, vendor_id, unit_price_cents, quantity, total_cents, unit, observed_unit, observed_quantity, observed_unit_price_cents, canonical_quantity, canonical_unit_price_cents, conversion_applied, tax_cents, overhead_allocated_cents, landed_total_cents, job_id, source_type, transaction_date, ai_confidence, created_via, human_verified, auto_committed, scope_size_value, scope_size_source, scope_size_confidence, scope_size_notes, vendors(id,name), jobs(id,name)")
    .eq("item_id", id)
    .eq("org_id", membership.org_id)
    .is("deleted_at", null)
    .order("transaction_date", { ascending: false })
    .limit(200);

  const { data: jobActivity } = await supabase
    .from("job_item_activity")
    .select("id, job_id, planned_quantity, planned_total_cents, actual_quantity, actual_total_cents, status, first_purchase_date, last_purchase_date, jobs(id,name)")
    .eq("item_id", id)
    .eq("org_id", membership.org_id)
    .is("deleted_at", null);

  return NextResponse.json({
    item,
    aliases: aliases ?? [],
    pricing: pricing ?? [],
    job_activity: jobActivity ?? [],
  });
});
