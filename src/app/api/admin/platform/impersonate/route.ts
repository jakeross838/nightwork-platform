import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { writePlatformAudit } from "@/lib/auth/platform-admin-audit";
import { createServiceRoleClient } from "@/lib/supabase/service";

const IMPERSONATION_MAX_AGE_SECONDS = 60 * 60; // 1 hour

export async function POST(request: Request) {
  let admin;
  try {
    admin = await requirePlatformAdmin();
  } catch {
    return NextResponse.json(
      { error: "Platform admin required" },
      { status: 401 }
    );
  }

  let body: { target_org_id?: unknown; reason?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const targetOrgId =
    typeof body.target_org_id === "string" ? body.target_org_id : null;
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!targetOrgId) {
    return NextResponse.json(
      { error: "target_org_id is required" },
      { status: 400 }
    );
  }
  if (!reason) {
    return NextResponse.json(
      { error: "reason is required" },
      { status: 400 }
    );
  }

  // Verify org exists. Service-role to read past RLS regardless of
  // admin's profile org. Also pulls the name so the audit row carries
  // human-readable context.
  const svc = createServiceRoleClient();
  const { data: org } = await svc
    .from("organizations")
    .select("id, name")
    .eq("id", targetOrgId)
    .maybeSingle();
  if (!org) {
    return NextResponse.json(
      { error: "Organization not found" },
      { status: 404 }
    );
  }

  const startedAt = new Date().toISOString();
  const auditId = await writePlatformAudit({
    admin_user_id: admin.user_id,
    action: "impersonate_start",
    target_org_id: targetOrgId,
    details: {
      started_at: startedAt,
      org_name: (org as { name: string }).name,
    },
    reason,
  });

  const cookieValue = JSON.stringify({
    admin_user_id: admin.user_id,
    target_org_id: targetOrgId,
    started_at: startedAt,
    audit_id: auditId,
  });

  const cookieStore = cookies();
  cookieStore.set("nw_impersonate", cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: IMPERSONATION_MAX_AGE_SECONDS,
    path: "/",
  });

  return NextResponse.json({
    redirect: "/dashboard",
    target_org_id: targetOrgId,
    target_org_name: (org as { name: string }).name,
    expires_in_seconds: IMPERSONATION_MAX_AGE_SECONDS,
  });
}
