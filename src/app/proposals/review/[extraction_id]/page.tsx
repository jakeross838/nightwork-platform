/**
 * Phase 3.4 Step 4 — proposal review form (server-side data load).
 *
 * Lands here from the upload + classify + extract flow. PM reviews the
 * AI-extracted proposal data alongside the original PDF, edits any field,
 * and either commits (Save / Convert to PO) or rejects.
 *
 * Server-side responsibilities:
 *   - getCurrentMembership() auth gate (redirects to /login)
 *   - Load document_extractions row, validate classified_type='proposal'
 *     and target_entity_type='proposal' (extract has run)
 *   - Generate signed URL for PDF storage path so the iframe preview
 *     can render without leaking the storage URL
 *   - Load jobs, vendors, org_cost_codes (Phase 3.3 [New]),
 *     cost_codes (Phase 1 [Legacy]), and any pending_cost_code_suggestions
 *     for this PM (so suggested-but-not-resolved codes are still
 *     pickable per Jake's clarification 3 in prompt 176)
 *
 * Client-side responsibilities (ReviewManager):
 *   - useEffect: fetch /api/proposals/extract on mount → ParsedProposal
 *   - Editable form for every field with confidence indicators
 *   - 4 action buttons: Save, Convert to PO, Convert to CO (disabled),
 *     Reject
 *   - "Suggest new code" inline modal on each line's cost-code dropdown
 */

import { notFound, redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentMembership } from "@/lib/org/session";
import ReviewManager from "./ReviewManager";

export const dynamic = "force-dynamic";

export type ExtractionRow = {
  id: string;
  org_id: string;
  raw_pdf_url: string;
  classified_type: string | null;
  target_entity_type: string | null;
  target_entity_id: string | null;
  classification_confidence: number | null;
  field_confidences: Record<string, number> | null;
  extraction_model: string | null;
  extraction_prompt_version: string | null;
};

export type JobOption = {
  id: string;
  name: string;
  client_name: string | null;
};

export type VendorOption = {
  id: string;
  name: string;
};

// org_cost_codes (Phase 3.3 namespace) — labeled "[New]" in the dropdown.
export type OrgCostCodeOption = {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
};

// cost_codes (Phase 1 legacy namespace) — labeled "[Legacy]" in the
// dropdown. Per Jake's clarification 3 (prompt 176), proposal review
// must show both so PMs can pick whichever code their team uses today.
export type LegacyCostCodeOption = {
  id: string;
  code: string;
  description: string;
};

export type PendingSuggestionOption = {
  id: string;
  suggested_code: string;
  suggested_name: string;
  source_proposal_line_item_id: string | null;
};

interface PageProps {
  params: { extraction_id: string };
}

export default async function ProposalReviewPage({ params }: PageProps) {
  const membership = await getCurrentMembership();
  if (!membership) redirect("/login");

  const supabase = createServerClient();

  const { data: row, error: rowErr } = await supabase
    .from("document_extractions")
    .select(
      "id, org_id, raw_pdf_url, classified_type, target_entity_type, target_entity_id, classification_confidence, field_confidences, extraction_model, extraction_prompt_version"
    )
    .eq("id", params.extraction_id)
    .eq("org_id", membership.org_id)
    .is("deleted_at", null)
    .maybeSingle();

  if (rowErr || !row) notFound();
  if (row.classified_type !== "proposal") notFound();

  // Generate signed URL for the PDF preview iframe. 1-hour expiry is
  // enough for one review session; longer would mean the URL leaks
  // into browser history with read access.
  let pdfSignedUrl: string | null = null;
  if (row.raw_pdf_url) {
    const { data: signed } = await supabase.storage
      .from("invoice-files")
      .createSignedUrl(row.raw_pdf_url, 60 * 60);
    pdfSignedUrl = signed?.signedUrl ?? null;
  }

  const [jobsRes, vendorsRes, orgCodesRes, legacyCodesRes, suggestionsRes] =
    await Promise.all([
      supabase
        .from("jobs")
        .select("id, name, client_name")
        .eq("org_id", membership.org_id)
        .is("deleted_at", null)
        .order("name", { ascending: true }),
      supabase
        .from("vendors")
        .select("id, name")
        .eq("org_id", membership.org_id)
        .is("deleted_at", null)
        .order("name", { ascending: true }),
      supabase
        .from("org_cost_codes")
        .select("id, code, name, is_active")
        .eq("org_id", membership.org_id)
        .eq("is_active", true)
        .order("code", { ascending: true }),
      supabase
        .from("cost_codes")
        .select("id, code, description")
        .eq("org_id", membership.org_id)
        .is("deleted_at", null)
        .order("code", { ascending: true }),
      supabase
        .from("pending_cost_code_suggestions")
        .select("id, suggested_code, suggested_name, source_proposal_line_item_id")
        .eq("org_id", membership.org_id)
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
    ]);

  return (
    <ReviewManager
      extraction={row as ExtractionRow}
      pdfSignedUrl={pdfSignedUrl}
      jobs={(jobsRes.data ?? []) as JobOption[]}
      vendors={(vendorsRes.data ?? []) as VendorOption[]}
      orgCostCodes={(orgCodesRes.data ?? []) as OrgCostCodeOption[]}
      legacyCostCodes={(legacyCodesRes.data ?? []) as LegacyCostCodeOption[]}
      pendingSuggestions={(suggestionsRes.data ?? []) as PendingSuggestionOption[]}
      role={membership.role}
    />
  );
}
