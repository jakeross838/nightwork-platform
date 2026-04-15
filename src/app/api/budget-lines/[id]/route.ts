import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { ApiError, withApiError } from "@/lib/api/errors";
import { getCurrentMembership } from "@/lib/org/session";
import { canDeleteBudgetLine, formatBlockers } from "@/lib/deletion-guards";
import { logActivity } from "@/lib/activity-log";
import { recalcBudgetLine, recalcBudgetTotals } from "@/lib/recalc";

export const dynamic = "force-dynamic";

interface PatchBody {
  original_estimate?: number;
  revised_estimate?: number;
  description?: string | null;
  category?: string | null;
  notes?: string | null;
  sort_order?: number;
  is_allowance?: boolean;
}

export const PATCH = withApiError(
  async (request: NextRequest, { params }: { params: { id: string } }) => {
    const membership = await getCurrentMembership();
    if (!membership) throw new ApiError("Not authenticated", 401);
    if (!["owner", "admin"].includes(membership.role)) throw new ApiError("Forbidden", 403);

    const supabase = createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    const body: PatchBody = await request.json();

    const { data: before } = await supabase
      .from("budget_lines")
      .select("id, budget_id, original_estimate")
      .eq("id", params.id)
      .is("deleted_at", null)
      .single();
    if (!before) throw new ApiError("Budget line not found", 404);

    const patch: Record<string, unknown> = {};
    for (const k of [
      "original_estimate",
      "description",
      "category",
      "notes",
      "sort_order",
      "is_allowance",
    ] as const) {
      if (body[k] !== undefined) patch[k] = body[k];
    }
    if (Object.keys(patch).length === 0) throw new ApiError("Nothing to update", 400);

    const { error } = await supabase
      .from("budget_lines")
      .update(patch)
      .eq("id", params.id);
    if (error) throw new ApiError(error.message, 500);

    await recalcBudgetLine(params.id);
    if ((before as { budget_id?: string | null }).budget_id) {
      await recalcBudgetTotals((before as { budget_id: string }).budget_id);
    }

    await logActivity({
      org_id: membership.org_id,
      user_id: user?.id ?? null,
      entity_type: "budget_line",
      entity_id: params.id,
      action: "updated",
      details: {
        from: body.original_estimate !== undefined
          ? { original_estimate: (before as { original_estimate?: number }).original_estimate }
          : undefined,
        to: body.original_estimate !== undefined
          ? { original_estimate: body.original_estimate }
          : undefined,
      },
    });

    return NextResponse.json({ ok: true });
  }
);

export const DELETE = withApiError(
  async (_request: NextRequest, { params }: { params: { id: string } }) => {
    const membership = await getCurrentMembership();
    if (!membership) throw new ApiError("Not authenticated", 401);
    if (!["owner", "admin"].includes(membership.role)) throw new ApiError("Forbidden", 403);

    const supabase = createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    const guard = await canDeleteBudgetLine(params.id);
    if (!guard.allowed) {
      await logActivity({
        org_id: membership.org_id,
        user_id: user?.id ?? null,
        entity_type: "budget_line",
        entity_id: params.id,
        action: "delete_blocked",
        details: { blockers: guard.blockers },
      });
      throw new ApiError(formatBlockers("delete budget line", guard), 422);
    }

    const { data: before } = await supabase
      .from("budget_lines")
      .select("budget_id")
      .eq("id", params.id)
      .single();

    const { error } = await supabase
      .from("budget_lines")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", params.id);
    if (error) throw new ApiError(error.message, 500);

    if ((before as { budget_id?: string | null } | null)?.budget_id) {
      await recalcBudgetTotals(
        (before as { budget_id: string }).budget_id
      );
    }

    await logActivity({
      org_id: membership.org_id,
      user_id: user?.id ?? null,
      entity_type: "budget_line",
      entity_id: params.id,
      action: "deleted",
    });

    return NextResponse.json({ ok: true });
  }
);
