import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { ApiError, withApiError } from "@/lib/api/errors";
import { ADMIN_OR_OWNER, requireRole } from "@/lib/org/require";

export const dynamic = "force-dynamic";

export const POST = withApiError(async (request: NextRequest) => {
  const membership = await requireRole(ADMIN_OR_OWNER);
  const supabase = createServerClient();
  const body = (await request.json()) as {
    action: "delete" | "category";
    ids: string[];
    category?: string | null;
  };
  if (!Array.isArray(body.ids) || body.ids.length === 0) {
    throw new ApiError("No IDs supplied", 400);
  }

  if (body.action === "delete") {
    const { error } = await supabase
      .from("cost_codes")
      .update({ deleted_at: new Date().toISOString() })
      .in("id", body.ids)
      .eq("org_id", membership.org_id);
    if (error) throw new ApiError(error.message, 500);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "category") {
    const { error } = await supabase
      .from("cost_codes")
      .update({ category: body.category ?? null })
      .in("id", body.ids)
      .eq("org_id", membership.org_id);
    if (error) throw new ApiError(error.message, 500);
    return NextResponse.json({ ok: true });
  }

  throw new ApiError("Unknown action", 400);
});
