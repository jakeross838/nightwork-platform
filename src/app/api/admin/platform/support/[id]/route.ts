import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { writePlatformAudit } from "@/lib/auth/platform-admin-audit";
import { createServiceRoleClient } from "@/lib/supabase/service";

const ALLOWED_STATUSES = ["active", "escalated", "resolved"] as const;
type Status = (typeof ALLOWED_STATUSES)[number];

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  let admin;
  try {
    admin = await requirePlatformAdmin();
  } catch {
    return NextResponse.json(
      { error: "Platform admin required" },
      { status: 401 }
    );
  }

  let body: { status?: unknown; admin_notes?: unknown; reason?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const newStatus =
    typeof body.status === "string" ? (body.status as string) : "";
  const adminNotes =
    typeof body.admin_notes === "string" ? body.admin_notes : "";
  const reason =
    typeof body.reason === "string" ? body.reason.trim() : "";

  if (!ALLOWED_STATUSES.includes(newStatus as Status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  if (!reason) {
    return NextResponse.json(
      { error: "reason is required for the audit log" },
      { status: 400 }
    );
  }
  if (adminNotes.length > 10000) {
    return NextResponse.json(
      { error: "admin_notes too long" },
      { status: 400 }
    );
  }

  const svc = createServiceRoleClient();

  const { data: before } = await svc
    .from("support_conversations")
    .select("id, status, admin_notes, org_id, user_id")
    .eq("id", params.id)
    .maybeSingle();
  if (!before) {
    return NextResponse.json(
      { error: "Conversation not found" },
      { status: 404 }
    );
  }
  const prev = before as {
    id: string;
    status: string;
    admin_notes: string | null;
    org_id: string;
    user_id: string;
  };

  const updates: Record<string, unknown> = {
    status: newStatus,
    admin_notes: adminNotes || null,
  };
  if (newStatus === "resolved") {
    updates.resolved_by = admin.user_id;
    updates.resolved_at = new Date().toISOString();
  } else if (prev.status === "resolved" && newStatus !== "resolved") {
    updates.resolved_by = null;
    updates.resolved_at = null;
  }

  const { error: updateError } = await svc
    .from("support_conversations")
    .update(updates)
    .eq("id", params.id);
  if (updateError) {
    return NextResponse.json(
      { error: `Update failed: ${updateError.message}` },
      { status: 500 }
    );
  }

  await writePlatformAudit({
    admin_user_id: admin.user_id,
    action: "support_update",
    target_org_id: prev.org_id,
    target_user_id: prev.user_id,
    target_record_type: "support_conversation",
    target_record_id: params.id,
    details: {
      old_status: prev.status,
      new_status: newStatus,
      admin_notes_changed: (prev.admin_notes ?? "") !== adminNotes,
    },
    reason,
  });

  return NextResponse.json({ ok: true });
}
