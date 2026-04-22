/**
 * Reprocess CO detection + line-item migration on every existing invoice.
 *
 * Two phases:
 *   1. Line-item coverage check — verify the 00013 migration backfilled
 *      invoice_line_items for all existing invoices. Report counts and
 *      (re-)migrate any invoice that slipped through.
 *   2. CO detection — re-run the heuristic from the new parse prompt
 *      against each invoice's stored ai_raw_response (vendor name,
 *      description, line items, co_reference, flags, cost-code suggestion).
 *      Set invoices.is_change_order + invoice_line_items.is_change_order
 *      accordingly, without re-billing Claude for a full re-parse.
 *
 * Usage:
 *   npm run reprocess-co-detection
 *
 * Auth: signs in as admin so writes land under the admin RLS policies.
 * Failures on any single invoice do NOT abort the run.
 */

import path from "node:path";
import * as dotenv from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const ORG_ID = "00000000-0000-0000-0000-000000000001";

// Expanded list. Goal: bias toward true-positive so anything that reads
// like "beyond original contract scope" gets flagged for the PM to confirm.
// A false positive is cheap (PM un-toggles); a false negative is expensive
// (invoice bills against the base budget when it should have become a CO).
const CO_KEYWORDS = [
  "change order",
  "co #",
  "pcco",
  "additional",
  "extra",
  "added",
  "beyond scope",
  "beyond original scope",
  "not in original",
  "revision",
  "revised",
  "modification",
  "modified",
  "extension required",
  "extensions required",
  "relocated",
  "relocation",
];

interface InvoiceRow {
  id: string;
  job_id: string | null;
  cost_code_id: string | null;
  vendor_name_raw: string | null;
  description: string | null;
  co_reference_raw: string | null;
  is_change_order: boolean;
  line_items: unknown;
  ai_raw_response: Record<string, unknown> | null;
}

interface LineItemRow {
  id: string;
  invoice_id?: string;
  description: string | null;
  is_change_order: boolean;
  co_reference: string | null;
  cost_code_id: string | null;
}

function containsCoKeyword(text: string | null | undefined): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return CO_KEYWORDS.some((kw) => lower.includes(kw));
}

/** Heuristic copy of the prompt's CO detection rule, applied to the stored AI response
 *  plus any persisted invoice_line_items rows (authoritative since the 00013 migration). */
function detectChangeOrderFromStored(
  inv: InvoiceRow,
  lineItemRows: { description: string | null; co_reference: string | null }[]
): { isCo: boolean; coRef: string | null; reason: string; matchedPhrase: string | null } {
  const ai = inv.ai_raw_response ?? {};

  // 1. Explicit flag from a re-parsed response
  if (ai.is_change_order === true) {
    return {
      isCo: true,
      coRef: (ai.co_reference as string | null) ?? inv.co_reference_raw,
      reason: "ai.is_change_order",
      matchedPhrase: null,
    };
  }

  // 2. Flags array
  const flags = Array.isArray(ai.flags) ? (ai.flags as string[]) : [];
  if (flags.includes("change_order")) {
    return {
      isCo: true,
      coRef: (ai.co_reference as string | null) ?? inv.co_reference_raw,
      reason: "flags.change_order",
      matchedPhrase: null,
    };
  }

  // 3. Cost code suggestion is a C-variant
  const ccSug = (ai.cost_code_suggestion ?? null) as { code?: string; is_change_order?: boolean } | null;
  if (ccSug?.is_change_order === true || ccSug?.code?.endsWith("C")) {
    return {
      isCo: true,
      coRef: (ai.co_reference as string | null) ?? inv.co_reference_raw,
      reason: "cost_code_suggestion C-variant",
      matchedPhrase: null,
    };
  }

  // 4. Invoice-level co_reference exists
  if (inv.co_reference_raw && inv.co_reference_raw.trim()) {
    return {
      isCo: true,
      coRef: inv.co_reference_raw,
      reason: "co_reference_raw present",
      matchedPhrase: null,
    };
  }

  // 5. Keyword scan across description, line items (JSONB + invoice_line_items rows),
  //    and CO references on individual line items. Report WHICH phrase matched so
  //    the human reviewer can audit the heuristic.
  const scan = (text: string | null | undefined): string | null => {
    if (!text) return null;
    const lower = text.toLowerCase();
    for (const kw of CO_KEYWORDS) {
      if (lower.includes(kw)) return kw;
    }
    return null;
  };

  const descMatch = scan(inv.description);
  if (descMatch) {
    return {
      isCo: true,
      coRef: inv.co_reference_raw,
      reason: `keyword in description`,
      matchedPhrase: descMatch,
    };
  }

  const jsonMatch = scan(JSON.stringify(inv.line_items ?? []));
  if (jsonMatch) {
    return {
      isCo: true,
      coRef: inv.co_reference_raw,
      reason: `keyword in line_items JSONB`,
      matchedPhrase: jsonMatch,
    };
  }

  for (const li of lineItemRows) {
    const lineMatch = scan(li.description);
    if (lineMatch) {
      return {
        isCo: true,
        coRef: inv.co_reference_raw ?? li.co_reference,
        reason: `keyword in invoice_line_items`,
        matchedPhrase: lineMatch,
      };
    }
  }

  return { isCo: false, coRef: null, reason: "no CO indicators", matchedPhrase: null };
}

async function signInAsAdmin(): Promise<SupabaseClient> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  const email = process.env.BULK_IMPORT_EMAIL ?? "jake@rossbuilt.com";
  const password = process.env.BULK_IMPORT_PASSWORD ?? "RossBuilt2026!";

  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    throw new Error(`Sign-in failed: ${error?.message}`);
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", data.user.id)
    .single();
  if (profile?.role !== "admin") {
    throw new Error(`Reprocess requires admin. ${email} has role: ${profile?.role}`);
  }
  console.log(`✓ Signed in as ${profile.full_name} (${email}, admin)\n`);
  return supabase;
}

async function loadAllInvoices(supabase: SupabaseClient): Promise<InvoiceRow[]> {
  const { data, error } = await supabase
    .from("invoices")
    .select(
      "id, job_id, cost_code_id, vendor_name_raw, description, co_reference_raw, is_change_order, line_items, ai_raw_response"
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Failed to load invoices: ${error.message}`);
  return (data ?? []) as InvoiceRow[];
}

async function ensureLineItemCoverage(supabase: SupabaseClient, inv: InvoiceRow): Promise<number> {
  const { data: existingLines } = await supabase
    .from("invoice_line_items")
    .select("id")
    .eq("invoice_id", inv.id)
    .is("deleted_at", null);
  if ((existingLines?.length ?? 0) > 0) return 0;

  const jsonbLines = Array.isArray(inv.line_items) ? (inv.line_items as Array<Record<string, unknown>>) : [];
  if (jsonbLines.length === 0) return 0;

  // Resolve budget line for the invoice's current cost code, if any.
  let budgetLineId: string | null = null;
  if (inv.job_id && inv.cost_code_id) {
    const { data } = await supabase
      .from("budget_lines")
      .select("id")
      .eq("job_id", inv.job_id)
      .eq("cost_code_id", inv.cost_code_id)
      .is("deleted_at", null)
      .limit(1);
    budgetLineId = (data?.[0]?.id as string) ?? null;
  }

  const rows = jsonbLines.map((item, idx) => ({
    invoice_id: inv.id,
    line_index: idx,
    description: (item.description as string) ?? null,
    qty: typeof item.qty === "number" ? item.qty : null,
    unit: typeof item.unit === "string" ? item.unit : null,
    rate: typeof item.rate === "number" ? item.rate : null,
    amount_cents: typeof item.amount === "number" ? Math.round(item.amount * 100) : 0,
    cost_code_id: inv.cost_code_id,
    budget_line_id: budgetLineId,
    is_change_order: !!(inv.co_reference_raw && inv.co_reference_raw.trim()),
    co_reference: inv.co_reference_raw,
    org_id: ORG_ID,
  }));

  const { error } = await supabase.from("invoice_line_items").insert(rows);
  if (error) {
    console.warn(`  ! Line-item backfill failed for invoice ${inv.id}: ${error.message}`);
    return 0;
  }
  return rows.length;
}

async function applyCoDetection(supabase: SupabaseClient, inv: InvoiceRow): Promise<{
  changed: boolean;
  reason: string;
  matchedPhrase: string | null;
  coRef: string | null;
  isCo: boolean;
}> {
  // Pull the line item rows once so the keyword scan can look at them.
  const { data: lineItemRows } = await supabase
    .from("invoice_line_items")
    .select("id, description, is_change_order, co_reference, cost_code_id")
    .eq("invoice_id", inv.id)
    .is("deleted_at", null);
  const allLines = (lineItemRows as LineItemRow[] | null) ?? [];

  const { isCo, coRef, reason, matchedPhrase } = detectChangeOrderFromStored(inv, allLines);
  if (inv.is_change_order === isCo && (inv.co_reference_raw ?? null) === (coRef ?? null)) {
    return { changed: false, reason, matchedPhrase, coRef, isCo };
  }

  const update: Record<string, unknown> = { is_change_order: isCo };
  if (coRef && coRef !== inv.co_reference_raw) update.co_reference_raw = coRef;

  const { error } = await supabase.from("invoices").update(update).eq("id", inv.id);
  if (error) {
    console.warn(`  ! CO update failed for invoice ${inv.id}: ${error.message}`);
    return { changed: false, reason, matchedPhrase, coRef, isCo };
  }

  // Mirror onto line items (ones that have no explicit CO opinion).
  if (isCo) {
    const toUpdate = allLines.filter((l) => !l.is_change_order);
    if (toUpdate.length > 0) {
      await supabase
        .from("invoice_line_items")
        .update({ is_change_order: true, co_reference: coRef ?? inv.co_reference_raw })
        .in(
          "id",
          toUpdate.map((l) => l.id)
        );
    }
  }

  return { changed: true, reason, matchedPhrase, coRef, isCo };
}

async function main() {
  console.log("── Nightwork: CO Detection + Line Item Reprocess ──\n");

  const supabase = await signInAsAdmin();
  const invoices = await loadAllInvoices(supabase);

  console.log(`Loaded ${invoices.length} invoice(s).\n`);

  let coveredCount = 0;
  let migratedLines = 0;
  let coFlipped = 0;
  let coAlreadyCorrect = 0;
  let coNoIndicator = 0;

  for (const inv of invoices) {
    const vendor = inv.vendor_name_raw ?? "Unknown";
    const label = `[${inv.id.slice(0, 8)}] ${vendor}`;

    // Phase 1: line item coverage
    const migrated = await ensureLineItemCoverage(supabase, inv);
    if (migrated > 0) {
      migratedLines += migrated;
      console.log(`${label}: migrated ${migrated} line item(s) from JSONB`);
    } else {
      coveredCount++;
    }

    // Phase 2: CO detection
    const { changed, reason, isCo, coRef, matchedPhrase } = await applyCoDetection(supabase, inv);
    if (changed) {
      coFlipped++;
      const phrase = matchedPhrase ? ` [matched "${matchedPhrase}"]` : "";
      console.log(`${label}: is_change_order → ${isCo} (${reason})${phrase}${coRef ? `, co_ref="${coRef}"` : ""}`);
    } else if (isCo) {
      coAlreadyCorrect++;
    } else {
      coNoIndicator++;
    }
  }

  console.log("\n── Summary ──");
  console.log(`Invoices scanned:          ${invoices.length}`);
  console.log(`Already had line items:    ${coveredCount}`);
  console.log(`Line items migrated now:   ${migratedLines}`);
  console.log(`CO detected (newly set):   ${coFlipped}`);
  console.log(`CO already correct:        ${coAlreadyCorrect}`);
  console.log(`No CO indicators:          ${coNoIndicator}`);

  // Final table count
  const { count } = await supabase
    .from("invoice_line_items")
    .select("*", { count: "exact", head: true })
    .is("deleted_at", null);
  console.log(`\nTotal invoice_line_items rows now: ${count ?? "?"}`);
}

main().catch((err) => {
  console.error("\n✗ Reprocess failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
