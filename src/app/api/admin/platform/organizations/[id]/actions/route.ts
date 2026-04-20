import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { writePlatformAudit } from "@/lib/auth/platform-admin-audit";
import { createServiceRoleClient } from "@/lib/supabase/service";

type ActionKey = "extend_trial" | "unlock" | "mark_churned";

const ALLOWED_ACTIONS: ActionKey[] = ["extend_trial", "unlock", "mark_churned"];

export async function POST(
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

  let body: { action?: unknown; reason?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const action = typeof body.action === "string" ? (body.action as string) : "";
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!ALLOWED_ACTIONS.includes(action as ActionKey)) {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
  if (!reason) {
    return NextResponse.json({ error: "reason is required" }, { status: 400 });
  }

  const svc = createServiceRoleClient();

  // Load org so we have before-state for the audit entry.
  const { data: orgBefore } = await svc
    .from("organizations")
    .select("id, name, subscription_status, trial_ends_at")
    .eq("id", params.id)
    .maybeSingle();
  if (!orgBefore) {
    return NextResponse.json(
      { error: "Organization not found" },
      { status: 404 }
    );
  }
  const o = orgBefore as {
    id: string;
    name: string;
    subscription_status: string;
    trial_ends_at: string | null;
  };

  let auditAction: string;
  let updates: Record<string, unknown> = {};
  let details: Record<string, unknown> = { org_name: o.name };

  if (action === "extend_trial") {
    const newEnds = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    updates = {
      subscription_status: "trialing",
      trial_ends_at: newEnds,
    };
    auditAction = "org_extend_trial";
    details = {
      ...details,
      before: {
        subscription_status: o.subscription_status,
        trial_ends_at: o.trial_ends_at,
      },
      after: updates,
    };
  } else if (action === "unlock") {
    updates = { subscription_status: "active" };
    auditAction = "org_unlock";
    details = {
      ...details,
      before: { subscription_status: o.subscription_status },
      after: updates,
    };
  } else {
    // mark_churned
    updates = { subscription_status: "cancelled" };
    auditAction = "org_mark_churned";
    details = {
      ...details,
      before: { subscription_status: o.subscription_status },
      after: updates,
    };
  }

  const { error: updateError } = await svc
    .from("organizations")
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
    action: auditAction,
    target_org_id: params.id,
    target_record_type: "organization",
    target_record_id: params.id,
    details,
    reason,
  });

  return NextResponse.json({ ok: true });
}
