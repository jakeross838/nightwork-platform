import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentMembership } from "@/lib/org/session";
import { ApiError, withApiError } from "@/lib/api/errors";
import { classifyDocument } from "@/lib/ingestion/classify";
import { PlanLimitError } from "@/lib/claude";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const ACCEPTED_MIME = new Set(["application/pdf"]);

export const POST = withApiError(async (request: NextRequest) => {
  const membership = await getCurrentMembership();
  if (!membership) throw new ApiError("Not authenticated", 401);

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) throw new ApiError("No file provided", 400);

  if (!ACCEPTED_MIME.has(file.type)) {
    throw new ApiError(
      `Unsupported file type: ${file.type || "<unknown>"}. Only application/pdf is accepted by /api/ingest in v2.`,
      400
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${membership.org_id}/ingest/${timestamp}_${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from("invoice-files")
    .upload(storagePath, buffer, { contentType: file.type, upsert: false });

  if (uploadError) {
    console.error("[api/ingest] storage upload failed:", uploadError.message);
    throw new ApiError(`Storage upload failed: ${uploadError.message}`, 500);
  }

  const { data: inserted, error: insertError } = await supabase
    .from("document_extractions")
    .insert({
      org_id: membership.org_id,
      invoice_id: null,
      raw_pdf_url: storagePath,
      verification_status: "pending",
      extraction_model: "classifier-only",
      extraction_prompt_version: "phase-3.2-v2",
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    console.error("[api/ingest] document_extractions insert failed:", insertError?.message);
    throw new ApiError(
      `Failed to create document_extractions row: ${insertError?.message ?? "no row returned"}`,
      500
    );
  }

  const extractionId = inserted.id as string;

  try {
    const classification = await classifyDocument(
      { pdfBuffer: buffer, documentId: extractionId },
      {
        org_id: membership.org_id,
        user_id: user?.id ?? null,
        metadata: { source: "api/ingest", extraction_id: extractionId },
      }
    );

    const { error: updateError } = await supabase
      .from("document_extractions")
      .update({
        classified_type: classification.classified_type,
        classification_confidence: classification.classification_confidence,
      })
      .eq("id", extractionId)
      .eq("org_id", membership.org_id);

    if (updateError) {
      console.error("[api/ingest] update after classify failed:", updateError.message);
      throw new ApiError(`Failed to record classification: ${updateError.message}`, 500);
    }

    return NextResponse.json({
      extraction_id: extractionId,
      classified_type: classification.classified_type,
      classification_confidence: classification.classification_confidence,
    });
  } catch (err) {
    // The verification_status enum has no 'failed' value, so we soft-delete
    // the row (deleted_at = now()) to keep it out of active queries while
    // preserving the audit trail. The api_usage row already records the
    // attempted call. Re-throw so withApiError emits the right status.
    await supabase
      .from("document_extractions")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", extractionId)
      .eq("org_id", membership.org_id);

    if (err instanceof PlanLimitError) {
      return NextResponse.json(
        {
          error: "AI call limit reached",
          current: err.current,
          limit: err.limit,
          plan: err.plan,
        },
        { status: 429 }
      );
    }

    const message = err instanceof Error ? err.message : "Unknown classifier error";
    console.error("[api/ingest] classifier failed:", message);
    throw new ApiError(`Classifier failed: ${message}`, 500);
  }
});
