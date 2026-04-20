import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentMembership } from "@/lib/org/session";
import { logActivity } from "@/lib/activity-log";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/lien-releases/:id
 * Edit release type, amount, status, through_date, document_url, notes.
 * Flipping status to 'received' stamps received_at.
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

    const supabase = createServerClient();
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

    const { error } = await supabase.from("lien_releases").update(updates).eq("id", params.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await logActivity({
      org_id: releaseOrgId,
      entity_type: "draw",
      entity_id: params.id,
      action: "updated",
      details: { lien_release_update: updates },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
