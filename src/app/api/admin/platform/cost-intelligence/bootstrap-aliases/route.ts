import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { tryCreateServiceRoleClient } from "@/lib/supabase/service";
import { ApiError, withApiError } from "@/lib/api/errors";
import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { commitLineToSpine } from "@/lib/cost-intelligence/commit-line-to-spine";

export const dynamic = "force-dynamic";

interface BootstrapBody {
  org_id?: string;
  dry_run?: boolean;
  confidence_min?: number;
}

/**
 * POST /api/admin/platform/cost-intelligence/bootstrap-aliases
 *
 * Seeds a tenant's alias library by bulk-committing qualifying
 * `ai_new_item` pending extraction lines to the spine. This unblocks
 * Tier 1/2 matching on future invoices without requiring a human to
 * click through hundreds of proposals one at a time.
 *
 * Eligibility filter (ALL must hold):
 *   - verification_status = 'pending'
 *   - is_transaction_line = false
 *   - is_allocated_overhead = false
 *   - match_tier = 'ai_new_item'
 *   - proposed_item_data IS NOT NULL
 *   - LENGTH(raw_description) >= 4
 *   - classification_confidence >= confidence_min (default 0.3)
 *
 * Body:
 *   { org_id: string, dry_run: boolean, confidence_min?: number }
 *
 * Dry run returns:
 *   { eligible_count, would_commit_count, sample: 20 rows, confidence_distribution }
 *
 * Execute returns:
 *   { eligible_count, committed, failed, errors: string[] }
 */
export const POST = withApiError(async (req: NextRequest) => {
  await requirePlatformAdmin();

  let body: BootstrapBody = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  if (!body.org_id) throw new ApiError("org_id required", 400);
  const orgId = body.org_id;
  const dryRun = Boolean(body.dry_run);
  const confidenceMin =
    typeof body.confidence_min === "number" && body.confidence_min >= 0 && body.confidence_min <= 1
      ? body.confidence_min
      : 0.3;

  // Prefer service-role for the query/commit side — bootstrap is an
  // admin tool that needs to write across orgs, but we fall back to SSR
  // client (with platform-admin RLS bypass) if service role isn't set.
  const service = tryCreateServiceRoleClient();
  const supabase = service ?? createServerClient();

  const { data: eligibleRows, error: selErr } = await supabase
    .from("document_extraction_lines")
    .select(
      "id, raw_description, match_tier, classification_confidence, match_confidence, proposed_item_data, created_at"
    )
    .eq("org_id", orgId)
    .eq("verification_status", "pending")
    .eq("is_allocated_overhead", false)
    .eq("is_transaction_line", false)
    .eq("match_tier", "ai_new_item")
    .gte("classification_confidence", confidenceMin)
    .not("proposed_item_data", "is", null)
    .order("classification_confidence", { ascending: false })
    .limit(10_000);

  if (selErr) throw new ApiError(selErr.message, 500);

  // Additional filter: raw_description length >= 4. Postgres doesn't
  // support LENGTH filters nicely over the REST API so we do it here.
  type Row = {
    id: string;
    raw_description: string;
    match_tier: string | null;
    classification_confidence: number | null;
    match_confidence: number | null;
    proposed_item_data: { canonical_name?: string; item_type?: string; unit?: string } | null;
    created_at: string;
  };
  const all = ((eligibleRows ?? []) as Row[]).filter(
    (r) => (r.raw_description ?? "").trim().length >= 4
  );

  if (dryRun) {
    const sample = all.slice(0, 20).map((r) => ({
      id: r.id,
      raw_description: r.raw_description,
      proposed_canonical_name: r.proposed_item_data?.canonical_name ?? null,
      proposed_type: r.proposed_item_data?.item_type ?? null,
      proposed_unit: r.proposed_item_data?.unit ?? null,
      classification_confidence: r.classification_confidence,
    }));

    const buckets = { high: 0, med: 0, low: 0 };
    for (const r of all) {
      const c = r.classification_confidence ?? 0;
      if (c >= 0.7) buckets.high++;
      else if (c >= 0.5) buckets.med++;
      else buckets.low++;
    }

    return NextResponse.json({
      dry_run: true,
      confidence_min: confidenceMin,
      eligible_count: all.length,
      would_commit_count: all.length,
      confidence_distribution: buckets,
      sample,
    });
  }

  // Execute: commit each qualifying line.
  let committed = 0;
  const errors: string[] = [];
  for (const row of all) {
    try {
      await commitLineToSpine(supabase, row.id, {
        verifiedBy: null,
        newStatus: "auto_committed",
      });
      committed++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`line ${row.id}: ${msg}`);
    }
  }

  return NextResponse.json({
    dry_run: false,
    confidence_min: confidenceMin,
    eligible_count: all.length,
    committed,
    failed: errors.length,
    errors: errors.slice(0, 50),
  });
});
