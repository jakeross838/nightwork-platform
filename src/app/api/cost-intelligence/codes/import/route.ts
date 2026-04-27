import { NextRequest, NextResponse } from "next/server";
import { getCurrentMembership } from "@/lib/org/session";
import {
  getClientForRequest,
  logImpersonatedWrite,
} from "@/lib/auth/impersonation-client";

export const dynamic = "force-dynamic";

interface ImportRow {
  code: string;
  name: string;
  parent_code?: string | null;
  // Optional: NAHB code (e.g. "01-13-2317") to look up and FK to.
  canonical_code?: string | null;
}

interface ImportBody {
  codes?: ImportRow[];
  // Default 'NAHB'; future: 'CSI'.
  spine?: string;
}

interface ImportResult {
  imported: number;
  inserts: number;
  updates: number;
  unmapped_canonical: string[];
}

// POST /api/cost-intelligence/codes/import
//   Body: { codes: [{code, name, parent_code?, canonical_code?}], spine?: 'NAHB' }
//   Bulk upsert by (org_id, code). Optionally resolves canonical_code (text)
//   against canonical_cost_codes for the given spine to populate
//   canonical_code_id (UUID FK).
export async function POST(request: NextRequest) {
  const membership = await getCurrentMembership();
  if (!membership) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = (await request.json()) as ImportBody;
  const codes = Array.isArray(body.codes) ? body.codes : [];
  const spine = body.spine?.trim() || "NAHB";

  if (codes.length === 0) {
    return NextResponse.json({ error: "No rows supplied" }, { status: 400 });
  }
  if (codes.length > 5000) {
    return NextResponse.json(
      { error: "Too many rows (limit 5000 per import)" },
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

  // Resolve canonical_code text refs → canonical_code_id UUIDs.
  const canonicalRefs = Array.from(
    new Set(codes.map((r) => r.canonical_code?.trim()).filter((c): c is string => !!c))
  );

  const canonicalIdByCode = new Map<string, string>();
  if (canonicalRefs.length > 0) {
    const { data: canonRows, error: canonErr } = await ctx.client
      .from("canonical_cost_codes")
      .select("id, code")
      .eq("spine", spine)
      .in("code", canonicalRefs);
    if (canonErr) {
      return NextResponse.json({ error: canonErr.message }, { status: 500 });
    }
    for (const row of canonRows ?? []) {
      canonicalIdByCode.set(row.code as string, row.id as string);
    }
  }

  // Existing org_cost_codes by code (so we can decide insert vs update).
  const { data: existing, error: existErr } = await ctx.client
    .from("org_cost_codes")
    .select("id, code")
    .eq("org_id", membership.org_id);
  if (existErr) {
    return NextResponse.json({ error: existErr.message }, { status: 500 });
  }
  const existingIdByCode = new Map(
    (existing ?? []).map((r) => [r.code as string, r.id as string])
  );

  let inserts = 0;
  let updates = 0;
  const unmappedCanonical: string[] = [];

  for (const row of codes) {
    const code = row.code?.trim();
    const name = row.name?.trim();
    if (!code || !name) continue;

    let canonicalCodeId: string | null = null;
    const canonRef = row.canonical_code?.trim();
    if (canonRef) {
      const found = canonicalIdByCode.get(canonRef);
      if (found) canonicalCodeId = found;
      else if (!unmappedCanonical.includes(canonRef)) unmappedCanonical.push(canonRef);
    }

    const existingId = existingIdByCode.get(code);
    if (existingId) {
      const updates_obj: Record<string, unknown> = {
        name,
        parent_code: row.parent_code ?? null,
        is_active: true,
      };
      if (canonRef !== undefined) updates_obj.canonical_code_id = canonicalCodeId;
      const { error } = await ctx.client
        .from("org_cost_codes")
        .update(updates_obj)
        .eq("id", existingId)
        .eq("org_id", membership.org_id);
      if (error) {
        return NextResponse.json(
          { error: `Update ${code}: ${error.message}` },
          { status: 500 }
        );
      }
      updates++;
    } else {
      const { error } = await ctx.client.from("org_cost_codes").insert({
        org_id: membership.org_id,
        code,
        name,
        parent_code: row.parent_code ?? null,
        canonical_code_id: canonicalCodeId,
        created_by: user?.id ?? null,
      });
      if (error) {
        return NextResponse.json(
          { error: `Insert ${code}: ${error.message}` },
          { status: 500 }
        );
      }
      inserts++;
    }
  }

  await logImpersonatedWrite(ctx, {
    target_record_type: "org_cost_code",
    target_record_id: null,
    details: { inserts, updates, unmapped_canonical: unmappedCanonical.length },
    route: "/api/cost-intelligence/codes/import",
    method: "POST",
  });

  const result: ImportResult = {
    imported: inserts + updates,
    inserts,
    updates,
    unmapped_canonical: unmappedCanonical,
  };
  return NextResponse.json(result);
}
