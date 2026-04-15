import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { ApiError, withApiError } from "@/lib/api/errors";
import { ADMIN_OR_OWNER, requireRole } from "@/lib/org/require";

export const dynamic = "force-dynamic";

type ImportRow = {
  code: string;
  description: string;
  category?: string | null;
  sort_order?: number;
  is_change_order?: boolean;
};

export const POST = withApiError(async (request: NextRequest) => {
  const membership = await requireRole(ADMIN_OR_OWNER);
  const supabase = createServerClient();
  const body = (await request.json()) as { codes?: ImportRow[] };

  if (!Array.isArray(body.codes) || body.codes.length === 0) {
    throw new ApiError("No rows supplied", 400);
  }

  // Existing codes by `code` for upsert-by-business-key.
  const { data: existing } = await supabase
    .from("cost_codes")
    .select("id, code")
    .eq("org_id", membership.org_id)
    .is("deleted_at", null);

  const byCode = new Map((existing ?? []).map((c) => [c.code, c.id as string]));
  let updates = 0;
  let inserts = 0;

  for (const row of body.codes) {
    const code = row.code?.trim();
    const description = row.description?.trim();
    if (!code || !description) continue;

    const existingId = byCode.get(code);
    if (existingId) {
      const { error } = await supabase
        .from("cost_codes")
        .update({
          description,
          category: row.category ?? null,
          sort_order: row.sort_order ?? 0,
          is_change_order: row.is_change_order ?? false,
        })
        .eq("id", existingId)
        .eq("org_id", membership.org_id);
      if (error) throw new ApiError(`Update ${code}: ${error.message}`, 500);
      updates++;
    } else {
      const { error } = await supabase.from("cost_codes").insert({
        org_id: membership.org_id,
        code,
        description,
        category: row.category ?? null,
        sort_order: row.sort_order ?? 0,
        is_change_order: row.is_change_order ?? false,
      });
      if (error) throw new ApiError(`Insert ${code}: ${error.message}`, 500);
      inserts++;
    }
  }

  return NextResponse.json({ imported: inserts + updates, inserts, updates });
});
