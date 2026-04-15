import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { ApiError, withApiError } from "@/lib/api/errors";
import { ADMIN_OR_OWNER, requireRole } from "@/lib/org/require";

export const dynamic = "force-dynamic";

// Editable columns — guardrails against accidental writes to billing / usage /
// subscription fields from the settings UI.
const EDITABLE_COLUMNS = new Set([
  "name",
  "tagline",
  "primary_color",
  "accent_color",
  "logo_url",
  "company_address",
  "company_city",
  "company_state",
  "company_zip",
  "company_phone",
  "company_email",
  "company_website",
  "default_gc_fee_percentage",
  "default_deposit_percentage",
  "payment_schedule_type",
  "payment_schedule_config",
]);

export const PATCH = withApiError(async (request: NextRequest) => {
  const membership = await requireRole(ADMIN_OR_OWNER);
  const supabase = createServerClient();
  const body = (await request.json()) as Record<string, unknown>;

  const update: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (EDITABLE_COLUMNS.has(k)) update[k] = v;
  }
  if (Object.keys(update).length === 0) {
    throw new ApiError("No editable fields supplied", 400);
  }

  const { error } = await supabase
    .from("organizations")
    .update(update)
    .eq("id", membership.org_id);

  if (error) throw new ApiError(error.message, 500);

  return NextResponse.json({ ok: true });
});
