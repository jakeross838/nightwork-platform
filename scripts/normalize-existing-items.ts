/**
 * Normalize items.canonical_name across every org using the same rules
 * the match pipeline now applies to new proposals.
 *
 * Runs two passes:
 *   1. Dry-run — prints a before/after table for every row whose
 *      normalized name differs from the stored value. No writes.
 *   2. Apply — performs the UPDATE when invoked with --apply.
 *
 * Usage:
 *   npx tsx scripts/normalize-existing-items.ts          # dry-run
 *   npx tsx scripts/normalize-existing-items.ts --apply  # execute
 *
 * Idempotent: running --apply twice is a no-op (the second pass finds
 * nothing to change).
 */

import path from "node:path";
import * as dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { normalizeItemName } from "@/lib/cost-intelligence/normalize-item-name";

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

const APPLY = process.argv.includes("--apply");

interface ItemRow {
  id: string;
  org_id: string;
  canonical_name: string;
}

async function main() {
  console.log("============================================================");
  console.log(`Canonical-name normalization — ${APPLY ? "APPLY" : "DRY-RUN"}`);
  console.log("============================================================");

  const { data, error } = await supabase
    .from("items")
    .select("id, org_id, canonical_name")
    .is("deleted_at", null)
    .limit(100_000);

  if (error) {
    console.error("Failed to load items:", error.message);
    process.exit(1);
  }

  const rows = (data ?? []) as ItemRow[];
  console.log(`Loaded ${rows.length} items.`);

  const toUpdate: Array<ItemRow & { new_name: string }> = [];
  for (const r of rows) {
    const next = normalizeItemName(r.canonical_name ?? "");
    if (next && next !== r.canonical_name) {
      toUpdate.push({ ...r, new_name: next });
    }
  }

  console.log(`${toUpdate.length} items would change.`);
  if (toUpdate.length === 0) {
    console.log("Nothing to do.");
    return;
  }

  const width = Math.min(
    50,
    Math.max(...toUpdate.map((r) => r.canonical_name.length))
  );

  for (const r of toUpdate) {
    const before = r.canonical_name.length > width
      ? r.canonical_name.slice(0, width - 1) + "…"
      : r.canonical_name.padEnd(width);
    const after = r.new_name;
    console.log(`  ${before}  →  ${after}`);
  }

  if (!APPLY) {
    console.log("\n(Pass --apply to execute these updates.)");
    return;
  }

  let ok = 0;
  let fail = 0;
  for (const r of toUpdate) {
    const { error: upErr } = await supabase
      .from("items")
      .update({ canonical_name: r.new_name })
      .eq("id", r.id);
    if (upErr) {
      fail++;
      console.warn(`  fail · ${r.id} · ${upErr.message}`);
    } else {
      ok++;
    }
  }
  console.log(`\nApplied ${ok} updates${fail ? ` · ${fail} failed` : ""}.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Normalization failed:", err);
    process.exit(1);
  });
