/**
 * Backfill the cost intelligence spine from existing invoices.
 *
 * For every invoice in the selected orgs that does NOT yet have an
 * invoice_extractions row:
 *   1. Run extractInvoice(invoiceId) against the DEV Supabase.
 *   2. Extraction stages each line + runs the tiered matcher. High-confidence
 *      lines are left as 'pending' (NOT auto-committed) so a human can
 *      review them in the verification queue before they enter the spine.
 *      Exception: alias matches at >= 0.98 confidence are auto-committed
 *      because the alias library already represents a prior verified match.
 *   3. Throttle to max 5 concurrent extractions — each extraction fires 1
 *      Claude API call per line beyond alias/trigram matches.
 *
 * Idempotent: re-running skips invoices that already have an extraction row.
 *
 * Usage: npx tsx scripts/backfill-cost-intelligence.ts
 */

import path from "node:path";
import * as dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { extractInvoice } from "@/lib/cost-intelligence/extract-invoice";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Only target these jobs for Wave 1A. Fish + Dewberry are our reference data.
const TARGET_JOB_NAMES = ["Fish Residence", "Dewberry Residence"];

interface InvoiceRow {
  id: string;
  org_id: string;
  vendor_id: string | null;
  invoice_number: string | null;
  job_id: string | null;
}

interface Report {
  invoices_processed: number;
  invoices_skipped_existing: number;
  invoices_failed: number;
  lines_staged: number;
  lines_auto_committed: number;
  lines_pending: number;
  items_created: number;
  items_matched_existing: number;
  pricing_rows_committed: number;
  aliases_created: number;
  match_tier_breakdown: Record<string, number>;
  confidence_distribution: Record<string, number>;
}

async function main() {
  console.log("============================================================");
  console.log("Cost Intelligence backfill — Fish + Dewberry");
  console.log("============================================================");

  // 1. Find target jobs
  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, name, org_id")
    .in("name", TARGET_JOB_NAMES)
    .is("deleted_at", null);

  if (!jobs || jobs.length === 0) {
    console.error("No target jobs found. Aborting.");
    process.exit(1);
  }

  console.log(`Found ${jobs.length} jobs: ${jobs.map((j) => j.name).join(", ")}`);

  const jobIds = jobs.map((j) => j.id);

  // 2. Count baseline metrics
  const baselineItems = await countItems();
  const baselineVip = await countVip();
  const baselineAliases = await countAliases();

  console.log(`Baseline: items=${baselineItems}, pricing=${baselineVip}, aliases=${baselineAliases}`);

  // 3. Find invoices to process
  const { data: allInvoices, error: invErr } = await supabase
    .from("invoices")
    .select("id, org_id, vendor_id, invoice_number, job_id")
    .in("job_id", jobIds)
    .is("deleted_at", null);

  if (invErr || !allInvoices) {
    console.error("Failed to load invoices:", invErr?.message);
    process.exit(1);
  }

  console.log(`Total candidate invoices: ${allInvoices.length}`);

  // 4. Filter out invoices that already have extractions
  const { data: existingExtractions } = await supabase
    .from("invoice_extractions")
    .select("invoice_id")
    .is("deleted_at", null);

  const extractedIds = new Set(
    (existingExtractions ?? []).map((e) => (e as { invoice_id: string }).invoice_id)
  );

  const toProcess = (allInvoices as InvoiceRow[]).filter((inv) => !extractedIds.has(inv.id));
  const skipped = allInvoices.length - toProcess.length;

  console.log(`To process: ${toProcess.length}, already extracted: ${skipped}`);

  if (toProcess.length === 0) {
    console.log("Nothing to do — all target invoices already extracted.");
    return;
  }

  // 5. Build report accumulator
  const report: Report = {
    invoices_processed: 0,
    invoices_skipped_existing: skipped,
    invoices_failed: 0,
    lines_staged: 0,
    lines_auto_committed: 0,
    lines_pending: 0,
    items_created: 0,
    items_matched_existing: 0,
    pricing_rows_committed: 0,
    aliases_created: 0,
    match_tier_breakdown: {},
    confidence_distribution: { high: 0, medium: 0, low: 0 },
  };

  // 6. Throttled processing (5 concurrent)
  const CONCURRENCY = 5;
  const queue = toProcess.slice();
  const workers: Promise<void>[] = [];

  async function worker() {
    while (queue.length > 0) {
      const inv = queue.shift();
      if (!inv) break;
      try {
        console.log(`  ⟶ ${inv.invoice_number ?? inv.id.slice(0, 8)} (org ${inv.org_id.slice(0, 8)})`);
        const r = await extractInvoice(supabase, inv.id, { triggeredBy: null });
        report.invoices_processed++;
        report.lines_staged += r.lines_staged;
        report.lines_auto_committed += r.lines_auto_committed;
        report.lines_pending += r.lines_pending;
        report.items_matched_existing += r.matched_existing_items;
        for (const [tier, count] of Object.entries(r.match_tier_breakdown)) {
          report.match_tier_breakdown[tier] = (report.match_tier_breakdown[tier] ?? 0) + count;
        }
        console.log(
          `    ok · ${r.lines_staged} lines (${r.matched_existing_items} matched, ${r.new_items_proposed} new)`
        );
      } catch (err) {
        report.invoices_failed++;
        console.warn(
          `    fail · ${inv.id} · ${err instanceof Error ? err.message : err}`
        );
      }
    }
  }

  for (let i = 0; i < CONCURRENCY; i++) workers.push(worker());
  await Promise.all(workers);

  // 7. Compute post-metrics
  const endItems = await countItems();
  const endVip = await countVip();
  const endAliases = await countAliases();

  report.items_created = endItems - baselineItems;
  report.pricing_rows_committed = endVip - baselineVip;
  report.aliases_created = endAliases - baselineAliases;

  // 8. Confidence distribution of all pending/auto-committed lines we just staged
  const { data: lines } = await supabase
    .from("invoice_extraction_lines")
    .select("match_confidence")
    .in("extraction_id", await extractionIdsForInvoices(toProcess.map((i) => i.id)))
    .is("deleted_at", null);

  for (const l of (lines ?? []) as Array<{ match_confidence: number | null }>) {
    const c = l.match_confidence ?? 0;
    if (c >= 0.85) report.confidence_distribution.high++;
    else if (c >= 0.7) report.confidence_distribution.medium++;
    else report.confidence_distribution.low++;
  }

  // 9. Print the report
  console.log("\n============================================================");
  console.log("BACKFILL REPORT");
  console.log("============================================================");
  console.log(`Invoices processed:          ${report.invoices_processed}`);
  console.log(`Invoices skipped (already):  ${report.invoices_skipped_existing}`);
  console.log(`Invoices failed:             ${report.invoices_failed}`);
  console.log(`Lines staged:                ${report.lines_staged}`);
  console.log(`  auto-committed:            ${report.lines_auto_committed}`);
  console.log(`  pending verification:      ${report.lines_pending}`);
  console.log(`Items created (net):         ${report.items_created}`);
  console.log(`Items matched existing:      ${report.items_matched_existing}`);
  console.log(`Spine pricing rows (net):    ${report.pricing_rows_committed}`);
  console.log(`Aliases created (net):       ${report.aliases_created}`);
  console.log("\nMatch tier breakdown:");
  for (const [tier, count] of Object.entries(report.match_tier_breakdown)) {
    console.log(`  ${tier.padEnd(24)} ${count}`);
  }
  console.log("\nConfidence distribution:");
  for (const [bucket, count] of Object.entries(report.confidence_distribution)) {
    console.log(`  ${bucket.padEnd(24)} ${count}`);
  }

  console.log("\nAPI spend estimate: look at api_usage table for today's function_type='item_match' rows.");
  const { data: usage } = await supabase
    .from("api_usage")
    .select("cost_cents, total_tokens")
    .eq("function_type", "item_match")
    .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());
  if (usage && usage.length > 0) {
    const totalCents = (usage as Array<{ cost_cents: number | null; total_tokens: number | null }>).reduce(
      (s, r) => s + (r.cost_cents ?? 0),
      0
    );
    const totalTokens = (usage as Array<{ cost_cents: number | null; total_tokens: number | null }>).reduce(
      (s, r) => s + (r.total_tokens ?? 0),
      0
    );
    console.log(`Claude API spend last hour (item_match): $${(totalCents / 100).toFixed(4)} · ${totalTokens} tokens`);
  }

  console.log("\nBackfill complete.");
}

async function countItems(): Promise<number> {
  const { count } = await supabase
    .from("items")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null);
  return count ?? 0;
}

async function countVip(): Promise<number> {
  const { count } = await supabase
    .from("vendor_item_pricing")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null);
  return count ?? 0;
}

async function countAliases(): Promise<number> {
  const { count } = await supabase
    .from("item_aliases")
    .select("id", { count: "exact", head: true });
  return count ?? 0;
}

async function extractionIdsForInvoices(invoiceIds: string[]): Promise<string[]> {
  if (invoiceIds.length === 0) return [];
  const { data } = await supabase
    .from("invoice_extractions")
    .select("id")
    .in("invoice_id", invoiceIds)
    .is("deleted_at", null);
  return (data ?? []).map((r) => (r as { id: string }).id);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Backfill failed:", err);
    process.exit(1);
  });
