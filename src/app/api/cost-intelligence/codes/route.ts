import { NextRequest, NextResponse } from "next/server";
import { getCurrentMembership } from "@/lib/org/session";
import {
  getClientForRequest,
  logImpersonatedWrite,
} from "@/lib/auth/impersonation-client";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

// GET /api/cost-intelligence/codes
//   Query: ?include_inactive=true (default false), ?parent_code=...
//   Returns: { codes: OrgCostCode[] }
export async function GET(request: NextRequest) {
  const membership = await getCurrentMembership();
  if (!membership) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const url = new URL(request.url);
  const includeInactive = url.searchParams.get("include_inactive") === "true";
  const parentCode = url.searchParams.get("parent_code");

  const ctx = await getClientForRequest();
  if (!ctx.ok) {
    return NextResponse.json(
      { error: `Impersonation rejected: ${ctx.reason}` },
      { status: 401 }
    );
  }

  let q = ctx.client
    .from("org_cost_codes")
    .select("id, code, name, parent_code, canonical_code_id, is_active, created_at, updated_at")
    .eq("org_id", membership.org_id)
    .order("code", { ascending: true });

  if (!includeInactive) q = q.eq("is_active", true);
  if (parentCode !== null) {
    if (parentCode === "") q = q.is("parent_code", null);
    else q = q.eq("parent_code", parentCode);
  }

  const { data, error } = await q;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ codes: data ?? [] });
}

interface CreateBody {
  code?: string;
  name?: string;
  parent_code?: string | null;
  canonical_code_id?: string | null;
}

// POST /api/cost-intelligence/codes
//   Body: { code, name, parent_code?, canonical_code_id? }
//   Owner/admin only (RLS).
export async function POST(request: NextRequest) {
  const membership = await getCurrentMembership();
  if (!membership) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = (await request.json()) as CreateBody;
  const code = body.code?.trim();
  const name = body.name?.trim();
  if (!code || !name) {
    return NextResponse.json(
      { error: "code and name are required" },
      { status: 400 }
    );
  }

  const ctx = await getClientForRequest();
  if (!ctx.ok) {
    return NextResponse.json(
      { error: `Impersonation rejected: ${ctx.reason}` },
      { status: 401 }
    );
  }

  const { data: { user } } = await ctx.client.auth.getUser();

  const { data, error } = await ctx.client
    .from("org_cost_codes")
    .insert({
      org_id: membership.org_id,
      code,
      name,
      parent_code: body.parent_code ?? null,
      canonical_code_id: body.canonical_code_id ?? null,
      created_by: user?.id ?? null,
    })
    .select("id, code, name, parent_code, canonical_code_id, is_active, created_at, updated_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: `Cost code "${code}" already exists in this org` },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logImpersonatedWrite(ctx, {
    target_record_type: "org_cost_code",
    target_record_id: data.id,
    details: { code, name },
    route: "/api/cost-intelligence/codes",
    method: "POST",
  });

  return NextResponse.json({ code: data }, { status: 201 });
}
