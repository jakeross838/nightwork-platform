import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { ApiError, withApiError } from "@/lib/api/errors";
import { getCurrentMembership } from "@/lib/org/session";
import {
  applyConversion,
  mergeConversionRuleIntoItem,
} from "@/lib/cost-intelligence/convert-units";

export const dynamic = "force-dynamic";

/**
 * POST /api/cost-intelligence/conversions/[id]/confirm
 *
 * Body: { ratio?: number, notes?: string }
 *
 * 1. Sets status=confirmed on the suggestion with the final ratio.
 * 2. Merges the ratio into items.conversion_rules so future pricing
 *    rows resolve via tenant_rule, not ai_suggested_pending.
 * 3. Recomputes canonical_quantity + canonical_unit_price_cents on any
 *    vendor_item_pricing rows whose conversion_applied.source is
 *    'ai_suggested_pending' and whose suggestion_id matches this row.
 */
export const POST = withApiError(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const membership = await getCurrentMembership();
  if (!membership) throw new ApiError("Not authenticated", 401);
  if (!["owner", "admin", "pm", "accounting"].includes(membership.role)) {
    throw new ApiError("Insufficient permissions", 403);
  }

  const supabase = createServerClient();
  const { data: userRes } = await supabase.auth.getUser();
  const userId = userRes.user?.id ?? null;

  let body: { ratio?: number; notes?: string } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const { data: suggestion } = await supabase
    .from("unit_conversion_suggestions")
    .select("id, org_id, item_id, from_unit, to_unit, suggested_ratio, status")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!suggestion) throw new ApiError("Suggestion not found", 404);
  const s = suggestion as {
    id: string;
    org_id: string;
    item_id: string;
    from_unit: string;
    to_unit: string;
    suggested_ratio: number;
    status: string;
  };
  if (s.org_id !== membership.org_id) throw new ApiError("Suggestion not in your org", 403);
  if (s.status !== "pending") {
    throw new ApiError(`Suggestion already ${s.status}`, 409);
  }

  const finalRatio = Number.isFinite(body.ratio) && (body.ratio ?? 0) > 0 ? Number(body.ratio) : s.suggested_ratio;

  const { error: updErr } = await supabase
    .from("unit_conversion_suggestions")
    .update({
      status: "confirmed",
      confirmed_by: userId,
      confirmed_at: new Date().toISOString(),
      confirmed_ratio: finalRatio,
      notes: body.notes ?? null,
    })
    .eq("id", id);
  if (updErr) throw new ApiError(updErr.message, 500);

  // Merge rule into items.conversion_rules.
  await mergeConversionRuleIntoItem(
    supabase,
    s.item_id,
    s.from_unit,
    finalRatio,
    body.notes ?? null
  );

  // Recompute any pricing rows that captured this suggestion as pending.
  const { data: pendingRows } = await supabase
    .from("vendor_item_pricing")
    .select("id, observed_quantity, observed_unit_price_cents, conversion_applied")
    .eq("org_id", s.org_id)
    .eq("item_id", s.item_id)
    .is("deleted_at", null);

  type Row = {
    id: string;
    observed_quantity: number | null;
    observed_unit_price_cents: number | null;
    conversion_applied: {
      from_unit?: string;
      to_unit?: string;
      ratio?: number;
      source?: string;
      suggestion_id?: string;
    } | null;
  };

  let updatedCount = 0;
  for (const raw of (pendingRows ?? []) as Row[]) {
    const c = raw.conversion_applied;
    if (!c) continue;
    const matchesSuggestion = c.suggestion_id === s.id;
    const matchesUnits =
      (c.from_unit ?? "").toLowerCase() === s.from_unit.toLowerCase() &&
      (c.to_unit ?? "").toLowerCase() === s.to_unit.toLowerCase() &&
      c.source === "ai_suggested_pending";
    if (!matchesSuggestion && !matchesUnits) continue;

    const qty = raw.observed_quantity ?? 0;
    const unitPrice = raw.observed_unit_price_cents ?? 0;
    const { canonicalQty, canonicalUnitPriceCents } = applyConversion(qty, unitPrice, finalRatio);

    await supabase
      .from("vendor_item_pricing")
      .update({
        canonical_quantity: canonicalQty,
        canonical_unit_price_cents: canonicalUnitPriceCents,
        conversion_applied: {
          from_unit: s.from_unit,
          to_unit: s.to_unit,
          ratio: finalRatio,
          source: "ai_suggested_confirmed",
          suggestion_id: s.id,
        },
      })
      .eq("id", raw.id);
    updatedCount++;
  }

  return NextResponse.json({
    ok: true,
    confirmed_ratio: finalRatio,
    pricing_rows_recomputed: updatedCount,
  });
});
