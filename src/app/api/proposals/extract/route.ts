/**
 * Phase 3.4 Step 3 — POST /api/proposals/extract
 *
 * Inputs an extraction_id from a prior /api/ingest call where
 * classified_type='proposal'. Loads the source PDF from Supabase
 * storage, calls extractProposal() to extract structured proposal
 * data via Claude, updates the document_extractions row with
 * extraction metadata + per-field confidences, and returns the
 * normalized payload to the caller.
 *
 * Does NOT create the proposals entity yet — Step 5's
 * /api/proposals/commit owns that, after PM review. The raw
 * extraction is returned in the response so the review UI can
 * carry it forward to commit. Re-running this endpoint on the
 * same extraction_id is idempotent (it overwrites the metadata).
 *
 * Auth/org scoping mirrors /api/ingest:
 *   - getCurrentMembership() (Phase A standard — gives us the role
 *     object for future write authz, not just the org id)
 *   - every Supabase query .eq("org_id", membership.org_id)
 *   - storage downloads use the row.raw_pdf_url that was written
 *     by /api/ingest under ${org_id}/ingest/...
 *
 * Failure handling: extract failure does NOT soft-delete the row
 * (unlike /api/ingest, where the row is brand-new on failure).
 * Here the row pre-exists — soft-deleting would orphan the
 * classifier's result. Instead we leave the row alone and return
 * a structured 500; the api_usage row already records the
 * attempted call. PM can retry or upload a fresh document.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentMembership } from "@/lib/org/session";
import { ApiError, withApiError } from "@/lib/api/errors";
import { extractProposal } from "@/lib/ingestion/extract-proposal";
import { PlanLimitError } from "@/lib/claude";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const EXTRACTION_PROMPT_VERSION = "phase-3.4-step2";
const EXTRACTION_MODEL_TAG = "claude-sonnet-4-20250514";

export const POST = withApiError(async (request: NextRequest) => {
  const membership = await getCurrentMembership();
  if (!membership) throw new ApiError("Not authenticated", 401);

  const body = (await request.json().catch(() => null)) as
    | { extraction_id?: string }
    | null;
  const extractionId = body?.extraction_id;
  if (!extractionId || typeof extractionId !== "string") {
    throw new ApiError("Missing or invalid extraction_id", 400);
  }

  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Load the extraction row, scoped to this org. RLS would also gate this
  // but the explicit .eq() is defense-in-depth per CLAUDE.md.
  const { data: extractionRow, error: loadError } = await supabase
    .from("document_extractions")
    .select(
      "id, org_id, raw_pdf_url, classified_type, target_entity_type, target_entity_id, classification_confidence, deleted_at"
    )
    .eq("id", extractionId)
    .eq("org_id", membership.org_id)
    .is("deleted_at", null)
    .maybeSingle();

  if (loadError) {
    console.error("[api/proposals/extract] load failed:", loadError.message);
    throw new ApiError(
      `Failed to load extraction row: ${loadError.message}`,
      500
    );
  }
  if (!extractionRow) {
    throw new ApiError("Extraction not found", 404);
  }

  if (extractionRow.classified_type !== "proposal") {
    throw new ApiError(
      `Extraction ${extractionId} is classified as ${extractionRow.classified_type ?? "unknown"}, not proposal — refuse to extract proposal data from non-proposal documents`,
      409
    );
  }

  if (extractionRow.target_entity_id) {
    throw new ApiError(
      `Extraction ${extractionId} has already been committed (target_entity_id is set) — re-extracting a committed proposal is not allowed`,
      409
    );
  }

  if (!extractionRow.raw_pdf_url) {
    throw new ApiError(
      `Extraction ${extractionId} has no raw_pdf_url — cannot load source PDF`,
      500
    );
  }

  // Pull the source PDF from storage. Bucket name mirrors /api/ingest's
  // upload target ("invoice-files"). Storage RLS restricts to org_id.
  const { data: file, error: dlError } = await supabase.storage
    .from("invoice-files")
    .download(extractionRow.raw_pdf_url);

  if (dlError || !file) {
    console.error("[api/proposals/extract] storage download failed:", dlError?.message);
    throw new ApiError(
      `Failed to download source PDF: ${dlError?.message ?? "no file returned"}`,
      500
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let parsed;
  try {
    parsed = await extractProposal(
      { pdfBuffer: buffer, documentId: extractionId },
      {
        org_id: membership.org_id,
        user_id: user?.id ?? null,
        metadata: {
          source: "api/proposals/extract",
          extraction_id: extractionId,
        },
      }
    );
  } catch (err) {
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
    const message = err instanceof Error ? err.message : "Unknown extractor error";
    console.error("[api/proposals/extract] extractor failed:", message);
    throw new ApiError(`Proposal extraction failed: ${message}`, 500);
  }

  // Mark the row as extracted. Persists target_entity_type='proposal'
  // (so /api/proposals/commit knows where this is headed) and the
  // per-field confidence map. The raw extraction payload is NOT
  // persisted on document_extractions — it returns to the UI in this
  // response and the UI carries it forward to /api/proposals/commit.
  // Re-extracting is idempotent.
  const fieldConfidences = {
    overall: parsed.confidence_score,
    ...parsed.confidence_details,
  };

  const { error: updateError } = await supabase
    .from("document_extractions")
    .update({
      target_entity_type: "proposal",
      extracted_at: new Date().toISOString(),
      extraction_model: EXTRACTION_MODEL_TAG,
      extraction_prompt_version: EXTRACTION_PROMPT_VERSION,
      field_confidences: fieldConfidences,
    })
    .eq("id", extractionId)
    .eq("org_id", membership.org_id);

  if (updateError) {
    console.error("[api/proposals/extract] post-extract update failed:", updateError.message);
    throw new ApiError(
      `Failed to record extraction metadata: ${updateError.message}`,
      500
    );
  }

  return NextResponse.json({
    extraction_id: extractionId,
    classified_type: "proposal",
    classification_confidence: extractionRow.classification_confidence,
    extracted_data: parsed,
    confidence_summary: {
      overall: parsed.confidence_score,
      per_field: parsed.confidence_details,
      flags: parsed.flags,
    },
  });
});
