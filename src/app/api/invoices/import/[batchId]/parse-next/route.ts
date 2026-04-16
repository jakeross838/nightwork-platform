import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { ApiError, withApiError } from "@/lib/api/errors";
import { getCurrentMembership } from "@/lib/org/session";
import { parseInvoiceFile, ACCEPTED_MIME_TYPES } from "@/lib/invoices/parse-file";
import { PlanLimitError } from "@/lib/claude";
import { applyParsedToInvoice, recalcBatchCounts } from "@/lib/invoices/bulk-import";
import { logActivity } from "@/lib/activity-log";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_RETRIES = 1; // one retry per task spec

/**
 * POST /api/invoices/import/[batchId]/parse-next
 *
 * Pulls the next `import_queued` invoice in the batch, downloads the
 * file from storage, runs Claude parsing, and updates the row.
 *
 * Client calls this once per file sequentially (rate-limit-safe).
 * Returns `{ done: true }` when the batch has no more queued rows.
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

  // Verify batch belongs to org (RLS would enforce this too, but explicit
  // check keeps error messages clean).
  const { data: batch } = await supabase
    .from("invoice_import_batches")
    .select("id, status")
    .eq("id", batchId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (!batch) throw new ApiError("Batch not found", 404);
  if (batch.status === "cancelled") {
    return NextResponse.json({ done: true, cancelled: true });
  }

  // Claim the next queued row — oldest first so progress feels predictable.
  // Update status to `import_parsing` under the original status guard so two
  // concurrent callers can't claim the same row.
  const { data: claimed } = await supabase
    .from("invoices")
    .select("id, original_file_url, original_filename, original_file_type, import_retry_count")
    .eq("org_id", orgId)
    .eq("import_batch_id", batchId)
    .eq("status", "import_queued")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!claimed) {
    // Nothing queued → either done or all in-flight
    await recalcBatchCounts(supabase, batchId, orgId);
    return NextResponse.json({ done: true });
  }

  const invoiceId = claimed.id as string;
  const storagePath = claimed.original_file_url as string;
  const filename = (claimed.original_filename as string) ?? "invoice";
  const fileType = (claimed.original_file_type as string) ?? "pdf";
  const retryCount = (claimed.import_retry_count as number) ?? 0;

  // Try to claim by updating to `import_parsing` only if still queued
  const { error: claimErr, data: claimData } = await supabase
    .from("invoices")
    .update({ status: "import_parsing" })
    .eq("id", invoiceId)
    .eq("status", "import_queued")
    .select("id");
  if (claimErr || !claimData || claimData.length === 0) {
    // Another worker claimed it — tell the client to keep polling
    return NextResponse.json({ done: false, skipped: true });
  }

  // Download the file from storage
  const { data: fileData, error: downloadErr } = await supabase.storage
    .from("invoice-files")
    .download(storagePath);
  if (downloadErr || !fileData) {
    const msg = downloadErr?.message ?? "download failed";
    await markError(supabase, invoiceId, orgId, msg, retryCount);
    await recalcBatchCounts(supabase, batchId, orgId);
    return NextResponse.json({
      done: false,
      invoice_id: invoiceId,
      status: "import_error",
      error: msg,
    });
  }

  const buffer = Buffer.from(await fileData.arrayBuffer());
  const mediaType = inferMimeType(filename, fileType);
  const fileKind = ACCEPTED_MIME_TYPES[mediaType];
  if (!fileKind || fileKind === "xlsx") {
    const msg = `Unsupported file type: ${mediaType}`;
    await markError(supabase, invoiceId, orgId, msg, retryCount);
    await recalcBatchCounts(supabase, batchId, orgId);
    return NextResponse.json({
      done: false,
      invoice_id: invoiceId,
      status: "import_error",
      error: msg,
    });
  }

  // Parse with one retry on failure (per task spec).
  // Forced-failure mode: FORCE_PARSE_FAIL env var either "always" (every
  // file fails both attempts) or "first" (each file fails its first attempt
  // then succeeds). Used for manual retry-logic verification; harmless in
  // prod because it's only honored when the env var is set.
  const forceFailMode = process.env.FORCE_PARSE_FAIL ?? "";
  let parsedResult;
  let lastErr: Error | null = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (
        forceFailMode === "always" ||
        (forceFailMode === "first" && attempt === 0)
      ) {
        throw new Error(`Simulated parse failure (FORCE_PARSE_FAIL=${forceFailMode})`);
      }
      parsedResult = await parseInvoiceFile({
        buffer,
        mediaType,
        fileKind,
        fileName: filename,
        supabase: supabase as unknown as Parameters<typeof parseInvoiceFile>[0]["supabase"],
        meta: {
          org_id: orgId,
          user_id: user?.id ?? null,
          metadata: { source: "bulk_invoice_import", batch_id: batchId },
        },
      });
      if (attempt > 0) {
        console.log(
          `[import-retry] invoice=${invoiceId} file="${filename}" attempt=${attempt + 1}/${MAX_RETRIES + 1} SUCCEEDED after previous failure: ${lastErr?.message ?? "?"}`
        );
      }
      break;
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      console.log(
        `[import-retry] invoice=${invoiceId} file="${filename}" attempt=${attempt + 1}/${MAX_RETRIES + 1} FAILED: ${lastErr.message}`
      );
      // PlanLimitError is not retriable — surface immediately
      if (err instanceof PlanLimitError) break;
      // If we exhausted retries, log the final decision
      if (attempt === MAX_RETRIES) {
        console.log(
          `[import-retry] invoice=${invoiceId} file="${filename}" giving up after ${MAX_RETRIES + 1} attempts — marking import_error`
        );
      }
    }
  }

  if (!parsedResult) {
    const msg = lastErr?.message ?? "parse failed";
    await markError(supabase, invoiceId, orgId, msg, retryCount + 1);
    await recalcBatchCounts(supabase, batchId, orgId);
    return NextResponse.json({
      done: false,
      invoice_id: invoiceId,
      status: "import_error",
      error: msg,
    });
  }

  // Apply parsed result to the invoice row
  try {
    const applyResult = await applyParsedToInvoice(supabase, {
      invoiceId,
      orgId,
      parsed: parsedResult,
      fileName: filename,
      fileType: fileKind,
    });
    await recalcBatchCounts(supabase, batchId, orgId);

    // Log activity for the import (not on every row — the batch log is enough)
    // We log only once per batch when it transitions to complete; skip per-row.

    return NextResponse.json({
      done: false,
      invoice_id: invoiceId,
      status: applyResult.status,
      job_match_score: applyResult.job_match_score,
      duplicate_of_id: applyResult.duplicate_of_id,
      vendor_name: parsedResult.vendor_name,
      total_amount: parsedResult.total_amount,
      invoice_number: parsedResult.invoice_number,
      confidence_score: parsedResult.confidence_score,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "apply failed";
    await markError(supabase, invoiceId, orgId, msg, retryCount + 1);
    await recalcBatchCounts(supabase, batchId, orgId);
    return NextResponse.json({
      done: false,
      invoice_id: invoiceId,
      status: "import_error",
      error: msg,
    });
  }

  // (unreachable — activity log removed for per-row; batch summary is in recalcBatchCounts)
  void logActivity;
});

async function markError(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  invoiceId: string,
  orgId: string,
  message: string,
  retryCount: number
) {
  await supabase
    .from("invoices")
    .update({
      status: "import_error",
      import_error: message.slice(0, 500), // cap to avoid runaway strings
      import_retry_count: retryCount,
    })
    .eq("id", invoiceId)
    .eq("org_id", orgId);
}

function inferMimeType(filename: string, fileType: string): string {
  if (fileType === "pdf") return "application/pdf";
  if (fileType === "docx")
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  // image — infer from filename extension
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  return "image/jpeg";
}
