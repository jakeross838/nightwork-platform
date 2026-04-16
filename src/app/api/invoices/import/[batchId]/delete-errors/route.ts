import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { ApiError, withApiError } from "@/lib/api/errors";
import { getCurrentMembership } from "@/lib/org/session";
import { recalcBatchCounts } from "@/lib/invoices/bulk-import";
import { logActivity } from "@/lib/activity-log";

export const dynamic = "force-dynamic";

/**
 * POST /api/invoices/import/[batchId]/delete-errors
 *
 * Soft-deletes all `import_error` rows in the batch. Uses soft delete
 * per the project architecture rule (never physical delete).
 */
export const POST = withApiError(async (
  _req: NextRequest,
  { params }: { params: { batchId: string } }
) => {
  const membership = await getCurrentMembership();
  if (!membership) throw new ApiError("Not authenticated", 401);
  if (!["admin", "owner", "accounting"].includes(membership.role)) {
    throw new ApiError("Not authorized", 403);
  }

  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const orgId = membership.org_id;
  const batchId = params.batchId;

  // Soft delete errored rows in this batch
  const { data: deleted, error } = await supabase
    .from("invoices")
    .update({ deleted_at: new Date().toISOString() })
    .eq("org_id", orgId)
    .eq("import_batch_id", batchId)
    .eq("status", "import_error")
    .is("deleted_at", null)
    .select("id");

  if (error) throw new ApiError(`Delete failed: ${error.message}`, 500);

  await recalcBatchCounts(supabase, batchId, orgId);

  await logActivity({
    org_id: orgId,
    user_id: user?.id ?? null,
    entity_type: "invoice_import_batch",
    entity_id: batchId,
    action: "deleted_errors",
    details: { count: (deleted ?? []).length },
  });

  return NextResponse.json({ deleted: (deleted ?? []).length });
});
