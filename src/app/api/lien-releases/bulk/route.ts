import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity-log";

export const dynamic = "force-dynamic";

const ORG_ID = "00000000-0000-0000-0000-000000000001";

/**
 * POST /api/lien-releases/bulk
 * Body: { ids: string[], action: 'mark_received' | 'waive' }
 *
 * Used by the "Mark All as Received" and "Waive All" buttons on the draw
 * detail page.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const body = (await request.json()) as { ids?: string[]; action?: string };
    const ids = body.ids ?? [];
    if (ids.length === 0) {
      return NextResponse.json({ error: "No ids provided" }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    if (body.action === "mark_received") {
      updates.status = "received";
      updates.received_at = new Date().toISOString();
    } else if (body.action === "waive") {
      updates.status = "waived";
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const { error } = await supabase.from("lien_releases").update(updates).in("id", ids);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await logActivity({
      org_id: ORG_ID,
      entity_type: "draw",
      entity_id: null,
      action: "updated",
      details: { bulk_lien_release_action: body.action, count: ids.length },
    });
    return NextResponse.json({ ok: true, updated: ids.length });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
