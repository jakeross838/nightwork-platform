import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { writePlatformAudit } from "@/lib/auth/platform-admin-audit";

export async function POST() {
  let admin;
  try {
    admin = await requirePlatformAdmin();
  } catch {
    return NextResponse.json(
      { error: "Platform admin required" },
      { status: 401 }
    );
  }

  const cookieStore = cookies();
  const existing = cookieStore.get("nw_impersonate")?.value;
  let targetOrgId: string | null = null;
  let startedAt: string | null = null;
  let auditId: string | null = null;
  if (existing) {
    try {
      const parsed = JSON.parse(existing) as {
        target_org_id?: string;
        started_at?: string;
        audit_id?: string;
      };
      targetOrgId = parsed.target_org_id ?? null;
      startedAt = parsed.started_at ?? null;
      auditId = parsed.audit_id ?? null;
    } catch {
      // Malformed cookie — clear it below regardless.
    }
  }

  await writePlatformAudit({
    admin_user_id: admin.user_id,
    action: "impersonate_end",
    target_org_id: targetOrgId,
    details: {
      started_at: startedAt,
      ended_at: new Date().toISOString(),
      start_audit_id: auditId,
    },
    reason: "Impersonation session ended",
  });

  cookieStore.set("nw_impersonate", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });

  return NextResponse.json({
    redirect: targetOrgId
      ? `/admin/platform/organizations/${targetOrgId}`
      : "/admin/platform",
  });
}
