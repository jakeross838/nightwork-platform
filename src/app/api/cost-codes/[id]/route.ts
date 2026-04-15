import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { ApiError, withApiError } from "@/lib/api/errors";
import { ADMIN_OR_OWNER, requireRole } from "@/lib/org/require";

export const dynamic = "force-dynamic";

export const PATCH = withApiError(async (
  request: NextRequest,
  { params }: { params: { id: string } }
) => {
  const membership = await requireRole(ADMIN_OR_OWNER);
  const supabase = createServerClient();
  const body = (await request.json()) as Partial<{
    code: string;
    description: string;
    category: string | null;
    sort_order: number;
    is_change_order: boolean;
  }>;

  const update: Record<string, unknown> = {};
  for (const k of ["code", "description", "category", "sort_order", "is_change_order"] as const) {
    if (body[k] !== undefined) update[k] = body[k];
  }
  if (Object.keys(update).length === 0) throw new ApiError("Nothing to update", 400);

  const { error } = await supabase
    .from("cost_codes")
    .update(update)
    .eq("id", params.id)
    .eq("org_id", membership.org_id);
  if (error) throw new ApiError(error.message, 500);
  return NextResponse.json({ ok: true });
});

export const DELETE = withApiError(async (
  _request: NextRequest,
  { params }: { params: { id: string } }
) => {
  const membership = await requireRole(ADMIN_OR_OWNER);
  const supabase = createServerClient();
  const { error } = await supabase
    .from("cost_codes")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", params.id)
    .eq("org_id", membership.org_id);
  if (error) throw new ApiError(error.message, 500);
  return NextResponse.json({ ok: true });
});
