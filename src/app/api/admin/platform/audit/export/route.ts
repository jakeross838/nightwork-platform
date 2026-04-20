import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { createServiceRoleClient } from "@/lib/supabase/service";

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str =
    typeof value === "string" ? value : JSON.stringify(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(request: Request) {
  try {
    await requirePlatformAdmin();
  } catch {
    return NextResponse.json(
      { error: "Platform admin required" },
      { status: 401 }
    );
  }

  const url = new URL(request.url);
  const admin = url.searchParams.get("admin");
  const action = url.searchParams.get("action");
  const org = url.searchParams.get("org");
  const since = url.searchParams.get("since");

  const svc = createServiceRoleClient();
  let q = svc
    .from("platform_admin_audit")
    .select(
      "id, admin_user_id, action, target_org_id, target_user_id, target_record_type, target_record_id, details, reason, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(5000);

  if (admin) q = q.eq("admin_user_id", admin);
  if (action) q = q.eq("action", action);
  if (org) q = q.eq("target_org_id", org);
  if (since) q = q.gte("created_at", since);

  const { data, error } = await q;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as Array<{
    id: string;
    admin_user_id: string;
    action: string;
    target_org_id: string | null;
    target_user_id: string | null;
    target_record_type: string | null;
    target_record_id: string | null;
    details: unknown;
    reason: string | null;
    created_at: string;
  }>;

  const header = [
    "created_at",
    "admin_user_id",
    "action",
    "target_org_id",
    "target_user_id",
    "target_record_type",
    "target_record_id",
    "reason",
    "details",
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.created_at,
        r.admin_user_id,
        r.action,
        r.target_org_id ?? "",
        r.target_user_id ?? "",
        r.target_record_type ?? "",
        r.target_record_id ?? "",
        r.reason ?? "",
        r.details ?? "",
      ]
        .map(csvEscape)
        .join(",")
    );
  }

  const filename = `platform-audit-${new Date().toISOString().slice(0, 10)}.csv`;
  return new NextResponse(lines.join("\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
