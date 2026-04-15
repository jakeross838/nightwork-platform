import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { ApiError, withApiError } from "@/lib/api/errors";
import { getCurrentMembership } from "@/lib/org/session";

export const dynamic = "force-dynamic";

type ImportRow = {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  category?: string;
  notes?: string;
};

export const POST = withApiError(async (request: NextRequest) => {
  const membership = await getCurrentMembership();
  if (!membership) throw new ApiError("Not authenticated", 401);
  if (!["owner", "admin"].includes(membership.role)) throw new ApiError("Forbidden", 403);

  const supabase = createServerClient();
  const body = (await request.json()) as { vendors?: ImportRow[] };
  if (!Array.isArray(body.vendors) || body.vendors.length === 0) throw new ApiError("No rows supplied", 400);

  // Existing vendors for fuzzy-match (case-insensitive).
  const { data: existing } = await supabase
    .from("vendors")
    .select("id, name")
    .eq("org_id", membership.org_id)
    .is("deleted_at", null);
  const byName = new Map<string, string>();
  for (const v of existing ?? []) byName.set(v.name.toLowerCase().trim(), v.id as string);

  let inserts = 0;
  let updates = 0;
  let skipped = 0;

  for (const row of body.vendors) {
    const name = row.name?.trim();
    if (!name) { skipped++; continue; }
    const existingId = byName.get(name.toLowerCase());
    const payload: Record<string, unknown> = {
      name,
      email: row.email?.trim() || null,
      phone: row.phone?.trim() || null,
      address: row.address?.trim() || null,
    };
    if (existingId) {
      const { error } = await supabase
        .from("vendors")
        .update(payload)
        .eq("id", existingId)
        .eq("org_id", membership.org_id);
      if (error) throw new ApiError(`Update ${name}: ${error.message}`, 500);
      updates++;
    } else {
      const { error } = await supabase.from("vendors").insert({
        org_id: membership.org_id,
        ...payload,
      });
      if (error) throw new ApiError(`Insert ${name}: ${error.message}`, 500);
      inserts++;
    }
  }

  return NextResponse.json({ imported: inserts + updates, inserts, updates, skipped });
});
