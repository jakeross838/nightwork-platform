import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { ApiError, withApiError } from "@/lib/api/errors";
import { ADMIN_OR_OWNER, requireRole } from "@/lib/org/require";

export const dynamic = "force-dynamic";

const VALID_ROLES = new Set(["owner", "admin", "pm", "accounting"]);

export const PATCH = withApiError(async (
  request: NextRequest,
  { params }: { params: { id: string } }
) => {
  const membership = await requireRole(ADMIN_OR_OWNER);
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new ApiError("Not authenticated", 401);

  const body = (await request.json()) as { role?: string; is_active?: boolean };

  const { data: target, error: fetchErr } = await supabase
    .from("org_members")
    .select("id, user_id, role, is_active, org_id")
    .eq("id", params.id)
    .single();
  if (fetchErr || !target) throw new ApiError("Member not found", 404);
  if (target.org_id !== membership.org_id) throw new ApiError("Forbidden", 403);

  const update: Record<string, unknown> = {};

  if (body.role !== undefined) {
    if (!VALID_ROLES.has(body.role)) throw new ApiError("Invalid role", 400);
    if (target.user_id === user.id && body.role !== target.role) {
      throw new ApiError("You cannot change your own role.", 400);
    }
    // Block demoting the last active owner.
    if (target.role === "owner" && body.role !== "owner") {
      const { count } = await supabase
        .from("org_members")
        .select("id", { count: "exact", head: true })
        .eq("org_id", membership.org_id)
        .eq("role", "owner")
        .eq("is_active", true);
      if ((count ?? 0) <= 1) {
        throw new ApiError("At least one active owner is required.", 400);
      }
    }
    update.role = body.role;
  }

  if (body.is_active !== undefined) {
    if (target.user_id === user.id) {
      throw new ApiError("You cannot deactivate your own account.", 400);
    }
    // Block deactivating the last active owner.
    if (body.is_active === false && target.role === "owner") {
      const { count } = await supabase
        .from("org_members")
        .select("id", { count: "exact", head: true })
        .eq("org_id", membership.org_id)
        .eq("role", "owner")
        .eq("is_active", true);
      if ((count ?? 0) <= 1) {
        throw new ApiError("At least one active owner is required.", 400);
      }
    }
    update.is_active = body.is_active;
  }

  if (Object.keys(update).length === 0) throw new ApiError("Nothing to update", 400);

  const { error } = await supabase
    .from("org_members")
    .update(update)
    .eq("id", params.id);
  if (error) throw new ApiError(error.message, 500);

  return NextResponse.json({ ok: true });
});
