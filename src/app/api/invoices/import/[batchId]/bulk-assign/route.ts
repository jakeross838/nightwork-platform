import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { ApiError, withApiError } from "@/lib/api/errors";
import { getCurrentMembership } from "@/lib/org/session";
import { logActivity } from "@/lib/activity-log";

export const dynamic = "force-dynamic";

/**
 * POST /api/invoices/import/[batchId]/bulk-assign
 *
 * Body: { invoice_ids: string[], job_id: string }
 *
 * Assigns the given job to all listed invoices in the batch. Only touches
 * rows in `import_parsed` / `import_queued` / `import_duplicate` state —
 * doesn't mutate anything already sent to the approval queue.
 */
export const POST = withApiError(async (
  req: NextRequest,
  { params }: { params: { batchId: string } }
) => {
  const membership = await getCurrentMembership();
  if (!membership) throw new ApiError("Not authenticated", 401);
  if (!["admin", "owner", "accounting"].includes(membership.role)) {
    throw new ApiError("Not authorized", 403);
  }

  const body = await req.json().catch(() => ({}));
  const invoiceIds: unknown = body?.invoice_ids;
  const jobId: unknown = body?.job_id;

  if (!Array.isArray(invoiceIds) || invoiceIds.length === 0) {
    throw new ApiError("invoice_ids required", 400);
  }
  if (typeof jobId !== "string" || !jobId) {
    throw new ApiError("job_id required", 400);
  }

  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const orgId = membership.org_id;
  const batchId = params.batchId;

  // Confirm job belongs to org
  const { data: job } = await supabase
    .from("jobs")
    .select("id, name, pm_id")
    .eq("id", jobId)
    .eq("org_id", orgId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!job) throw new ApiError("Job not found", 404);

  // Update only rows still in import states — never retouch post-send rows
  const { data: updated, error } = await supabase
    .from("invoices")
    .update({
      job_id: jobId,
      assigned_pm_id: job.pm_id ?? null,
    })
    .eq("org_id", orgId)
    .eq("import_batch_id", batchId)
    .in("id", invoiceIds as string[])
    .in("status", ["import_parsed", "import_queued", "import_duplicate", "import_error"])
    .select("id");

  if (error) throw new ApiError(`Bulk assign failed: ${error.message}`, 500);

  await logActivity({
    org_id: orgId,
    user_id: user?.id ?? null,
    entity_type: "invoice_import_batch",
    entity_id: batchId,
    action: "bulk_assigned_job",
    details: {
      job_id: jobId,
      job_name: job.name,
      invoice_count: (updated ?? []).length,
    },
  });

  return NextResponse.json({ updated: (updated ?? []).length });
});
