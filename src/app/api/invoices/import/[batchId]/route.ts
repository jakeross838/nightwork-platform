import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { ApiError, withApiError } from "@/lib/api/errors";
import { getCurrentMembership } from "@/lib/org/session";

export const dynamic = "force-dynamic";

/**
 * GET /api/invoices/import/[batchId]
 *
 * Returns the batch row + all invoices in it, shaped for the live-update
 * table. Client polls this every 1s while parsing is in progress.
 */
export const GET = withApiError(async (
  _req: NextRequest,
  { params }: { params: { batchId: string } }
) => {
  const membership = await getCurrentMembership();
  if (!membership) throw new ApiError("Not authenticated", 401);

  const supabase = createServerClient();
  const orgId = membership.org_id;
  const batchId = params.batchId;

  const { data: batch } = await supabase
    .from("invoice_import_batches")
    .select("*")
    .eq("id", batchId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (!batch) throw new ApiError("Batch not found", 404);

  const { data: invoices } = await supabase
    .from("invoices")
    .select(
      "id, status, original_filename, original_file_type, vendor_name_raw, vendor_id, " +
        "invoice_number, invoice_date, total_amount, confidence_score, job_id, " +
        "duplicate_of_id, import_error, import_retry_count, created_at, " +
        "jobs:job_id (id, name), vendors:vendor_id (id, name)"
    )
    .eq("org_id", orgId)
    .eq("import_batch_id", batchId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  return NextResponse.json({
    batch,
    invoices: invoices ?? [],
  });
});
