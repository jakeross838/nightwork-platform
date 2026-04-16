/**
 * Backfill missing vendor_id on existing invoices.
 *
 * For every invoice where vendor_id IS NULL and vendor_name_raw IS NOT NULL:
 *   1. Try to match an existing vendor via case-insensitive name containment
 *      (with suffix normalization: LLC, Inc, Co, Corp, Ltd, Company).
 *   2. If no match, create a new vendor record using the parsed name.
 *   3. Update invoice.vendor_id.
 *
 * Safe to run multiple times — each pass only touches invoices still
 * missing a vendor_id.
 *
 * Writes with the service-role key so we sidestep RLS and org-membership
 * checks that may have silently blocked the UI-side save path.
 *
 * Usage: npx tsx scripts/backfill-vendor-ids.ts
 */

import path from "node:path";
import * as dotenv from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  process.exit(1);
}

const VENDOR_SUFFIXES = /\b(llc|inc|co|corp|ltd|company|enterprises|services)\b\.?/gi;

function normalizeVendorName(name: string): string {
  return name.replace(VENDOR_SUFFIXES, "").replace(/[.,]+/g, "").trim().toLowerCase();
}

interface Vendor { id: string; name: string; org_id: string }

/**
 * Strong-evidence match: substring containment in either direction, or
 * ≥2 shared significant-word tokens. Single-word first-letter matches
 * are explicitly rejected (that's how "Florida Sunshine Carpentry"
 * wrongly bound to "M & J Florida Enterprises, LLC" before).
 */
async function findExisting(
  supabase: SupabaseClient,
  orgId: string,
  vendorName: string
): Promise<Vendor | null> {
  const normalizedNew = normalizeVendorName(vendorName);
  if (!normalizedNew) return null;

  const newTokens = new Set(normalizedNew.split(/\s+/).filter((w) => w.length >= 3));
  if (newTokens.size === 0) return null;

  const firstToken = Array.from(newTokens)[0];
  const { data } = await supabase
    .from("vendors")
    .select("id, name, org_id")
    .eq("org_id", orgId)
    .ilike("name", `%${firstToken}%`)
    .is("deleted_at", null)
    .limit(25);

  const candidates = (data ?? []) as Vendor[];
  for (const c of candidates) {
    const normalizedExisting = normalizeVendorName(c.name);
    if (!normalizedExisting) continue;
    if (
      normalizedExisting.includes(normalizedNew) ||
      normalizedNew.includes(normalizedExisting)
    ) {
      return c;
    }
    const existingTokens = new Set(
      normalizedExisting.split(/\s+/).filter((w) => w.length >= 3)
    );
    let overlap = 0;
    newTokens.forEach((t) => { if (existingTokens.has(t)) overlap++; });
    if (overlap >= 2) return c;
  }
  return null;
}

async function createVendor(
  supabase: SupabaseClient,
  orgId: string,
  vendorName: string
): Promise<Vendor> {
  const { data, error } = await supabase
    .from("vendors")
    .insert({ name: vendorName.trim(), org_id: orgId })
    .select("id, name, org_id")
    .single();
  if (error || !data) throw new Error(`insert vendor "${vendorName}": ${error?.message ?? "no data"}`);
  return data as Vendor;
}

async function main() {
  const supabase = createClient(SUPABASE_URL!, SERVICE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: invoices, error } = await supabase
    .from("invoices")
    .select("id, org_id, vendor_name_raw")
    .is("vendor_id", null)
    .not("vendor_name_raw", "is", null)
    .is("deleted_at", null);

  if (error) {
    console.error("fetch invoices failed:", error.message);
    process.exit(1);
  }

  const rows = invoices ?? [];
  console.log(`\nBackfill scope: ${rows.length} invoice(s) with vendor_name_raw but no vendor_id\n`);

  // Cache per-org vendor lookups so a stack of invoices from the same vendor
  // all resolve to the same row without three DB round-trips each.
  const cachePerOrg = new Map<string, Map<string, string>>(); // orgId -> normalized -> vendorId

  let matched = 0;
  let created = 0;
  let stillUnmatched = 0;
  const failures: Array<{ invoiceId: string; vendorName: string; reason: string }> = [];

  for (const row of rows as Array<{ id: string; org_id: string; vendor_name_raw: string | null }>) {
    const vendorName = (row.vendor_name_raw ?? "").trim();
    if (!vendorName) {
      stillUnmatched += 1;
      continue;
    }

    const normalized = normalizeVendorName(vendorName) || vendorName.toLowerCase();
    let cache = cachePerOrg.get(row.org_id);
    if (!cache) { cache = new Map(); cachePerOrg.set(row.org_id, cache); }

    let vendorId: string | null = cache.get(normalized) ?? null;
    let status: "matched" | "created" | null = null;

    if (!vendorId) {
      try {
        const existing = await findExisting(supabase, row.org_id, vendorName);
        if (existing) {
          vendorId = existing.id;
          status = "matched";
        } else {
          const newVendor = await createVendor(supabase, row.org_id, vendorName);
          vendorId = newVendor.id;
          status = "created";
        }
        cache.set(normalized, vendorId);
      } catch (err) {
        failures.push({
          invoiceId: row.id,
          vendorName,
          reason: err instanceof Error ? err.message : String(err),
        });
        stillUnmatched += 1;
        continue;
      }
    } else {
      status = "matched";
    }

    const { error: upErr } = await supabase
      .from("invoices")
      .update({ vendor_id: vendorId })
      .eq("id", row.id);

    if (upErr) {
      failures.push({
        invoiceId: row.id,
        vendorName,
        reason: `update invoice: ${upErr.message}`,
      });
      stillUnmatched += 1;
      continue;
    }

    if (status === "matched") matched += 1;
    else if (status === "created") created += 1;

    console.log(`  [${status}] ${vendorName.padEnd(35)} → ${vendorId}`);
  }

  console.log(`\n================ SUMMARY ================`);
  console.log(`  Matched to existing vendor: ${matched}`);
  console.log(`  Created new vendor record:  ${created}`);
  console.log(`  Still unmatched / failed:   ${stillUnmatched}`);
  if (failures.length > 0) {
    console.log(`\nFailures:`);
    for (const f of failures) {
      console.log(`  - invoice ${f.invoiceId} ("${f.vendorName}"): ${f.reason}`);
    }
  }
  console.log(`==========================================\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
