import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { ApiError, withApiError } from "@/lib/api/errors";
import { ADMIN_OR_OWNER, requireRole } from "@/lib/org/require";

export const dynamic = "force-dynamic";

export const GET = withApiError(async () => {
  const membership = await requireRole(ADMIN_OR_OWNER);
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("cost_codes")
    .select("id, code, description, category, sort_order, is_change_order")
    .eq("org_id", membership.org_id)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true });
  if (error) throw new ApiError(error.message, 500);
  return NextResponse.json({ codes: data ?? [] });
});

export const POST = withApiError(async (request: NextRequest) => {
  const membership = await requireRole(ADMIN_OR_OWNER);
  const supabase = createServerClient();
  const body = (await request.json()) as {
    code: string;
    description: string;
    category?: string | null;
    sort_order?: number;
    is_change_order?: boolean;
  };
  if (!body.code?.trim() || !body.description?.trim()) {
    throw new ApiError("Code and description are required.", 400);
  }
  const { error } = await supabase.from("cost_codes").insert({
    org_id: membership.org_id,
    code: body.code.trim(),
    description: body.description.trim(),
    category: body.category ?? null,
    sort_order: body.sort_order ?? 0,
    is_change_order: body.is_change_order ?? false,
  });
  if (error) {
    if (error.code === "23505") {
      throw new ApiError(`Cost code ${body.code} already exists.`, 409);
    }
    throw new ApiError(error.message, 500);
  }
  return NextResponse.json({ ok: true });
});
