import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { ApiError, withApiError } from "@/lib/api/errors";
import { getCurrentMembership } from "@/lib/org/session";

export const dynamic = "force-dynamic";

interface CreateBody {
  scope_line_id?: unknown;
  bom_line_id?: unknown;
}

/**
 * POST /api/cost-intelligence/bom-attachments/create
 *
 * Manually attach a $0 spec line (line_nature='bom_spec' or
 * 'unclassified') to a scope line on the same invoice. Creates a
 * 'manual' attachment in confirmed status — the PM chose it, so no AI
 * review step needed. If the BOM line's nature was 'unclassified' (e.g.
 * a previously-rejected BOM being re-attached), it gets promoted to
 * 'bom_spec' so it disappears from the Review tab.
 */
export const POST = withApiError(async (req: Request) => {
  const membership = await getCurrentMembership();
  if (!membership) throw new ApiError("Not authenticated", 401);
  if (!["owner", "admin", "pm", "accounting"].includes(membership.role)) {
    throw new ApiError("Insufficient permissions", 403);
  }

  let body: CreateBody;
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    throw new ApiError("Invalid JSON body", 400);
  }

  const scopeLineId = typeof body.scope_line_id === "string" ? body.scope_line_id : null;
  const bomLineId = typeof body.bom_line_id === "string" ? body.bom_line_id : null;
  if (!scopeLineId || !bomLineId) {
    throw new ApiError("scope_line_id and bom_line_id required", 400);
  }
  if (scopeLineId === bomLineId) {
    throw new ApiError("scope_line_id and bom_line_id must differ", 400);
  }

  const supabase = createServerClient();
  const { data: userRes } = await supabase.auth.getUser();
  const userId = userRes.user?.id ?? null;

  const { data: lines } = await supabase
    .from("document_extraction_lines")
    .select("id, org_id, extraction_id, line_nature, raw_description")
    .in("id", [scopeLineId, bomLineId])
    .is("deleted_at", null);

  const rows = (lines ?? []) as Array<{
    id: string;
    org_id: string;
    extraction_id: string;
    line_nature: string | null;
    raw_description: string;
  }>;
  if (rows.length !== 2) {
    throw new ApiError("One or both lines not found", 404);
  }
  const scope = rows.find((r) => r.id === scopeLineId);
  const bom = rows.find((r) => r.id === bomLineId);
  if (!scope || !bom) throw new ApiError("Line lookup failed", 404);
  if (scope.org_id !== membership.org_id || bom.org_id !== membership.org_id) {
    throw new ApiError("Lines not in your org", 403);
  }
  if (scope.extraction_id !== bom.extraction_id) {
    throw new ApiError(
      "Scope and BOM lines must be on the same invoice",
      400
    );
  }
  if (scope.line_nature !== "scope") {
    throw new ApiError("Target line is not a scope line", 400);
  }

  // Reject the bom_line if it is already attached elsewhere (unique index
  // would catch this anyway but surface a friendlier error).
  const { data: existing } = await supabase
    .from("line_bom_attachments")
    .select("id")
    .eq("bom_extraction_line_id", bomLineId)
    .is("deleted_at", null)
    .maybeSingle();
  if (existing) {
    throw new ApiError(
      "This spec line is already attached — remove the existing attachment first",
      409
    );
  }

  const now = new Date().toISOString();

  const { data: inserted, error: insertErr } = await supabase
    .from("line_bom_attachments")
    .insert({
      org_id: membership.org_id,
      scope_extraction_line_id: scopeLineId,
      bom_extraction_line_id: bomLineId,
      attachment_source: "manual",
      confirmation_status: "confirmed",
      confirmed_by: userId,
      confirmed_at: now,
      product_description: bom.raw_description.slice(0, 500),
      product_specs: {},
    })
    .select("id")
    .single();

  if (insertErr || !inserted) {
    throw new ApiError(insertErr?.message ?? "Attachment create failed", 500);
  }

  // Promote BOM line's nature to bom_spec so it stops showing in the
  // Review tab. Safe to run unconditionally — setting bom_spec on a line
  // that already had it is a no-op.
  await supabase
    .from("document_extraction_lines")
    .update({ line_nature: "bom_spec" })
    .eq("id", bomLineId)
    .eq("org_id", membership.org_id);

  return NextResponse.json({ ok: true, attachment_id: inserted.id });
});
