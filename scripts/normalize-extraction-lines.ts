/**
 * Normalize document_extraction_lines.proposed_item_data.canonical_name
 * in place using the same rules match-item.ts applies to new AI proposals.
 *
 * Context: the 82 pending extraction lines in dev were created by the C7
 * re-extraction *before* normalize-item-name.ts shipped (C2). Their
 * proposed_item_data is sentence-case (AI default) whereas new proposals
 * are already title-cased. The C3 cleanup script only touched
 * items.canonical_name — this script closes the other half of the gap.
 *
 * Runs dry-run by default; pass --apply to write. Pure string transform,
 * no AI cost. Idempotent.
 *
 * Usage:
 *   npx tsx scripts/normalize-extraction-lines.ts          # dry-run
 *   npx tsx scripts/normalize-extraction-lines.ts --apply  # execute
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

interface Row {
  id: string;
  org_id: string;
  raw_description: string | null;
  proposed_item_data: Record<string, unknown> | null;
}

async function main() {
  console.log("============================================================");
  console.log(`Extraction-line canonical_name normalization — ${APPLY ? "APPLY" : "DRY-RUN"}`);
  console.log("============================================================");

  const { data, error } = await supabase
    .from("document_extraction_lines")
    .select("id, org_id, raw_description, proposed_item_data")
    .is("deleted_at", null)
    .eq("verification_status", "pending")
    .not("proposed_item_data", "is", null)
    .limit(100_000);

  if (error) {
    console.error("Failed to load extraction lines:", error.message);
    process.exit(1);
  }

  const rows = (data ?? []) as Row[];
  console.log(`Loaded ${rows.length} pending extraction lines with proposals.`);

  const toUpdate: Array<{
    id: string;
    raw_description: string | null;
    old_name: string;
    new_name: string;
    next_proposal: Record<string, unknown>;
  }> = [];

  for (const r of rows) {
    const proposal = r.proposed_item_data;
    if (!proposal || typeof proposal !== "object") continue;
    const current = proposal["canonical_name"];
    if (typeof current !== "string" || !current) continue;
    const normalized = normalizeItemName(current);
    if (!normalized || normalized === current) continue;
    toUpdate.push({
      id: r.id,
      raw_description: r.raw_description,
      old_name: current,
      new_name: normalized,
      next_proposal: { ...proposal, canonical_name: normalized },
    });
  }

  console.log(`${toUpdate.length} lines would change.`);
  if (toUpdate.length === 0) {
    console.log("Nothing to do.");
    return;
  }

  // Print sample: up to first 15 changes in a before/after table.
  const sample = toUpdate.slice(0, 15);
  const beforeWidth = Math.min(60, Math.max(...sample.map((r) => r.old_name.length)));
  for (const r of sample) {
    const before = r.old_name.length > beforeWidth
      ? r.old_name.slice(0, beforeWidth - 1) + "…"
      : r.old_name.padEnd(beforeWidth);
    console.log(`  ${before}  →  ${r.new_name}`);
  }
  if (toUpdate.length > sample.length) {
    console.log(`  ... (+${toUpdate.length - sample.length} more)`);
  }

  if (!APPLY) {
    console.log("\n(Pass --apply to execute these updates.)");
    return;
  }

  let ok = 0;
  let fail = 0;
  for (const r of toUpdate) {
    const { error: upErr } = await supabase
      .from("document_extraction_lines")
      .update({ proposed_item_data: r.next_proposal })
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
