import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { ApiError, withApiError } from "@/lib/api/errors";
import { getCurrentMembership } from "@/lib/org/session";
import { promoteStatus, recalcBatchCounts } from "@/lib/invoices/bulk-import";
import { logActivity } from "@/lib/activity-log";
import { notifyPmsForJob } from "@/lib/notifications";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/invoices/import/[batchId]/send-to-queue
 *
 * Promotes all `import_parsed` rows to `pm_review` / `qa_review` (routed
 * by confidence per determineStatus). Duplicate rows are NOT promoted —
 * they stay in `import_duplicate` so the user can review them separately.
 *
 * Never auto-approves, per task spec.
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

  // Confirm batch
  const { data: batch } = await supabase
    .from("invoice_import_batches")
    .select("id")
    .eq("id", batchId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (!batch) throw new ApiError("Batch not found", 404);

  // Fetch all parsed rows in this batch
  const { data: parsedRows } = await supabase
    .from("invoices")
    .select("id, confidence_score, job_id, vendor_name_raw, total_amount, status_history")
    .eq("org_id", orgId)
    .eq("import_batch_id", batchId)
    .eq("status", "import_parsed");

  const rows = (parsedRows ?? []) as Array<{
    id: string;
    confidence_score: number | null;
    job_id: string | null;
    vendor_name_raw: string | null;
    total_amount: number | null;
    status_history: unknown;
  }>;

  if (rows.length === 0) {
    return NextResponse.json({ promoted: 0, note: "No parsed rows to promote." });
  }

  // Promote each row. We bucket by target status so we can issue two
  // UPDATEs instead of N — confidence_score doesn't change here.
  const now = new Date().toISOString();
  const targetByRow = new Map<string, string>();
  for (const r of rows) {
    const confidence = r.confidence_score ?? 0;
    targetByRow.set(r.id, promoteStatus(confidence));
  }

  // Group by target status and update
  const pmRows: string[] = [];
  const qaRows: string[] = [];
  for (const [id, status] of Array.from(targetByRow)) {
    if (status === "pm_review") pmRows.push(id);
    else qaRows.push(id);
  }

  // Append status_history per row — requires per-row update. Keep it
  // simple with a loop; batch sizes are bounded by import_max_batch_size.
  for (const r of rows) {
    const target = targetByRow.get(r.id)!;
    const history = Array.isArray(r.status_history) ? (r.status_history as unknown[]) : [];
    history.push({
      who: user?.id ?? "system",
      when: now,
      old_status: "import_parsed",
      new_status: target,
      note: "Promoted from bulk import batch to approval queue.",
    });
    await supabase
      .from("invoices")
      .update({ status: target, status_history: history })
      .eq("id", r.id)
      .eq("org_id", orgId);
  }

  // Recompute batch counts and status
  await recalcBatchCounts(supabase, batchId, orgId);

  await logActivity({
    org_id: orgId,
    user_id: user?.id ?? null,
    entity_type: "invoice_import_batch",
    entity_id: batchId,
    action: "sent_to_queue",
    details: {
      total_promoted: rows.length,
      to_pm_review: pmRows.length,
      to_qa_review: qaRows.length,
    },
  });

  // Fire PM notifications (one per unique job) — don't fail the request
  // if notifications choke.
  const uniqueJobs = new Set(
    rows.map((r) => r.job_id).filter((id): id is string => typeof id === "string")
  );
  for (const jobId of Array.from(uniqueJobs)) {
    const jobRows = rows.filter((r) => r.job_id === jobId);
    try {
      await notifyPmsForJob(jobId, orgId, {
        notification_type: "invoice_uploaded",
        subject: `${jobRows.length} new invoice${jobRows.length === 1 ? "" : "s"} imported`,
        body: `${jobRows.length} invoice${jobRows.length === 1 ? "" : "s"} from bulk import need${jobRows.length === 1 ? "s" : ""} your review.`,
        action_url: `/invoices/queue`,
        related_entity_id: batchId,
      });
    } catch (err) {
      console.warn(
        `[import send-to-queue] notifyPmsForJob failed for ${jobId}:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  return NextResponse.json({
    promoted: rows.length,
    to_pm_review: pmRows.length,
    to_qa_review: qaRows.length,
  });
});
