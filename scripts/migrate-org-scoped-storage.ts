/**
 * One-time migration: move all `invoice-files/uploads/*` objects under the
 * Ross Built org prefix (`{org_id}/uploads/*`) and rewrite every
 * `invoices.original_file_url` row accordingly.
 *
 * Usage: npx tsx scripts/migrate-org-scoped-storage.ts
 *
 * Safe to re-run — already-migrated files are skipped; rows with URLs
 * that already contain the org prefix are left alone.
 */

import path from "node:path";
import * as dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const BUCKET = "invoice-files";
const ROSS_BUILT_ORG_ID = "00000000-0000-0000-0000-000000000001";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Missing Supabase env vars");

  const email = process.env.BULK_IMPORT_EMAIL ?? "jake@rossbuilt.com";
  const password = process.env.BULK_IMPORT_PASSWORD ?? "RossBuilt2026!";

  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: session, error: signInErr } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (signInErr || !session.user) {
    throw new Error(`Sign-in failed: ${signInErr?.message}`);
  }
  console.log(`Signed in as ${email}`);

  // Update DB URLs first — the RLS policy allows reads from both legacy
  // `uploads/…` and the new `{org}/uploads/…` paths, so clients keep working
  // through the migration.
  const { data: invoices, error: invErr } = await supabase
    .from("invoices")
    .select("id, original_file_url")
    .not("original_file_url", "is", null);
  if (invErr) throw new Error(`Fetch invoices: ${invErr.message}`);

  let dbUpdates = 0;
  for (const inv of invoices ?? []) {
    const url = inv.original_file_url as string;
    if (!url.startsWith("uploads/")) continue; // already migrated
    const newUrl = `${ROSS_BUILT_ORG_ID}/${url}`;
    const { error } = await supabase
      .from("invoices")
      .update({ original_file_url: newUrl })
      .eq("id", inv.id);
    if (error) {
      console.warn(`  DB update failed for invoice ${inv.id}: ${error.message}`);
    } else {
      dbUpdates++;
    }
  }
  console.log(`Updated ${dbUpdates} invoice rows.`);

  // Now physically move each storage object. If a move fails (e.g. target
  // already exists from a prior partial run), skip rather than abort.
  const { data: objects, error: listErr } = await supabase.storage
    .from(BUCKET)
    .list("uploads", { limit: 10000, sortBy: { column: "name", order: "asc" } });
  if (listErr) throw new Error(`List storage: ${listErr.message}`);

  let moved = 0;
  let skipped = 0;
  for (const obj of objects ?? []) {
    const source = `uploads/${obj.name}`;
    const target = `${ROSS_BUILT_ORG_ID}/uploads/${obj.name}`;
    const { error } = await supabase.storage.from(BUCKET).move(source, target);
    if (error) {
      console.warn(`  move skipped (${obj.name}): ${error.message}`);
      skipped++;
    } else {
      moved++;
    }
  }
  console.log(`Moved ${moved} files. Skipped ${skipped}.`);
  console.log("Migration complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
