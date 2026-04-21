import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { ApiError, withApiError } from "@/lib/api/errors";
import { getCurrentMembership } from "@/lib/org/session";

export const dynamic = "force-dynamic";

interface Body {
  heated_sf?: number | null;
  total_sf?: number | null;
  bedroom_count?: number | null;
  bathroom_count?: number | null;
  half_bathroom_count?: number | null;
  story_count?: number | null;
  garage_bay_count?: number | null;
  lot_size_sf?: number | null;
  finish_level?: string | null;
  construction_type?: string | null;
  site_characteristics?: Record<string, unknown>;
  complexity_factors?: Record<string, unknown>;
  region_jurisdiction?: Record<string, unknown>;
}

const ALLOWED = new Set<keyof Body>([
  "heated_sf",
  "total_sf",
  "bedroom_count",
  "bathroom_count",
  "half_bathroom_count",
  "story_count",
  "garage_bay_count",
  "lot_size_sf",
  "finish_level",
  "construction_type",
  "site_characteristics",
  "complexity_factors",
  "region_jurisdiction",
]);

export const GET = withApiError(async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const membership = await getCurrentMembership();
  if (!membership) throw new ApiError("Not authenticated", 401);

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("jobs")
    .select(
      "id, heated_sf, total_sf, bedroom_count, bathroom_count, half_bathroom_count, story_count, garage_bay_count, lot_size_sf, finish_level, construction_type, site_characteristics, complexity_factors, region_jurisdiction, characteristics_enrichment_source"
    )
    .eq("id", id)
    .eq("org_id", membership.org_id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw new ApiError(error.message, 500);
  if (!data) throw new ApiError("Job not found", 404);

  return NextResponse.json({ job: data });
});

export const PATCH = withApiError(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const membership = await getCurrentMembership();
  if (!membership) throw new ApiError("Not authenticated", 401);
  if (!["owner", "admin", "pm"].includes(membership.role)) {
    throw new ApiError("Insufficient permissions", 403);
  }

  const supabase = createServerClient();
  const { data: user } = await supabase.auth.getUser();
  const body: Body = await req.json();

  const update: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (ALLOWED.has(k as keyof Body)) update[k] = v;
  }
  if (Object.keys(update).length === 0) {
    throw new ApiError("No editable fields supplied", 400);
  }

  // Track which fields were set by the user so we can later attribute
  // auto-populated fields (from permit data, plan extraction, etc).
  const nowIso = new Date().toISOString();
  update.characteristics_enrichment_source = {
    ...(typeof body === "object" ? {} : {}),
    last_manual_update_at: nowIso,
    last_manual_update_by: user.user?.id ?? null,
    fields_source: Object.keys(update).reduce<Record<string, string>>((acc, k) => {
      if (k !== "characteristics_enrichment_source") acc[k] = "manual";
      return acc;
    }, {}),
  };

  const { error } = await supabase
    .from("jobs")
    .update(update)
    .eq("id", id)
    .eq("org_id", membership.org_id);

  if (error) throw new ApiError(error.message, 500);
  return NextResponse.json({ ok: true });
});
