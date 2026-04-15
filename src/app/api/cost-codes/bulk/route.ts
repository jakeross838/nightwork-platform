import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { ApiError, withApiError } from "@/lib/api/errors";
import { ADMIN_OR_OWNER, requireRole } from "@/lib/org/require";
import { canDeleteCostCode } from "@/lib/deletion-guards";
import { logActivity } from "@/lib/activity-log";

export const dynamic = "force-dynamic";

export const POST = withApiError(async (request: NextRequest) => {
  const membership = await requireRole(ADMIN_OR_OWNER);
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const body = (await request.json()) as {
    action: "delete" | "category";
    ids: string[];
    category?: string | null;
  };
  if (!Array.isArray(body.ids) || body.ids.length === 0) {
    throw new ApiError("No IDs supplied", 400);
  }

  if (body.action === "delete") {
    // Phase 7b: guard each id individually; reject the whole batch if any
    // id is blocked so the caller can surface a clean error.
    const blocked: Array<{ id: string; blockers: string[] }> = [];
    const allowed: string[] = [];
    for (const id of body.ids) {
      const guard = await canDeleteCostCode(id);
      if (guard.allowed) allowed.push(id);
      else blocked.push({ id, blockers: guard.blockers });
    }
    if (blocked.length > 0) {
      for (const b of blocked) {
        await logActivity({
          org_id: membership.org_id,
          user_id: user?.id ?? null,
          entity_type: "cost_code",
          entity_id: b.id,
          action: "delete_blocked",
          details: { blockers: b.blockers },
        });
      }
      throw new ApiError(
        `Cannot delete ${blocked.length} of ${body.ids.length} cost code(s) — they are referenced by other records.`,
        422
      );
    }

    const { error } = await supabase
      .from("cost_codes")
      .update({ deleted_at: new Date().toISOString() })
      .in("id", allowed)
      .eq("org_id", membership.org_id);
    if (error) throw new ApiError(error.message, 500);

    for (const id of allowed) {
      await logActivity({
        org_id: membership.org_id,
        user_id: user?.id ?? null,
        entity_type: "cost_code",
        entity_id: id,
        action: "deleted",
        details: { bulk: true },
      });
    }
    return NextResponse.json({ ok: true, deleted: allowed.length });
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
