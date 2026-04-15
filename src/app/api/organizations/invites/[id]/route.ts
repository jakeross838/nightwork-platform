import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { ApiError, withApiError } from "@/lib/api/errors";
import { ADMIN_OR_OWNER, requireRole } from "@/lib/org/require";

export const dynamic = "force-dynamic";

export const DELETE = withApiError(async (
  _request: NextRequest,
  { params }: { params: { id: string } }
) => {
  const membership = await requireRole(ADMIN_OR_OWNER);
  const supabase = createServerClient();

  const { error } = await supabase
    .from("org_invites")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", params.id)
    .eq("org_id", membership.org_id);

  if (error) throw new ApiError(error.message, 500);
  return NextResponse.json({ ok: true });
});
