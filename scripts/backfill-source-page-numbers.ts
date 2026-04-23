/**
 * Backfill source_page_number on Ross Built invoice extraction lines.
 *
 * Phase 2 added line_items[].source_page_number to the parse prompt and
 * threaded it through extract-invoice onto document_extraction_lines. That
 * only helps freshly-uploaded invoices. Existing invoices parsed before
 * Phase 2 have null page numbers → the verification viewer falls back to
 * page 1 + a fuzzy text search.
 *
 * This script re-parses those invoices with the new prompt, merges the
 * captured source_page_number back into the invoice's line_items JSONB,
 * then calls extractInvoice(reextract:true) so the extraction_lines rows
 * pick it up.
 *
 * Safety:
 *   - Skips any invoice where ANY line is already verified / auto-committed /
 *     corrected / not_item. Re-extraction would soft-delete those rows;
 *     we don't want to undo PM work. Anything mixed also skips.
 *   - Only processes Ross Built org invoices. Other tenants are untouched.
 *   - All mutations run via the service role against dev. Never run against
 *     production DB.
 *
 * Cost: Anthropic invoice_parse at ~$0.02/invoice × ~56 invoices ≈ $1-2.
 *
 * Usage: npx tsx scripts/backfill-source-page-numbers.ts
 */

import path from "node:path";
import * as dotenv from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { parseInvoiceWithVision } from "@/lib/claude/parse-invoice";
import { extractInvoice } from "@/lib/cost-intelligence/extract-invoice";
import type { ParsedInvoice, ParsedLineItem } from "@/lib/types/invoice";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  process.exit(1);
}

const supabase: SupabaseClient = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const ORG_MATCH = "%Ross Built%"; // ILIKE pattern
const BUCKET = "invoice-files";
const COMMITTED_STATUSES = ["verified", "auto_committed", "corrected", "not_item"] as const;

interface InvoiceRow {
  id: string;
  invoice_number: string | null;
  vendor_id: string | null;
  original_file_url: string | null;
  original_file_type: string | null;
}

interface Report {
  total_invoices: number;
  skipped_no_pdf: number;
  skipped_already_verified: number;
  skipped_mixed_verification: number;
  skipped_error: number;
  processed: number;
  lines_reextracted: number;
  lines_with_page_number: number;
}

async function main() {
  console.log("============================================================");
  console.log("Backfill source_page_number — Ross Built Phase 2 re-extract");
  console.log("============================================================");

  const startedAt = new Date().toISOString();

  const { data: orgs } = await supabase
    .from("organizations")
    .select("id, name")
    .ilike("name", ORG_MATCH)
    .limit(1);

  const org = (orgs ?? [])[0] as { id: string; name: string } | undefined;
  if (!org) {
    console.error("Ross Built org not found");
    process.exit(1);
  }
  console.log(`Org: ${org.name} (${org.id})`);

  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, invoice_number, vendor_id, original_file_url, original_file_type")
    .eq("org_id", org.id)
    .is("deleted_at", null)
    .order("invoice_date", { ascending: true });

  const invList = (invoices ?? []) as InvoiceRow[];
  console.log(`Invoices to evaluate: ${invList.length}\n`);

  const report: Report = {
    total_invoices: invList.length,
    skipped_no_pdf: 0,
    skipped_already_verified: 0,
    skipped_mixed_verification: 0,
    skipped_error: 0,
    processed: 0,
    lines_reextracted: 0,
    lines_with_page_number: 0,
  };

  // Run with gentle concurrency (Anthropic rate limits + serial updates to
  // the same org). 3 matches prior backfill scripts.
  const CONCURRENCY = 3;
  const queue = invList.slice();
  const workers: Promise<void>[] = [];

  async function worker() {
    while (queue.length > 0) {
      const inv = queue.shift();
      if (!inv) break;
      await processOne(inv, org!.id, report);
    }
  }
  for (let i = 0; i < CONCURRENCY; i++) workers.push(worker());
  await Promise.all(workers);

  // API spend from parse calls kicked off during this run.
  const { data: usage } = await supabase
    .from("api_usage")
    .select("estimated_cost_cents, total_tokens, function_type")
    .gte("created_at", startedAt)
    .eq("org_id", org.id);

  const spendRows = (usage ?? []) as Array<{
    estimated_cost_cents: number | null;
    total_tokens: number | null;
    function_type: string;
  }>;
  const totalCents = spendRows.reduce((s, r) => s + (r.estimated_cost_cents ?? 0), 0);
  const totalTokens = spendRows.reduce((s, r) => s + (r.total_tokens ?? 0), 0);
  const parseCents = spendRows
    .filter((r) => r.function_type === "invoice_parse")
    .reduce((s, r) => s + (r.estimated_cost_cents ?? 0), 0);

  console.log("\n============================================================");
  console.log("BACKFILL REPORT");
  console.log("============================================================");
  console.log(`Ross Built invoices evaluated:        ${report.total_invoices}`);
  console.log(`Skipped — no PDF stored:              ${report.skipped_no_pdf}`);
  console.log(`Skipped — all lines already verified: ${report.skipped_already_verified}`);
  console.log(`Skipped — mixed verification state:   ${report.skipped_mixed_verification}`);
  console.log(`Skipped — error:                      ${report.skipped_error}`);
  console.log(`Processed (re-parsed + re-extracted): ${report.processed}`);
  console.log(`Extraction lines re-extracted:        ${report.lines_reextracted}`);
  console.log(`Lines with source_page_number:        ${report.lines_with_page_number}`);
  if (report.lines_reextracted > 0) {
    const pct = (report.lines_with_page_number / report.lines_reextracted) * 100;
    console.log(`Source page coverage:                 ${pct.toFixed(1)}%`);
  }
  console.log(
    `Anthropic spend (invoice_parse):      $${(parseCents / 100).toFixed(4)}`
  );
  console.log(
    `Anthropic spend (all functions):      $${(totalCents / 100).toFixed(4)} · ${totalTokens} tokens`
  );
  console.log("\nBackfill complete.");
}

async function processOne(inv: InvoiceRow, orgId: string, report: Report): Promise<void> {
  const tag = inv.invoice_number ?? inv.id.slice(0, 8);

  if (!inv.original_file_url) {
    console.log(`  ⟶ ${tag} … SKIP (no PDF)`);
    report.skipped_no_pdf++;
    return;
  }

  // Verification-status gate: skip anything that already has committed work.
  const { data: existingEx } = await supabase
    .from("document_extractions")
    .select("id")
    .eq("invoice_id", inv.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (existingEx) {
    const { data: lineStatuses } = await supabase
      .from("document_extraction_lines")
      .select("verification_status")
      .eq("extraction_id", (existingEx as { id: string }).id)
      .is("deleted_at", null);

    const statuses = ((lineStatuses ?? []) as Array<{ verification_status: string }>).map(
      (l) => l.verification_status
    );
    const committed = statuses.filter((s) =>
      (COMMITTED_STATUSES as readonly string[]).includes(s)
    ).length;
    const pending = statuses.filter((s) => s === "pending").length;

    if (statuses.length > 0 && pending === 0) {
      console.log(`  ⟶ ${tag} … SKIP (all ${committed} lines already verified)`);
      report.skipped_already_verified++;
      return;
    }
    if (committed > 0) {
      console.log(
        `  ⟶ ${tag} … SKIP (mixed: ${committed} verified, ${pending} pending — preserving committed work)`
      );
      report.skipped_mixed_verification++;
      return;
    }
  }

  // Download PDF from storage.
  let pdfBuffer: Buffer;
  try {
    const { data, error } = await supabase.storage.from(BUCKET).download(inv.original_file_url);
    if (error || !data) {
      console.log(`  ⟶ ${tag} … SKIP (download: ${error?.message ?? "empty"})`);
      report.skipped_error++;
      return;
    }
    pdfBuffer = Buffer.from(await data.arrayBuffer());
  } catch (err) {
    console.log(
      `  ⟶ ${tag} … SKIP (download exception: ${err instanceof Error ? err.message : err})`
    );
    report.skipped_error++;
    return;
  }

  // Re-parse with the Phase 2 prompt to capture source_page_number per line.
  let newParsed: ParsedInvoice;
  try {
    newParsed = await parseInvoiceWithVision(
      pdfBuffer,
      "application/pdf",
      inv.original_file_url.split("/").pop() ?? "invoice.pdf",
      supabase,
      {
        org_id: orgId,
        user_id: null,
        metadata: {
          invoice_id: inv.id,
          backfill: "source_page_number",
        },
      }
    );
  } catch (err) {
    console.log(`  ⟶ ${tag} … FAIL (parse: ${err instanceof Error ? err.message : err})`);
    report.skipped_error++;
    return;
  }

  // Merge source_page_number into the invoice's line_items JSONB. Position-
  // aligned with the existing array so downstream fields (descriptions,
  // amounts, etc.) stay byte-identical — we only add the new page field.
  const { data: invRow } = await supabase
    .from("invoices")
    .select("line_items")
    .eq("id", inv.id)
    .maybeSingle();

  const existingLines = Array.isArray((invRow as { line_items?: unknown[] } | null)?.line_items)
    ? ((invRow as { line_items: unknown[] }).line_items as Array<Record<string, unknown>>)
    : [];
  const newLines = newParsed.line_items ?? [];
  const mergedLines = existingLines.map((li, i) => {
    const match = newLines[i] as ParsedLineItem | undefined;
    return {
      ...li,
      source_page_number:
        typeof match?.source_page_number === "number" && match.source_page_number > 0
          ? Math.floor(match.source_page_number)
          : null,
    };
  });

  const { error: updErr } = await supabase
    .from("invoices")
    .update({ line_items: mergedLines })
    .eq("id", inv.id);

  if (updErr) {
    console.log(`  ⟶ ${tag} … FAIL (invoice update: ${updErr.message})`);
    report.skipped_error++;
    return;
  }

  // Re-extract. extractInvoice soft-deletes the prior extraction_lines (all
  // pending by our pre-check) and rebuilds them from invoice_line_items +
  // the JSONB line_items we just patched.
  try {
    const r = await extractInvoice(supabase, inv.id, {
      triggeredBy: null,
      reextract: true,
    });

    const { data: newLineRows } = await supabase
      .from("document_extraction_lines")
      .select("source_page_number")
      .eq("extraction_id", r.extraction_id)
      .is("deleted_at", null);

    const withPage = ((newLineRows ?? []) as Array<{ source_page_number: number | null }>).filter(
      (l) => l.source_page_number != null
    ).length;

    report.lines_reextracted += r.lines_staged;
    report.lines_with_page_number += withPage;
    report.processed++;

    console.log(
      `  ⟶ ${tag} … ok · ${r.lines_staged} lines staged, ${withPage} with page number`
    );
  } catch (err) {
    console.log(`  ⟶ ${tag} … FAIL (extract: ${err instanceof Error ? err.message : err})`);
    report.skipped_error++;
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Backfill failed:", err);
    process.exit(1);
  });
