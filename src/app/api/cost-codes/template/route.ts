import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { ApiError, withApiError } from "@/lib/api/errors";
import { ADMIN_OR_OWNER, requireRole } from "@/lib/org/require";

export const dynamic = "force-dynamic";

// The "standard residential" template today is Ross Built's own 217-code
// cost structure — a good baseline for custom-home builders. We clone
// those codes into the caller's org (skipping any already present).
const TEMPLATE_ORG_ID = "00000000-0000-0000-0000-000000000001";

export const GET = withApiError(async () => {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("cost_codes")
    .select("code, description, category, sort_order, is_change_order")
    .eq("org_id", TEMPLATE_ORG_ID)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true });
  if (error) throw new ApiError(error.message, 500);
  return NextResponse.json({ codes: data ?? [] });
});

export const POST = withApiError(async () => {
  const membership = await requireRole(ADMIN_OR_OWNER);
  if (membership.org_id === TEMPLATE_ORG_ID) {
    // Sanity: don't re-clone codes into the template org itself.
    return NextResponse.json({ imported: 0, skipped: "template-org" });
  }

  const supabase = createServerClient();

  const { data: template, error: tplErr } = await supabase
    .from("cost_codes")
    .select("code, description, category, sort_order, is_change_order")
    .eq("org_id", TEMPLATE_ORG_ID)
    .is("deleted_at", null);
  if (tplErr) throw new ApiError(tplErr.message, 500);

  const { data: existing } = await supabase
    .from("cost_codes")
    .select("code")
    .eq("org_id", membership.org_id)
    .is("deleted_at", null);
  const existingCodes = new Set((existing ?? []).map((c) => c.code as string));

  const rows = (template ?? [])
    .filter((c) => !existingCodes.has(c.code as string))
    .map((c) => ({
      org_id: membership.org_id,
      code: c.code,
      description: c.description,
      category: c.category,
      sort_order: c.sort_order,
      is_change_order: c.is_change_order,
    }));

  if (rows.length === 0) {
    return NextResponse.json({ imported: 0 });
  }

  const { error: insErr } = await supabase.from("cost_codes").insert(rows);
  if (insErr) throw new ApiError(insErr.message, 500);

  return NextResponse.json({ imported: rows.length });
});
