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
 * same extraction_id is idempotent.
 *
 * Caching (Phase 3.4 Issue 1, migration 00091):
 *   - On hit (extracted_data present AND extraction_prompt_version
 *     matches current EXTRACTION_PROMPT_VERSION), the cached
 *     envelope is returned without calling Claude. Round-trip
 *     drops from 25–40s to <500ms; no api_usage row is recorded
 *     because no model call is made.
 *   - On prompt-version mismatch, the cache is treated as a miss
 *     and re-extracted automatically. The mismatch is logged so
 *     prompt-iteration churn is observable.
 *   - On `?force=true`, the cache is bypassed regardless of state.
 *     Used by the UI's overflow-menu "Re-extract" action when the
 *     PM wants a fresh pass (e.g. after the source PDF changes).
 *
 * Response always includes a `cache` field describing the path
 * taken: { hit: boolean, reason?: "miss"|"prompt_version"|"force" }.
 * The UI uses this to decide whether to log a re-extract event
 * and to suppress the loading state on hits (<1s arrival).
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
import {
  extractProposal,
  type ParsedProposal,
} from "@/lib/ingestion/extract-proposal";
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

  // Cache bust: ?force=true bypasses the cache and re-extracts. PM-driven
  // path for "the source PDF changed" or prompt-iteration debugging.
  const force = request.nextUrl.searchParams.get("force") === "true";

  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Load the extraction row, scoped to this org. RLS would also gate this
  // but the explicit .eq() is defense-in-depth per CLAUDE.md.
  const { data: extractionRow, error: loadError } = await supabase
    .from("document_extractions")
    .select(
      "id, org_id, raw_pdf_url, classified_type, target_entity_type, target_entity_id, classification_confidence, extracted_data, extraction_prompt_version, deleted_at"
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

  // ── Cache hit path ────────────────────────────────────────────────
  // Fast return when extracted_data is present AND the prompt version
  // matches the current code-side version. Skips the storage download,
  // the Claude call, and the api_usage write. Latency target: <500ms.
  const cachedEnvelope = extractionRow.extracted_data as ParsedProposal | null;
  const cachedVersion = extractionRow.extraction_prompt_version;
  const cacheUsable =
    cachedEnvelope !== null &&
    cachedVersion !== null &&
    cachedVersion === EXTRACTION_PROMPT_VERSION;

  if (!force && cacheUsable) {
    return NextResponse.json({
      extraction_id: extractionId,
      classified_type: "proposal",
      classification_confidence: extractionRow.classification_confidence,
      extracted_data: cachedEnvelope,
      confidence_summary: {
        overall: cachedEnvelope.confidence_score,
        per_field: cachedEnvelope.confidence_details,
        flags: cachedEnvelope.flags,
      },
      cache: { hit: true },
    });
  }

  // Cache miss reason — logged so prompt-iteration churn (and forced
  // re-extracts) are observable in production logs.
  const cacheMissReason: "miss" | "prompt_version" | "force" = force
    ? "force"
    : cachedEnvelope === null
      ? "miss"
      : "prompt_version";
  if (cacheMissReason === "prompt_version") {
    console.log(
      `[api/proposals/extract] cache bust on extraction_id=${extractionId}: stored prompt_version=${cachedVersion} != current=${EXTRACTION_PROMPT_VERSION}`
    );
  } else if (cacheMissReason === "force") {
    console.log(
      `[api/proposals/extract] forced re-extract on extraction_id=${extractionId} (?force=true)`
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

  // Persist the normalized envelope into extracted_data alongside the
  // existing metadata. extraction_prompt_version is what the read-side
  // compares against for auto-bust on prompt iteration.
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
      extracted_data: parsed,
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
    cache: { hit: false, reason: cacheMissReason },
  });
});
