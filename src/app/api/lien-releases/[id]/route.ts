import { NextRequest, NextResponse } from "next/server";
import { getCurrentMembership } from "@/lib/org/session";
import { logActivity } from "@/lib/activity-log";
import { updateWithLock, isLockConflict } from "@/lib/api/optimistic-lock";
import {
  getClientForRequest,
  logImpersonatedWrite,
} from "@/lib/auth/impersonation-client";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/lien-releases/:id
 * Edit release type, amount, status, through_date, document_url, notes.
 * Flipping status to 'received' stamps received_at.
 * Flipping status to 'waived' stamps waived_at.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const membership = await getCurrentMembership();
    if (!membership) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const ctx = await getClientForRequest();
    if (!ctx.ok) {
      return NextResponse.json(
        { error: `Impersonation rejected: ${ctx.reason}` },
        { status: 401 }
      );
    }
    const supabase = ctx.client;
    const body = (await request.json()) as Record<string, unknown>;

    const { data: existing } = await supabase
      .from("lien_releases")
      .select("id, status, org_id")
      .eq("id", params.id)
      .eq("org_id", membership.org_id)
      .single();
    if (!existing) {
      return NextResponse.json({ error: "Lien release not found" }, { status: 404 });
    }

    const releaseOrgId = existing.org_id as string | null;
    if (!releaseOrgId) {
      return NextResponse.json(
        { error: "Lien release record missing org_id" },
        { status: 500 }
      );
    }

    const updates: Record<string, unknown> = {};
    for (const key of [
      "release_type",
      "amount",
      "status",
      "through_date",
      "document_url",
      "notes",
      "po_id",
    ]) {
      if (key in body) updates[key] = body[key];
    }
    if (body.status === "received" && existing.status !== "received") {
      updates.received_at = new Date().toISOString();
    }
    if (body.status === "waived" && existing.status !== "waived") {
      updates.waived_at = new Date().toISOString();
    }

    const expectedUpdatedAt = (body.expected_updated_at as string | undefined) || null;
    const lockResult = await updateWithLock(supabase, {
      table: "lien_releases",
      id: params.id,
      orgId: membership.org_id,
      expectedUpdatedAt,
      updates,
    });
    if (isLockConflict(lockResult)) {
      return lockResult.response;
    }

    await logActivity({
      org_id: releaseOrgId,
      entity_type: "draw",
      entity_id: params.id,
      action: "updated",
      details: { lien_release_update: updates },
    });
    await logImpersonatedWrite(ctx, {
      target_record_type: "lien_release",
      target_record_id: params.id,
      details: { updates },
      route: `/api/lien-releases/${params.id}`,
      method: "PATCH",
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
