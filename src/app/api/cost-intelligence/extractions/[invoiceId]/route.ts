import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { ApiError, withApiError } from "@/lib/api/errors";
import { getCurrentMembership } from "@/lib/org/session";
import { extractInvoice } from "@/lib/cost-intelligence/extract-invoice";
import type {
  InvoiceExtractionRow,
  InvoiceExtractionLineRow,
} from "@/lib/cost-intelligence/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/cost-intelligence/extractions/[invoiceId]
 *
 * Returns the extraction row + all lines for an invoice. Used by the
 * verification panel on /invoices/[id].
 */
export const GET = withApiError(async (_req: NextRequest, ctx: { params: Promise<{ invoiceId: string }> }) => {
  const { invoiceId } = await ctx.params;
  const membership = await getCurrentMembership();
  if (!membership) throw new ApiError("Not authenticated", 401);

  const supabase = createServerClient();

  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, org_id")
    .eq("id", invoiceId)
    .eq("org_id", membership.org_id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!invoice) throw new ApiError("Invoice not found", 404);

  const { data: extraction } = await supabase
    .from("invoice_extractions")
    .select("*")
    .eq("invoice_id", invoiceId)
    .eq("org_id", membership.org_id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!extraction) {
    return NextResponse.json({
      extraction: null,
      lines: [],
    });
  }

  const { data: lines } = await supabase
    .from("invoice_extraction_lines")
    .select("*, proposed_item:items!proposed_item_id(id,canonical_name,item_type,category,subcategory,unit), verified_item:items!verified_item_id(id,canonical_name,item_type,category,subcategory,unit)")
    .eq("extraction_id", (extraction as InvoiceExtractionRow).id)
    .eq("org_id", membership.org_id)
    .is("deleted_at", null)
    .order("line_order", { ascending: true });

  return NextResponse.json({
    extraction: extraction as InvoiceExtractionRow,
    lines: (lines ?? []) as (InvoiceExtractionLineRow & {
      proposed_item: { id: string; canonical_name: string } | null;
      verified_item: { id: string; canonical_name: string } | null;
    })[],
  });
});

/**
 * POST /api/cost-intelligence/extractions/[invoiceId]
 *
 * Triggers (re)extraction. Body: { reextract?: boolean }.
 */
export const POST = withApiError(async (req: NextRequest, ctx: { params: Promise<{ invoiceId: string }> }) => {
  const { invoiceId } = await ctx.params;
  const membership = await getCurrentMembership();
  if (!membership) throw new ApiError("Not authenticated", 401);
  if (!["owner", "admin", "pm", "accounting"].includes(membership.role)) {
    throw new ApiError("Insufficient permissions", 403);
  }

  const body: { reextract?: boolean } = await req.json().catch(() => ({}));

  const supabase = createServerClient();
  const { data: user } = await supabase.auth.getUser();

  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, org_id")
    .eq("id", invoiceId)
    .eq("org_id", membership.org_id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!invoice) throw new ApiError("Invoice not found", 404);

  const report = await extractInvoice(supabase, invoiceId, {
    reextract: !!body.reextract,
    triggeredBy: user.user?.id ?? null,
  });

  return NextResponse.json({ report });
});
