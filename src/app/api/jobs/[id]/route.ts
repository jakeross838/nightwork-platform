import { NextRequest, NextResponse } from "next/server";
import { ApiError, withApiError } from "@/lib/api/errors";
import { getCurrentMembership } from "@/lib/org/session";
import { canDeleteJob, formatBlockers } from "@/lib/deletion-guards";
import { logActivity } from "@/lib/activity-log";
import {
  getClientForRequest,
  logImpersonatedWrite,
} from "@/lib/auth/impersonation-client";

export const dynamic = "force-dynamic";

/**
 * DELETE /api/jobs/[id]
 *
 * Phase 7b: jobs with any financial records cannot be hard-deleted — they
 * must be archived instead. If the guard rejects, we suggest archiving via
 * PATCH `{ status: 'cancelled' }` (existing job statuses already include it).
 * Truly empty jobs (no invoices, POs, COs, draws, budget) can be soft-deleted.
 */
export const DELETE = withApiError(
  async (_request: NextRequest, { params }: { params: { id: string } }) => {
    const membership = await getCurrentMembership();
    if (!membership) throw new ApiError("Not authenticated", 401);
    if (!["owner", "admin"].includes(membership.role)) throw new ApiError("Forbidden", 403);

    const ctx = await getClientForRequest();
    if (!ctx.ok) throw new ApiError(`Impersonation rejected: ${ctx.reason}`, 401);
    const supabase = ctx.client;
    const { data: { user } } = await supabase.auth.getUser();

    const guard = await canDeleteJob(params.id);
    if (!guard.allowed) {
      await logActivity({
        org_id: membership.org_id,
        user_id: user?.id ?? null,
        entity_type: "job",
        entity_id: params.id,
        action: "delete_blocked",
        details: { blockers: guard.blockers },
      });
      throw new ApiError(
        `${formatBlockers("delete job", guard)} — archive with status='cancelled' or 'warranty' instead.`,
        422
      );
    }

    const { error } = await supabase
      .from("jobs")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", params.id)
      .is("deleted_at", null);
    if (error) throw new ApiError(error.message, 500);

    await logActivity({
      org_id: membership.org_id,
      user_id: user?.id ?? null,
      entity_type: "job",
      entity_id: params.id,
      action: "deleted",
    });

    await logImpersonatedWrite(ctx, {
      target_record_type: "job",
      target_record_id: params.id,
      details: { soft_deleted: true },
      route: `/api/jobs/${params.id}`,
      method: "DELETE",
    });

    return NextResponse.json({ ok: true });
  }
);
