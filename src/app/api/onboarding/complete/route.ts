import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { ApiError, withApiError } from "@/lib/api/errors";
import { ADMIN_OR_OWNER, requireRole } from "@/lib/org/require";

export const dynamic = "force-dynamic";

export const POST = withApiError(async () => {
  const membership = await requireRole(ADMIN_OR_OWNER);
  const supabase = createServerClient();
  const { error } = await supabase
    .from("organizations")
    .update({ onboarding_complete: true })
    .eq("id", membership.org_id);
  if (error) throw new ApiError(error.message, 500);
  return NextResponse.json({ ok: true });
});
