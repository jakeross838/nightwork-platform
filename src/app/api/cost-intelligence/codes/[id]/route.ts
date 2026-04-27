import { NextRequest, NextResponse } from "next/server";
import { getCurrentMembership } from "@/lib/org/session";
import { updateWithLock, isLockConflict } from "@/lib/api/optimistic-lock";
import {
  getClientForRequest,
  logImpersonatedWrite,
} from "@/lib/auth/impersonation-client";

export const dynamic = "force-dynamic";

interface PatchBody {
  code?: string;
  name?: string;
  parent_code?: string | null;
  canonical_code_id?: string | null;
  is_active?: boolean;
  expected_updated_at?: string;
}

const ALLOWED_FIELDS: (keyof Omit<PatchBody, "expected_updated_at">)[] = [
  "code",
  "name",
  "parent_code",
  "canonical_code_id",
  "is_active",
];

// PATCH /api/cost-intelligence/codes/[id]
//   Body: { code?, name?, parent_code?, canonical_code_id?, is_active?, expected_updated_at? }
//   Owner/admin only (RLS). Optimistic locking via expected_updated_at.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const membership = await getCurrentMembership();
  if (!membership) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = (await request.json()) as PatchBody;
  const updates: Record<string, unknown> = {};
  for (const f of ALLOWED_FIELDS) {
    if (body[f] !== undefined) updates[f] = body[f];
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "At least one editable field is required" },
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

  const lockResult = await updateWithLock<{
    id: string;
    code: string;
    name: string;
    parent_code: string | null;
    canonical_code_id: string | null;
    is_active: boolean;
    updated_at: string;
  }>(ctx.client, {
    table: "org_cost_codes",
    id,
    orgId: membership.org_id,
    expectedUpdatedAt: body.expected_updated_at,
    updates,
    selectCols:
      "id, code, name, parent_code, canonical_code_id, is_active, created_at, updated_at",
  });
  if (isLockConflict(lockResult)) {
    return lockResult.response;
  }

  await logImpersonatedWrite(ctx, {
    target_record_type: "org_cost_code",
    target_record_id: id,
    details: { fields: Object.keys(updates) },
    route: `/api/cost-intelligence/codes/${id}`,
    method: "PATCH",
  });

  return NextResponse.json({ code: lockResult });
}

// DELETE /api/cost-intelligence/codes/[id]
//   Soft-delete: sets is_active = false. Owner/admin only (RLS).
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

  const { error } = await ctx.client
    .from("org_cost_codes")
    .update({ is_active: false })
    .eq("id", id)
    .eq("org_id", membership.org_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logImpersonatedWrite(ctx, {
    target_record_type: "org_cost_code",
    target_record_id: id,
    details: { soft_deleted: true },
    route: `/api/cost-intelligence/codes/${id}`,
    method: "DELETE",
  });

  return NextResponse.json({ ok: true });
}
