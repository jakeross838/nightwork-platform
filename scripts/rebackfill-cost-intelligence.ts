/**
 * Re-backfill the cost intelligence spine with the Wave 1B pipeline.
 *
 * Wave 1A staged 108 lines without tax / overhead separation. We now have
 * a pipeline that captures invoice tax + allocates delivery/freight
 * proportionally, plus auto-commit for deterministic matches. This
 * script wipes the Fish + Dewberry staging + spine rows (soft-delete)
 * and re-runs extraction under the new rules.
 *
 * Why "simpler approach" (per the plan): backfill data is not production-
 * critical. Deleting + re-running is cleaner than trying to migrate
 * existing rows in place, because we don't have the original AI context
 * (subtotal, tax, overhead breakdown) to reconstruct after the fact
 * — we pull it fresh from invoices.ai_raw_response.
 *
 * Usage: npx tsx scripts/rebackfill-cost-intelligence.ts
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

const TARGET_JOB_NAMES = ["Fish Residence", "Dewberry Residence"];

interface Report {
  invoices_processed: number;
  invoices_failed: number;
  lines_staged: number;
  lines_auto_committed: number;
  lines_pending: number;
  lines_overhead_allocated: number;
  items_created_net: number;
  items_matched_existing: number;
  vip_rows_net: number;
  aliases_created_net: number;
  match_tier_breakdown: Record<string, number>;
  confidence_distribution: Record<string, number>;
  invoices_with_tax: number;
  invoices_with_overhead: number;
  total_tax_cents: number;
  total_overhead_cents: number;
}

async function main() {
  console.log("============================================================");
  console.log("Cost Intelligence RE-BACKFILL — Fish + Dewberry (Wave 1B)");
  console.log("============================================================");

  // 1. Target jobs + invoices
  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, name, org_id")
    .in("name", TARGET_JOB_NAMES)
    .is("deleted_at", null);

  if (!jobs || jobs.length === 0) {
    console.error("No target jobs found. Aborting.");
    process.exit(1);
  }
  console.log(`Target jobs: ${jobs.map((j) => j.name).join(", ")}`);

  const jobIds = jobs.map((j) => j.id);

  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, invoice_number, vendor_id, total_amount")
    .in("job_id", jobIds)
    .is("deleted_at", null);

  if (!invoices || invoices.length === 0) {
    console.log("No invoices to process.");
    return;
  }
  console.log(`Invoices to process: ${invoices.length}`);

  const invoiceIds = invoices.map((i) => i.id);

  // 2. Wipe existing extraction data + spine rows for these invoices
  console.log("\n— Wiping existing Fish+Dewberry extraction data —");

  // existing extraction row ids
  const { data: oldExtractions } = await supabase
    .from("document_extractions")
    .select("id")
    .in("invoice_id", invoiceIds);

  const oldExtractionIds = (oldExtractions ?? []).map((r) => r.id);

  if (oldExtractionIds.length > 0) {
    // lines first
    const nowIso = new Date().toISOString();
    const { count: deletedLines } = await supabase
      .from("document_extraction_lines")
      .update({ deleted_at: nowIso }, { count: "exact" })
      .in("extraction_id", oldExtractionIds)
      .is("deleted_at", null);
    console.log(`  soft-deleted ${deletedLines ?? 0} extraction_lines`);

    const { count: deletedRoots } = await supabase
      .from("document_extractions")
      .update({ deleted_at: nowIso }, { count: "exact" })
      .in("id", oldExtractionIds)
      .is("deleted_at", null);
    console.log(`  soft-deleted ${deletedRoots ?? 0} document_extractions`);
  } else {
    console.log("  no prior extractions to wipe");
  }

  // soft-delete vendor_item_pricing rows sourced from these invoices
  const { count: deletedVip } = await supabase
    .from("vendor_item_pricing")
    .update({ deleted_at: new Date().toISOString() }, { count: "exact" })
    .eq("source_type", "invoice_line")
    .in("source_invoice_id", invoiceIds)
    .is("deleted_at", null);
  console.log(`  soft-deleted ${deletedVip ?? 0} vendor_item_pricing rows`);

  // 3. Baseline
  const baselineItems = await countItems();
  const baselineVip = await countVip();
  const baselineAliases = await countAliases();
  console.log(
    `\nBaseline: items=${baselineItems}, pricing=${baselineVip}, aliases=${baselineAliases}`
  );

  // 4. Re-extract, throttled
  const report: Report = {
    invoices_processed: 0,
    invoices_failed: 0,
    lines_staged: 0,
    lines_auto_committed: 0,
    lines_pending: 0,
    lines_overhead_allocated: 0,
    items_created_net: 0,
    items_matched_existing: 0,
    vip_rows_net: 0,
    aliases_created_net: 0,
    match_tier_breakdown: {},
    confidence_distribution: { high: 0, medium: 0, low: 0 },
    invoices_with_tax: 0,
    invoices_with_overhead: 0,
    total_tax_cents: 0,
    total_overhead_cents: 0,
  };

  const CONCURRENCY = 4;
  const queue = invoices.slice();
  const workers: Promise<void>[] = [];

  async function worker() {
    while (queue.length > 0) {
      const inv = queue.shift();
      if (!inv) break;
      try {
        process.stdout.write(
          `  ⟶ ${inv.invoice_number ?? inv.id.slice(0, 8)} ... `
        );
        const r = await extractInvoice(supabase, inv.id, {
          triggeredBy: null,
          reextract: true,
        });
        report.invoices_processed++;
        report.lines_staged += r.lines_staged;
        report.lines_auto_committed += r.lines_auto_committed;
        report.lines_pending += r.lines_pending;
        report.items_matched_existing += r.matched_existing_items;
        for (const [tier, count] of Object.entries(r.match_tier_breakdown)) {
          report.match_tier_breakdown[tier] =
            (report.match_tier_breakdown[tier] ?? 0) + count;
        }
        if (report.match_tier_breakdown["overhead_allocated"]) {
          report.lines_overhead_allocated = report.match_tier_breakdown["overhead_allocated"];
        }
        console.log(
          `ok · ${r.lines_staged} lines (${r.matched_existing_items} matched, ${r.new_items_proposed} new, ${r.lines_auto_committed} auto)`
        );
      } catch (err) {
        report.invoices_failed++;
        console.log(
          `FAIL · ${err instanceof Error ? err.message : err}`
        );
      }
    }
  }

  for (let i = 0; i < CONCURRENCY; i++) workers.push(worker());
  await Promise.all(workers);

  // 5. Post metrics
  const endItems = await countItems();
  const endVip = await countVip();
  const endAliases = await countAliases();
  report.items_created_net = endItems - baselineItems;
  report.vip_rows_net = endVip - baselineVip;
  report.aliases_created_net = endAliases - baselineAliases;

  // Confidence + tax/overhead aggregations from new data
  const { data: newExtractions } = await supabase
    .from("document_extractions")
    .select("id, invoice_tax_cents, invoice_overhead")
    .in("invoice_id", invoiceIds)
    .is("deleted_at", null);

  for (const ex of (newExtractions ?? []) as Array<{
    id: string;
    invoice_tax_cents: number;
    invoice_overhead: Array<{ amount_cents: number }>;
  }>) {
    if (ex.invoice_tax_cents > 0) {
      report.invoices_with_tax++;
      report.total_tax_cents += ex.invoice_tax_cents;
    }
    const oh = Array.isArray(ex.invoice_overhead) ? ex.invoice_overhead : [];
    const ohSum = oh.reduce((s, o) => s + (o.amount_cents ?? 0), 0);
    if (ohSum > 0) {
      report.invoices_with_overhead++;
      report.total_overhead_cents += ohSum;
    }
  }

  const newExtractionIds = (newExtractions ?? []).map((r) => r.id);
  if (newExtractionIds.length > 0) {
    const { data: lines } = await supabase
      .from("document_extraction_lines")
      .select("match_confidence")
      .in("extraction_id", newExtractionIds)
      .eq("is_allocated_overhead", false)
      .is("deleted_at", null);

    for (const l of (lines ?? []) as Array<{ match_confidence: number | null }>) {
      const c = l.match_confidence ?? 0;
      if (c >= 0.85) report.confidence_distribution.high++;
      else if (c >= 0.7) report.confidence_distribution.medium++;
      else report.confidence_distribution.low++;
    }
  }

  // 6. API spend from the last hour
  const { data: usage } = await supabase
    .from("api_usage")
    .select("cost_cents, total_tokens")
    .eq("function_type", "item_match")
    .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());

  const apiTotalCents = (usage ?? []).reduce(
    (s, r) => s + ((r as { cost_cents: number | null }).cost_cents ?? 0),
    0
  );
  const apiTotalTokens = (usage ?? []).reduce(
    (s, r) => s + ((r as { total_tokens: number | null }).total_tokens ?? 0),
    0
  );

  // 7. Print report
  console.log("\n============================================================");
  console.log("RE-BACKFILL REPORT");
  console.log("============================================================");
  console.log(`Invoices processed:          ${report.invoices_processed}`);
  console.log(`Invoices failed:             ${report.invoices_failed}`);
  console.log(`Lines staged (real):         ${report.lines_staged}`);
  console.log(`  auto-committed:            ${report.lines_auto_committed}`);
  console.log(`  pending verification:      ${report.lines_pending}`);
  console.log(`Overhead rows allocated:     ${report.lines_overhead_allocated}`);
  console.log(`Items created (net):         ${report.items_created_net}`);
  console.log(`Items matched existing:      ${report.items_matched_existing}`);
  console.log(`Spine pricing rows (net):    ${report.vip_rows_net}`);
  console.log(`Aliases created (net):       ${report.aliases_created_net}`);
  console.log(`Invoices with tax:           ${report.invoices_with_tax} ($${(report.total_tax_cents / 100).toFixed(2)})`);
  console.log(`Invoices with overhead:      ${report.invoices_with_overhead} ($${(report.total_overhead_cents / 100).toFixed(2)})`);
  console.log("\nMatch tier breakdown:");
  for (const [tier, count] of Object.entries(report.match_tier_breakdown)) {
    console.log(`  ${tier.padEnd(24)} ${count}`);
  }
  console.log("\nConfidence distribution (real lines):");
  for (const [bucket, count] of Object.entries(report.confidence_distribution)) {
    console.log(`  ${bucket.padEnd(24)} ${count}`);
  }
  console.log(
    `\nAnthropic API spend (last hour, item_match): $${(apiTotalCents / 100).toFixed(4)} · ${apiTotalTokens} tokens`
  );
  console.log("\nRe-backfill complete.");
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

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Re-backfill failed:", err);
    process.exit(1);
  });
