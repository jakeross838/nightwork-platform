import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { writePlatformAudit } from "@/lib/auth/platform-admin-audit";
import { createServiceRoleClient } from "@/lib/supabase/service";

type ActionKey =
  | "reset_password"
  | "lock_account"
  | "unlock_account"
  | "remove_from_org";

const ALLOWED: ActionKey[] = [
  "reset_password",
  "lock_account",
  "unlock_account",
  "remove_from_org",
];

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

  let body: { action?: unknown; reason?: unknown; org_id?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const action = typeof body.action === "string" ? (body.action as string) : "";
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!ALLOWED.includes(action as ActionKey)) {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
  if (!reason) {
    return NextResponse.json({ error: "reason is required" }, { status: 400 });
  }

  const svc = createServiceRoleClient();

  // Load the user's profile (for email). We need it to send a reset.
  const { data: profile } = await svc
    .from("profiles")
    .select("id, email, full_name")
    .eq("id", params.id)
    .maybeSingle();
  if (!profile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  const p = profile as {
    id: string;
    email: string | null;
    full_name: string;
  };

  if (action === "reset_password") {
    if (!p.email) {
      return NextResponse.json(
        { error: "User has no email on file — cannot send reset" },
        { status: 400 }
      );
    }
    const { error } = await svc.auth.admin.generateLink({
      type: "recovery",
      email: p.email,
    });
    if (error) {
      return NextResponse.json(
        { error: `Reset link failed: ${error.message}` },
        { status: 500 }
      );
    }
    await writePlatformAudit({
      admin_user_id: admin.user_id,
      action: "user_password_reset",
      target_user_id: p.id,
      details: { email: p.email },
      reason,
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "lock_account") {
    // Supabase "ban" a user by setting ban duration.
    const { error } = await svc.auth.admin.updateUserById(p.id, {
      ban_duration: "87600h", // 10 years — effectively indefinite
    });
    if (error) {
      return NextResponse.json(
        { error: `Lock failed: ${error.message}` },
        { status: 500 }
      );
    }
    await writePlatformAudit({
      admin_user_id: admin.user_id,
      action: "user_lock",
      target_user_id: p.id,
      details: { email: p.email },
      reason,
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "unlock_account") {
    const { error } = await svc.auth.admin.updateUserById(p.id, {
      ban_duration: "none",
    });
    if (error) {
      return NextResponse.json(
        { error: `Unlock failed: ${error.message}` },
        { status: 500 }
      );
    }
    await writePlatformAudit({
      admin_user_id: admin.user_id,
      action: "user_unlock",
      target_user_id: p.id,
      details: { email: p.email },
      reason,
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "remove_from_org") {
    const orgId = typeof body.org_id === "string" ? body.org_id : "";
    if (!orgId) {
      return NextResponse.json(
        { error: "org_id required for remove_from_org" },
        { status: 400 }
      );
    }
    const { data: member } = await svc
      .from("org_members")
      .select("id, role, is_active")
      .eq("user_id", p.id)
      .eq("org_id", orgId)
      .maybeSingle();
    if (!member) {
      return NextResponse.json(
        { error: "Membership not found" },
        { status: 404 }
      );
    }
    const { error: updateError } = await svc
      .from("org_members")
      .update({ is_active: false })
      .eq("id", (member as { id: string }).id);
    if (updateError) {
      return NextResponse.json(
        { error: `Remove failed: ${updateError.message}` },
        { status: 500 }
      );
    }
    await writePlatformAudit({
      admin_user_id: admin.user_id,
      action: "user_remove_from_org",
      target_user_id: p.id,
      target_org_id: orgId,
      details: {
        email: p.email,
        previous_role: (member as { role: string }).role,
      },
      reason,
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unhandled action" }, { status: 400 });
}
