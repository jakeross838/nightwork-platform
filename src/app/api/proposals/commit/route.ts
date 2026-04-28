/**
 * Phase 3.4 Step 5 — POST /api/proposals/commit
 *
 * The big one. Takes a fully-edited proposal review form, creates the
 * proposals + proposal_line_items rows, runs the NARROW-scope cost
 * intelligence wiring (similarity search + items insert with embedding),
 * resolves the cost-code dual-write per Jake's clarification 3 in
 * prompt 176, and updates document_extractions.target_entity_id.
 *
 * Auth/role gate: getCurrentMembership() + role IN
 * (owner, admin, pm, accounting). Same as the proposals INSERT RLS
 * policy from migration 00065. Defense-in-depth.
 *
 * Cost-code dual-write per clarification 3:
 *   - pick.kind === 'org'    → write org_cost_code_id; cost_code_id NULL
 *   - pick.kind === 'legacy' → write cost_code_id (Phase-1 accounting
 *                              compat) AND find-or-create matching
 *                              org_cost_codes row for cost intel wiring
 *   - pick.kind === 'pending'→ both NULL on the line; suggestion's
 *                              source_proposal_line_item_id back-linked
 *   - pick.kind === 'none'   → both NULL (PM left it for later)
 *
 * The legacy → org_cost_codes auto-create runs via service-role client
 * because RLS gates org_cost_codes INSERT to owner/admin only; PMs
 * commit proposals but the auto-create is a system-level mirroring
 * action, not a PM-driven write of new cost codes.
 *
 * Cost intelligence wiring (NARROW per locked decision):
 *   - For each line item, embed description_normalized || description
 *     and similarity-search items.embedding. If top match similarity
 *     ≥ 0.85 (per addendum-1 §Phase 3.4 exit gate), attach existing
 *     item_id and bump occurrence_count.
 *   - Else create a new items row with the embedding inline. item_type
 *     defaults to 'other'; unit normalized to items.unit CHECK enum
 *     ('each','sf','lf', etc.). canonical_name from
 *     description_normalized || description; specs from attributes.
 *
 * Single-transaction goal: Supabase JS doesn't expose first-class
 * BEGIN/COMMIT across multiple table writes. We run sequentially with
 * rollback-on-error semantics (soft-delete the proposal if a downstream
 * step fails); the proposal/line/items wiring stays close enough to
 * atomic for v1. A future pass can wrap this in a SECURITY DEFINER
 * Postgres function for true atomicity.
 */

import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@/lib/supabase/server";
import { tryCreateServiceRoleClient } from "@/lib/supabase/service";
import { getCurrentMembership } from "@/lib/org/session";
import { ApiError, withApiError } from "@/lib/api/errors";
import { generateEmbedding, vectorLiteral } from "@/lib/cost-intelligence/embeddings";
import { findSimilarLineItems } from "@/lib/cost-intelligence/queries";
import { PlanLimitError } from "@/lib/claude";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const COMMITTER_ROLES = new Set(["owner", "admin", "pm", "accounting"]);
const ITEM_SIMILARITY_THRESHOLD = 0.85;

// ─────────────────────────────────────────────────────────────────
// Body shape
// ─────────────────────────────────────────────────────────────────

type CostCodePickInput =
  | { kind: "none" }
  | { kind: "org"; org_cost_code_id: string; code: string; name: string }
  | {
      kind: "legacy";
      cost_code_id: string;
      code: string;
      description: string;
    }
  | {
      kind: "pending";
      suggestion_id: string;
      suggested_code: string;
      suggested_name: string;
    };

interface LineInput {
  line_number: number;
  description: string;
  description_normalized: string | null;
  quantity: number | null;
  unit_of_measure: string | null;
  unit_price_cents: number | null;
  total_price_cents: number;
  cost_code_pick: CostCodePickInput;
  ai_cost_code_suggestion: string | null;
  material_cost_cents: number | null;
  labor_cost_cents: number | null;
  subcontract_cost_cents: number | null;
  tax_cents: number | null;
  delivery_cents: number | null;
  notes_cents: number | null;
  attributes: Record<string, unknown>;
}

interface FeeScheduleInput {
  rate_type: string;
  description: string | null;
  rate_cents: number | null;
  unit: string | null;
}

interface PaymentScheduleInput {
  milestone: string;
  percentage_pct: number | null;
  amount_cents: number | null;
  trigger: string | null;
}

interface PaymentTermsInput {
  net_days: number | null;
  late_interest_rate_pct: number | null;
  governing_law: string | null;
  other_terms_text: string | null;
}

interface FormInput {
  vendor_id: string;
  vendor_name: string;
  vendor_address: string | null;
  job_id: string;
  proposal_number: string | null;
  proposal_date: string | null;
  valid_through: string | null;
  title: string;
  total_cents: number;
  scope_summary: string;
  inclusions: string | null;
  exclusions: string | null;
  notes: string | null;
  vendor_stated_start_date: string | null;
  vendor_stated_duration_days: number | null;
  // Phase 3.4 Step 5b/5c — structured fee + payment schedule + terms
  additional_fee_schedule: FeeScheduleInput[] | null;
  payment_schedule: PaymentScheduleInput[] | null;
  payment_terms: PaymentTermsInput | null;
  line_items: LineInput[];
  raw_extraction: unknown;
  ai_confidence: number;
  ai_confidence_details: Record<string, number>;
  flags: string[];
}

interface CommitBody {
  extraction_id?: string;
  form?: FormInput;
}

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

const UOM_TO_UNIT: Record<string, string> = {
  EA: "each",
  EACH: "each",
  PC: "each",
  PCS: "each",
  SF: "sf",
  SQFT: "sf",
  LF: "lf",
  LNFT: "lf",
  SY: "sy",
  CY: "cy",
  LB: "lb",
  GAL: "gal",
  HR: "hr",
  HOUR: "hr",
  DAY: "day",
  LOT: "lump_sum",
  LS: "lump_sum",
  PKG: "pkg",
  BOX: "box",
};

const ITEMS_UNIT_VALUES = new Set([
  "each",
  "sf",
  "lf",
  "sy",
  "cy",
  "lb",
  "gal",
  "hr",
  "day",
  "lump_sum",
  "pkg",
  "box",
]);

function normalizeUnit(uom: string | null | undefined): string {
  if (!uom) return "lump_sum";
  const upper = uom.trim().toUpperCase();
  const mapped = UOM_TO_UNIT[upper];
  if (mapped) return mapped;
  const lower = uom.trim().toLowerCase();
  if (ITEMS_UNIT_VALUES.has(lower)) return lower;
  return "lump_sum";
}

function inferItemType(suggestion: string | null | undefined): string {
  if (!suggestion) return "other";
  const lower = suggestion.toLowerCase();
  if (lower.includes("labor")) return "labor";
  if (lower.includes("material")) return "material";
  if (lower.includes("subcontract") || lower.includes(" sub ")) return "subcontract";
  if (lower.includes("equipment") || lower.includes("rental")) return "equipment";
  if (lower.includes("service")) return "service";
  return "other";
}

interface RawAIProposalLine {
  line_number?: number;
  description?: string;
  description_normalized?: string | null;
  quantity?: number | null;
  unit_of_measure?: string | null;
  unit_price_cents?: number | null;
  total_price_cents?: number;
  cost_code_suggestion?: string | null;
  material_cost_cents?: number | null;
  labor_cost_cents?: number | null;
  subcontract_cost_cents?: number | null;
  tax_cents?: number | null;
  delivery_cents?: number | null;
  notes_cents?: number | null;
  attributes?: Record<string, unknown>;
}

interface RawAIExtraction {
  line_items?: RawAIProposalLine[];
}

/**
 * Compute the diff between AI's original extracted line and the PM's
 * edited form. Stored in proposal_line_items.pm_edits JSONB so the
 * cost intelligence layer can learn which fields PMs commonly correct.
 */
function computeLinePmEdits(
  ai: RawAIProposalLine | undefined,
  form: LineInput
): Record<string, { ai: unknown; pm: unknown }> | null {
  if (!ai) return null;
  const diff: Record<string, { ai: unknown; pm: unknown }> = {};
  const fields: Array<keyof LineInput & keyof RawAIProposalLine> = [
    "description",
    "description_normalized",
    "quantity",
    "unit_of_measure",
    "unit_price_cents",
    "total_price_cents",
    "material_cost_cents",
    "labor_cost_cents",
    "subcontract_cost_cents",
    "tax_cents",
    "delivery_cents",
    "notes_cents",
  ];
  for (const f of fields) {
    if (ai[f] !== form[f]) {
      diff[f] = { ai: ai[f] ?? null, pm: form[f] ?? null };
    }
  }
  return Object.keys(diff).length > 0 ? diff : null;
}

interface ResolvedCostCodeIds {
  org_cost_code_id: string | null;
  cost_code_id: string | null;
  pending_suggestion_id: string | null;
}

/**
 * Resolve a CostCodePickInput into the dual-write FK ids per
 * clarification 3. For 'legacy' picks, find or service-create a
 * matching org_cost_codes row so cost intelligence wiring can attach.
 */
async function resolvePick(
  pick: CostCodePickInput,
  supabase: SupabaseClient,
  service: SupabaseClient | null,
  orgId: string,
  userId: string
): Promise<ResolvedCostCodeIds> {
  switch (pick.kind) {
    case "none":
      return { org_cost_code_id: null, cost_code_id: null, pending_suggestion_id: null };

    case "org":
      return {
        org_cost_code_id: pick.org_cost_code_id,
        cost_code_id: null,
        pending_suggestion_id: null,
      };

    case "pending":
      return {
        org_cost_code_id: null,
        cost_code_id: null,
        pending_suggestion_id: pick.suggestion_id,
      };

    case "legacy": {
      // Always write the legacy cost_code_id for backward compat.
      // ALSO try to find or service-create a matching org_cost_codes
      // row for cost-intelligence wiring.
      const { data: existing } = await supabase
        .from("org_cost_codes")
        .select("id")
        .eq("org_id", orgId)
        .eq("code", pick.code)
        .eq("is_active", true)
        .maybeSingle();

      if (existing) {
        return {
          org_cost_code_id: existing.id as string,
          cost_code_id: pick.cost_code_id,
          pending_suggestion_id: null,
        };
      }

      // Auto-create via service role (RLS gates INSERT to owner/admin).
      if (!service) {
        // No service role available — leave org_cost_code_id NULL but
        // still write the legacy cost_code_id. Cost intel layer will
        // miss this line until owner manually promotes the legacy code.
        return {
          org_cost_code_id: null,
          cost_code_id: pick.cost_code_id,
          pending_suggestion_id: null,
        };
      }

      const { data: created, error } = await service
        .from("org_cost_codes")
        .insert({
          org_id: orgId,
          code: pick.code,
          name: pick.description,
          is_active: true,
          created_by: userId,
        })
        .select("id")
        .single();

      if (error || !created) {
        console.error(
          "[proposals/commit] auto-create org_cost_codes from legacy failed:",
          error?.message
        );
        return {
          org_cost_code_id: null,
          cost_code_id: pick.cost_code_id,
          pending_suggestion_id: null,
        };
      }

      return {
        org_cost_code_id: created.id as string,
        cost_code_id: pick.cost_code_id,
        pending_suggestion_id: null,
      };
    }
  }
}

// ─────────────────────────────────────────────────────────────────
// Route handler
// ─────────────────────────────────────────────────────────────────

export const POST = withApiError(async (request: NextRequest) => {
  const membership = await getCurrentMembership();
  if (!membership) throw new ApiError("Not authenticated", 401);
  if (!COMMITTER_ROLES.has(membership.role)) {
    throw new ApiError(
      `Role ${membership.role} cannot commit proposals (allowed: owner, admin, pm, accounting)`,
      403
    );
  }

  const body = (await request.json().catch(() => null)) as CommitBody | null;
  const extraction_id = body?.extraction_id;
  const form = body?.form;
  if (!extraction_id) throw new ApiError("Missing extraction_id", 400);
  if (!form) throw new ApiError("Missing form", 400);
  if (!form.vendor_id) throw new ApiError("Missing form.vendor_id", 400);
  if (!form.job_id) throw new ApiError("Missing form.job_id", 400);
  if (typeof form.title !== "string" || form.title.length === 0) {
    throw new ApiError("Missing form.title", 400);
  }
  if (!Array.isArray(form.line_items) || form.line_items.length === 0) {
    throw new ApiError("Form must include at least one line item", 400);
  }

  const supabase = createServerClient();
  const service = tryCreateServiceRoleClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new ApiError("Auth user lookup failed", 401);

  // Load + validate extraction row.
  const { data: extraction, error: extractionError } = await supabase
    .from("document_extractions")
    .select("id, classified_type, target_entity_type, target_entity_id, deleted_at")
    .eq("id", extraction_id)
    .eq("org_id", membership.org_id)
    .is("deleted_at", null)
    .maybeSingle();
  if (extractionError || !extraction) {
    throw new ApiError("Extraction not found", 404);
  }
  if (extraction.classified_type !== "proposal") {
    throw new ApiError(
      `Extraction is classified ${extraction.classified_type ?? "unknown"}, not proposal`,
      409
    );
  }
  if (extraction.target_entity_id) {
    throw new ApiError("Extraction has already been committed", 409);
  }

  // Pre-resolve cost-code picks for every line. Sequential so a single
  // legacy auto-create failure doesn't leave the rest of the lines in
  // a half-resolved state.
  const resolvedPicks: ResolvedCostCodeIds[] = [];
  for (const line of form.line_items) {
    resolvedPicks.push(
      await resolvePick(
        line.cost_code_pick,
        supabase,
        service,
        membership.org_id,
        user.id
      )
    );
  }

  // Build proposal insert payload. Maps to the existing proposals
  // schema (legacy + Phase 3.4 columns from migration 00087):
  //   - amount BIGINT (legacy column, NULLable) ← form.total_cents
  //   - title NOT NULL ← form.title
  //   - status text CHECK includes 'accepted' ← 'accepted'
  //   - status_history JSONB NOT NULL DEFAULT '[]' ← initial entry
  const nowIso = new Date().toISOString();
  const initialHistoryEntry = {
    at: nowIso,
    who: user.id,
    status: "accepted",
    source: "ui:review-form",
  };

  const { data: newProposal, error: proposalError } = await supabase
    .from("proposals")
    .insert({
      org_id: membership.org_id,
      job_id: form.job_id,
      vendor_id: form.vendor_id,
      source_document_id: extraction_id,
      proposal_number: form.proposal_number,
      title: form.title,
      proposal_date: form.proposal_date,
      valid_through: form.valid_through,
      status: "accepted",
      amount: form.total_cents,
      scope_summary: form.scope_summary,
      inclusions: form.inclusions,
      exclusions: form.exclusions,
      notes: form.notes,
      vendor_stated_start_date: form.vendor_stated_start_date,
      vendor_stated_duration_days: form.vendor_stated_duration_days,
      // Phase 3.4 Step 5b/5c — structured fee + payment schedule + terms.
      // Each is null when the proposal didn't include the structure;
      // never inferred. Persisted directly as JSONB.
      additional_fee_schedule: form.additional_fee_schedule,
      payment_schedule: form.payment_schedule,
      payment_terms: form.payment_terms,
      raw_extraction: form.raw_extraction ?? {},
      extraction_confidence: form.ai_confidence,
      status_history: [initialHistoryEntry],
      created_by: user.id,
    })
    .select("id")
    .single();

  if (proposalError || !newProposal) {
    console.error("[proposals/commit] proposal insert failed:", proposalError?.message);
    throw new ApiError(
      `Failed to create proposal: ${proposalError?.message ?? "no row returned"}`,
      500
    );
  }
  const proposalId = newProposal.id as string;

  // Helper to roll back the proposal on any downstream failure. Soft-
  // delete keeps the audit trail; the row is visible to platform admins
  // for forensics.
  const rollback = async (cause: string) => {
    await supabase
      .from("proposals")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", proposalId)
      .eq("org_id", membership.org_id);
    console.error(`[proposals/commit] rolled back proposal ${proposalId}: ${cause}`);
  };

  // Build line-item insert payloads.
  const rawAi = (form.raw_extraction ?? {}) as RawAIExtraction;
  const linePayloads = form.line_items.map((line, idx) => {
    const resolved = resolvedPicks[idx];
    const aiLine = rawAi.line_items?.[idx];
    const pmEdits = computeLinePmEdits(aiLine, line);
    return {
      proposal_id: proposalId,
      org_id: membership.org_id,
      sort_order: line.line_number,
      description: line.description,
      quantity: line.quantity,
      unit: line.unit_of_measure,
      unit_price: line.unit_price_cents,
      amount: line.total_price_cents,
      cost_code_id: resolved.cost_code_id,
      org_cost_code_id: resolved.org_cost_code_id,
      description_normalized: line.description_normalized,
      material_cost_cents: line.material_cost_cents,
      labor_cost_cents: line.labor_cost_cents,
      subcontract_cost_cents: line.subcontract_cost_cents,
      tax_cents: line.tax_cents,
      delivery_cents: line.delivery_cents,
      notes_cents: line.notes_cents,
      attributes: line.attributes ?? {},
      extraction_confidence: form.ai_confidence,
      pm_edited: pmEdits !== null,
      pm_edits: pmEdits,
      created_by: user.id,
    };
  });

  const { data: insertedLines, error: linesError } = await supabase
    .from("proposal_line_items")
    .insert(linePayloads)
    .select("id, sort_order, description, description_normalized, attributes, unit");

  if (linesError || !insertedLines) {
    await rollback(`line items insert failed: ${linesError?.message}`);
    throw new ApiError(
      `Failed to insert line items: ${linesError?.message ?? "no rows returned"}`,
      500
    );
  }

  // Cost intelligence wiring (NARROW per locked decision):
  //   For each line, find similar canonical items (cosine ≥ 0.85);
  //   if found, attach + bump occurrence_count; else create new
  //   items row with embedding inline.
  // Errors here do NOT roll back the proposal — cost-intel wiring is
  // best-effort. A failed wire just leaves the line's item_id NULL.
  let new_items_created = 0;
  let items_matched = 0;
  for (let i = 0; i < insertedLines.length; i++) {
    const lineRow = insertedLines[i];
    const formLine = form.line_items[i];
    const embedText =
      lineRow.description_normalized?.trim() || lineRow.description.trim();
    if (!embedText) continue;

    try {
      const matches = await findSimilarLineItems(
        supabase,
        membership.org_id,
        embedText,
        3
      );
      const top = matches[0];
      if (top && top.similarity >= ITEM_SIMILARITY_THRESHOLD) {
        // Match found — attach existing item + bump occurrence_count.
        await supabase
          .from("proposal_line_items")
          .update({ item_id: top.canonical_item.id })
          .eq("id", lineRow.id)
          .eq("org_id", membership.org_id);
        items_matched++;
        // occurrence_count bump uses service role (RLS may not allow
        // PMs to UPDATE items). Best-effort.
        if (service) {
          await service.rpc("increment_item_occurrence", {
            p_item_id: top.canonical_item.id,
          }).then(() => null, async () => {
            // If RPC doesn't exist, fall back to a +1 update via service.
            const { data: cur } = await service
              .from("items")
              .select("occurrence_count")
              .eq("id", top.canonical_item.id)
              .maybeSingle();
            if (cur && typeof cur.occurrence_count === "number") {
              await service
                .from("items")
                .update({ occurrence_count: (cur.occurrence_count as number) + 1 })
                .eq("id", top.canonical_item.id);
            }
          });
        }
      } else {
        // No match — create a new items row with embedding inline.
        const itemUnit = normalizeUnit(formLine.unit_of_measure);
        const itemType = inferItemType(formLine.ai_cost_code_suggestion);
        const embedding = await generateEmbedding(embedText, {
          org_id: membership.org_id,
          user_id: user.id,
          metadata: {
            source: "proposals/commit",
            proposal_id: proposalId,
            line_item_id: lineRow.id,
          },
        });
        // Use service role for the items INSERT so we don't depend on
        // PM having items-write RLS access. The items registry is shared
        // org infrastructure; auto-population from a PM-driven commit is
        // a system-level mirroring action.
        const insertClient = service ?? supabase;
        const { data: newItem, error: itemError } = await insertClient
          .from("items")
          .insert({
            org_id: membership.org_id,
            canonical_name: embedText,
            description: lineRow.description,
            item_type: itemType,
            unit: itemUnit,
            canonical_unit: itemUnit,
            specs: lineRow.attributes ?? {},
            ai_confidence: form.ai_confidence,
            first_seen_source: "proposal_extract",
            embedding: vectorLiteral(embedding),
            occurrence_count: 1,
            created_by: user.id,
          })
          .select("id")
          .single();
        if (newItem && !itemError) {
          await supabase
            .from("proposal_line_items")
            .update({ item_id: newItem.id })
            .eq("id", lineRow.id)
            .eq("org_id", membership.org_id);
          new_items_created++;
        } else {
          console.error(
            `[proposals/commit] items insert failed for line ${lineRow.id}: ${itemError?.message}`
          );
        }
      }
    } catch (err) {
      if (err instanceof PlanLimitError) {
        // Exhausted plan limits mid-wiring — abort cost intel for the
        // remaining lines but don't roll back the proposal. The proposal
        // is saved; just no embedding for the remaining lines.
        console.error(
          "[proposals/commit] plan limit hit during cost-intel wiring; remaining lines skipped"
        );
        break;
      }
      console.error(
        `[proposals/commit] cost-intel wiring failed for line ${lineRow.id}:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  // Back-link any pending cost-code suggestions used in this commit so
  // owner/admin queue can show "used on proposal X line Y".
  for (let i = 0; i < form.line_items.length; i++) {
    const sugId = resolvedPicks[i].pending_suggestion_id;
    if (!sugId) continue;
    const lineId = insertedLines[i]?.id;
    if (!lineId) continue;
    await supabase
      .from("pending_cost_code_suggestions")
      .update({ source_proposal_line_item_id: lineId })
      .eq("id", sugId)
      .eq("org_id", membership.org_id)
      .eq("status", "pending");
  }

  // Update document_extractions.target_entity_id → proposalId.
  const { error: targetError } = await supabase
    .from("document_extractions")
    .update({
      target_entity_id: proposalId,
      verification_status: "verified",
      verified_by: user.id,
      verified_at: nowIso,
    })
    .eq("id", extraction_id)
    .eq("org_id", membership.org_id);

  if (targetError) {
    // Proposal already exists; manual cleanup may be needed. Log + 500
    // so the operator sees it.
    console.error(
      "[proposals/commit] target_entity_id update failed:",
      targetError.message
    );
    return NextResponse.json(
      {
        proposal_id: proposalId,
        line_items_count: insertedLines.length,
        new_items_created,
        items_matched,
        warning: `target_entity_id update failed: ${targetError.message}. Proposal exists; manual reconciliation needed.`,
      },
      { status: 200 }
    );
  }

  return NextResponse.json({
    proposal_id: proposalId,
    line_items_count: insertedLines.length,
    new_items_created,
    items_matched,
  });
});
