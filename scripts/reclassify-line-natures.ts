/**
 * Re-extract Ross Built invoices with the new line_nature + BOM pipeline.
 *
 * For every invoice tied to the reference jobs (Fish Residence + Dewberry
 * Residence):
 *   1. Call extractInvoice(..., { reextract: true }).
 *   2. extractInvoice soft-deletes old extraction_lines + components,
 *      resets invoice_extractions.skipped_lines, then runs the new
 *      three-phase pipeline (regex pre-filter → invoice-level classifier
 *      → per-line matcher) and writes BOM attachments with confidence
 *      tiering.
 *   3. Accumulate metrics into a final report.
 *
 * Throttled to 3 concurrent extractions — each invoice fires 1 classifier
 * call + N match calls. Most Ross Built invoices have 2-20 lines.
 *
 * Usage: npx tsx scripts/reclassify-line-natures.ts
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

interface InvoiceRow {
  id: string;
  org_id: string;
  invoice_number: string | null;
  job_id: string | null;
}

interface Report {
  invoices_processed: number;
  invoices_failed: number;
  lines_staged: number;
  lines_pending: number;
  lines_auto_committed: number;
  skipped_lines: number;
  bom_attachments_auto: number;
  bom_attachments_suggested: number;
  match_tier_breakdown: Record<string, number>;
  nature_distribution: Record<string, number>;
  review_tab_count: number;
}

async function main() {
  console.log("============================================================");
  console.log("Line nature + BOM re-extraction — Fish + Dewberry");
  console.log("============================================================");

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

  const { data: invoiceRows, error: invErr } = await supabase
    .from("invoices")
    .select("id, org_id, invoice_number, job_id")
    .in("job_id", jobIds)
    .is("deleted_at", null);

  if (invErr || !invoiceRows) {
    console.error("Failed to load invoices:", invErr?.message);
    process.exit(1);
  }

  const invoices = invoiceRows as InvoiceRow[];
  console.log(`Total invoices to re-extract: ${invoices.length}`);
  if (invoices.length === 0) {
    console.log("Nothing to do.");
    return;
  }

  const report: Report = {
    invoices_processed: 0,
    invoices_failed: 0,
    lines_staged: 0,
    lines_pending: 0,
    lines_auto_committed: 0,
    skipped_lines: 0,
    bom_attachments_auto: 0,
    bom_attachments_suggested: 0,
    match_tier_breakdown: {},
    nature_distribution: {},
    review_tab_count: 0,
  };

  const CONCURRENCY = 3;
  const queue = invoices.slice();

  async function worker() {
    while (queue.length > 0) {
      const inv = queue.shift();
      if (!inv) break;
      const label = inv.invoice_number ?? inv.id.slice(0, 8);
      try {
        console.log(`  ⟶ ${label} (org ${inv.org_id.slice(0, 8)})`);
        const r = await extractInvoice(supabase, inv.id, {
          reextract: true,
          triggeredBy: null,
        });
        report.invoices_processed++;
        report.lines_staged += r.lines_staged;
        report.lines_pending += r.lines_pending;
        report.lines_auto_committed += r.lines_auto_committed;
        for (const [tier, count] of Object.entries(r.match_tier_breakdown)) {
          report.match_tier_breakdown[tier] =
            (report.match_tier_breakdown[tier] ?? 0) + count;
        }
        console.log(
          `    ok · ${r.lines_staged} lines (${r.matched_existing_items} matched, ${r.new_items_proposed} new)`
        );
      } catch (err) {
        report.invoices_failed++;
        console.warn(
          `    fail · ${label} · ${err instanceof Error ? err.message : err}`
        );
      }
    }
  }

  const workers: Promise<void>[] = [];
  for (let i = 0; i < CONCURRENCY; i++) workers.push(worker());
  await Promise.all(workers);

  // Aggregate post-extraction metrics from the DB so the report reflects
  // what actually landed rather than what the extractInvoice return said.
  const invoiceIds = invoices.map((i) => i.id);

  const { data: extractionRows } = await supabase
    .from("invoice_extractions")
    .select("id, skipped_lines")
    .in("invoice_id", invoiceIds)
    .is("deleted_at", null);

  const extractionIds: string[] = [];
  for (const row of (extractionRows ?? []) as Array<{
    id: string;
    skipped_lines: unknown;
  }>) {
    extractionIds.push(row.id);
    if (Array.isArray(row.skipped_lines)) {
      report.skipped_lines += row.skipped_lines.length;
    }
  }

  if (extractionIds.length > 0) {
    const { data: natureRows } = await supabase
      .from("invoice_extraction_lines")
      .select("line_nature")
      .in("extraction_id", extractionIds)
      .is("deleted_at", null);

    for (const row of (natureRows ?? []) as Array<{ line_nature: string | null }>) {
      const key = row.line_nature ?? "(null)";
      report.nature_distribution[key] = (report.nature_distribution[key] ?? 0) + 1;
      if (key === "unclassified") report.review_tab_count++;
    }

    const { data: bomRows } = await supabase
      .from("line_bom_attachments")
      .select("attachment_source, confirmation_status")
      .in("scope_extraction_line_id", await scopeLineIds(extractionIds))
      .is("deleted_at", null);

    for (const row of (bomRows ?? []) as Array<{
      attachment_source: string;
      confirmation_status: string;
    }>) {
      if (row.attachment_source === "ai_auto") report.bom_attachments_auto++;
      else if (row.attachment_source === "ai_suggested") report.bom_attachments_suggested++;
    }
  }

  console.log("\n============================================================");
  console.log("RECLASSIFY REPORT");
  console.log("============================================================");
  console.log(`Invoices processed:          ${report.invoices_processed}`);
  console.log(`Invoices failed:             ${report.invoices_failed}`);
  console.log(`Lines persisted (current):   ${sum(report.nature_distribution)}`);
  console.log(`  pending verification:      ${report.lines_pending}`);
  console.log(`  auto-committed:            ${report.lines_auto_committed}`);
  console.log(`Skipped lines (not persisted): ${report.skipped_lines}`);
  console.log(`BOM attachments (auto):        ${report.bom_attachments_auto}`);
  console.log(`BOM attachments (suggested):   ${report.bom_attachments_suggested}`);
  console.log(`Review tab count:              ${report.review_tab_count}`);

  console.log("\nNature distribution:");
  const totalNature = sum(report.nature_distribution);
  for (const [nature, count] of Object.entries(report.nature_distribution).sort()) {
    const pct = totalNature > 0 ? ((count / totalNature) * 100).toFixed(1) : "0.0";
    console.log(`  ${nature.padEnd(20)} ${String(count).padStart(4)} (${pct}%)`);
  }

  console.log("\nMatch tier breakdown:");
  for (const [tier, count] of Object.entries(report.match_tier_breakdown)) {
    console.log(`  ${tier.padEnd(28)} ${count}`);
  }

  // Anthropic spend estimate — look at api_usage for the last hour.
  const { data: usage } = await supabase
    .from("api_usage")
    .select("cost_cents, total_tokens, function_type")
    .in("function_type", ["item_match", "line_nature_classify"])
    .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());

  if (usage && usage.length > 0) {
    const totalCents = (
      usage as Array<{ cost_cents: number | null }>
    ).reduce((s, r) => s + (r.cost_cents ?? 0), 0);
    const totalTokens = (
      usage as Array<{ total_tokens: number | null }>
    ).reduce((s, r) => s + (r.total_tokens ?? 0), 0);
    console.log(
      `\nClaude API spend last hour: $${(totalCents / 100).toFixed(4)} · ${totalTokens} tokens`
    );
  }

  console.log("\nRe-extraction complete.");
}

async function scopeLineIds(extractionIds: string[]): Promise<string[]> {
  if (extractionIds.length === 0) return [];
  const { data } = await supabase
    .from("invoice_extraction_lines")
    .select("id")
    .in("extraction_id", extractionIds)
    .eq("line_nature", "scope")
    .is("deleted_at", null);
  return ((data ?? []) as Array<{ id: string }>).map((r) => r.id);
}

function sum(distribution: Record<string, number>): number {
  return Object.values(distribution).reduce((s, n) => s + n, 0);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Re-extraction failed:", err);
    process.exit(1);
  });
