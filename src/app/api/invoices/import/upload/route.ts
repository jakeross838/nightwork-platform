import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { ApiError, withApiError } from "@/lib/api/errors";
import { getCurrentMembership } from "@/lib/org/session";
import { getWorkflowSettings } from "@/lib/workflow-settings";
import { ACCEPTED_MIME_TYPES } from "@/lib/invoices/parse-file";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB per file (task spec)

interface UploadedFile {
  invoice_id: string;
  filename: string;
  storage_path: string;
  file_type: "pdf" | "image" | "docx";
  size: number;
}

/**
 * POST /api/invoices/import/upload
 *
 * Multipart form upload — accepts up to N files (bounded by org's
 * import_max_batch_size setting, max 200 absolute). Creates a
 * `invoice_import_batches` row and N `invoices` rows in `import_queued`
 * state. Parsing happens asynchronously via parse-next, driven by the
 * client so rate limits are respected.
 */
export const POST = withApiError(async (req: NextRequest) => {
  const membership = await getCurrentMembership();
  if (!membership) throw new ApiError("Not authenticated", 401);
  if (!["admin", "owner", "accounting"].includes(membership.role)) {
    throw new ApiError("Only admins or accounting can bulk import", 403);
  }

  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new ApiError("Not authenticated", 401);

  const orgId = membership.org_id;
  const settings = await getWorkflowSettings(orgId);
  const maxBatch = Math.min(settings.import_max_batch_size ?? 50, 200);

  const formData = await req.formData();
  const files = formData.getAll("files").filter((v): v is File => v instanceof File);

  if (files.length === 0) {
    throw new ApiError("No files provided", 400);
  }
  if (files.length > maxBatch) {
    throw new ApiError(
      `Batch size ${files.length} exceeds org limit of ${maxBatch}. Split into multiple imports.`,
      400
    );
  }

  // Validate each file before we start any I/O
  for (const f of files) {
    if (f.size > MAX_FILE_SIZE) {
      throw new ApiError(
        `${f.name} is ${(f.size / 1024 / 1024).toFixed(1)}MB — limit is 10MB per file`,
        400
      );
    }
    const kind = ACCEPTED_MIME_TYPES[f.type];
    if (!kind) {
      throw new ApiError(
        `${f.name}: unsupported file type ${f.type}. Allowed: PDF, image, DOCX.`,
        400
      );
    }
    if (kind === "xlsx") {
      throw new ApiError(
        `${f.name}: XLSX not supported yet. Convert to PDF first.`,
        400
      );
    }
  }

  // Create batch row first so we can attach invoices to it atomically
  const { data: batchRow, error: batchErr } = await supabase
    .from("invoice_import_batches")
    .insert({
      org_id: orgId,
      created_by: user.id,
      total_files: files.length,
      status: "processing",
      settings_snapshot: {
        max_batch_size: maxBatch,
        default_pm_id: settings.import_default_pm_id,
        auto_route_threshold: settings.import_auto_route_threshold,
      },
    })
    .select("id")
    .single();

  if (batchErr || !batchRow) {
    throw new ApiError(`Failed to create batch: ${batchErr?.message ?? "unknown"}`, 500);
  }
  const batchId = batchRow.id as string;

  // Upload files + create invoice rows sequentially so errors on file N
  // don't create orphaned storage objects for N+1...
  const uploaded: UploadedFile[] = [];
  const today = new Date().toISOString().split("T")[0];

  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const kind = ACCEPTED_MIME_TYPES[file.type] as "pdf" | "image" | "docx";
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const timestamp = Date.now();
    const storagePath = `${orgId}/uploads/${timestamp}_${safeName}`;

    const { error: uploadErr } = await supabase.storage
      .from("invoice-files")
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadErr) {
      // Partial batch — abort uploads for remaining files but don't tear
      // down already-created rows (user can retry). Mark this one as
      // errored so the UI shows it.
      await supabase.from("invoices").insert({
        org_id: orgId,
        status: "import_error",
        import_batch_id: batchId,
        import_error: `Storage upload failed: ${uploadErr.message}`,
        original_filename: file.name,
        original_file_type: kind === "image" ? "image" : kind,
        received_date: today,
        total_amount: 0,
        confidence_score: 0,
        created_by: user.id,
      });
      continue;
    }

    const { data: invRow, error: invErr } = await supabase
      .from("invoices")
      .insert({
        org_id: orgId,
        status: "import_queued",
        import_batch_id: batchId,
        original_file_url: storagePath,
        original_filename: file.name,
        original_file_type: kind === "image" ? "image" : kind,
        received_date: today,
        total_amount: 0, // will be filled on parse
        confidence_score: 0,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (invErr || !invRow) {
      console.error("Bulk import invoice insert failed:", invErr);
      continue;
    }

    uploaded.push({
      invoice_id: invRow.id as string,
      filename: file.name,
      storage_path: storagePath,
      file_type: kind,
      size: file.size,
    });
  }

  return NextResponse.json({
    batch_id: batchId,
    total_queued: uploaded.length,
    files: uploaded,
  });
});
