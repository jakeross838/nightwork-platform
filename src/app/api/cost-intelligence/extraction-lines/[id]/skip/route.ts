import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { ApiError, withApiError } from "@/lib/api/errors";
import { getCurrentMembership } from "@/lib/org/session";

export const dynamic = "force-dynamic";

/**
 * PUT /api/cost-intelligence/extraction-lines/[id]/skip
 *
 * Treats a line as administrative (not a catalog item, not a BOM).
 * Appends the line content to document_extractions.skipped_lines for
 * audit, soft-deletes the extraction_line and its components.
 *
 * Used from the Review tab when a PM decides an 'unclassified' line is
 * actually a note / header / boilerplate that should never have been
 * persisted.
 */
export const PUT = withApiError(
  async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const membership = await getCurrentMembership();
    if (!membership) throw new ApiError("Not authenticated", 401);
    if (!["owner", "admin", "pm", "accounting"].includes(membership.role)) {
      throw new ApiError("Insufficient permissions", 403);
    }

    const supabase = createServerClient();

    const { data: line } = await supabase
      .from("document_extraction_lines")
      .select(
        "id, org_id, extraction_id, raw_description, raw_total_cents, line_order, line_nature"
      )
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (!line) throw new ApiError("Line not found", 404);
    const row = line as {
      id: string;
      org_id: string;
      extraction_id: string;
      raw_description: string | null;
      raw_total_cents: number | null;
      line_order: number;
      line_nature: string | null;
    };
    if (row.org_id !== membership.org_id) throw new ApiError("Line not in your org", 403);

    const now = new Date().toISOString();

    const { data: extraction } = await supabase
      .from("document_extractions")
      .select("id, skipped_lines")
      .eq("id", row.extraction_id)
      .maybeSingle();

    const existing = Array.isArray(
      (extraction as { skipped_lines?: unknown } | null)?.skipped_lines
    )
      ? ((extraction as { skipped_lines: unknown[] }).skipped_lines as unknown[])
      : [];

    const entry = {
      line_index: row.line_order,
      raw_description: row.raw_description ?? "",
      amount_cents: row.raw_total_cents ?? 0,
      skip_reason: "admin_note",
      detected_type: "pm_skipped",
      skipped_by: "pm",
      skipped_at: now,
      prior_line_nature: row.line_nature,
    };

    await supabase
      .from("document_extractions")
      .update({ skipped_lines: [...existing, entry] })
      .eq("id", row.extraction_id);

    await supabase
      .from("line_cost_components")
      .update({ deleted_at: now })
      .eq("invoice_extraction_line_id", id)
      .is("deleted_at", null);

    const { error: lineErr } = await supabase
      .from("document_extraction_lines")
      .update({ deleted_at: now })
      .eq("id", id);
    if (lineErr) throw new ApiError(lineErr.message, 500);

    return NextResponse.json({ ok: true, line_id: id });
  }
);
