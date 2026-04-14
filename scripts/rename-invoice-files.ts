/**
 * One-time script: rename every invoice's storage object to the clean
 * [job]_[vendor]_[invoice#]_[date].[ext] convention and update the
 * database's original_file_url column to match.
 *
 * Usage: npm run rename-invoice-files
 *
 * Safe to re-run — if an invoice is already at its target path, we skip it.
 * If a collision exists (two invoices would map to the same name), we
 * append a short hex suffix.
 */

import path from "node:path";
import * as dotenv from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  buildCleanFilename,
  extensionFor,
  renameStorageObject,
  storagePathFor,
} from "@/lib/invoices/file-naming";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const BUCKET = "invoice-files";

interface InvoiceRow {
  id: string;
  vendor_name_raw: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  original_file_url: string | null;
  original_filename: string | null;
  original_file_type: string | null;
  document_category: string | null;
  jobs: { id: string; name: string } | { id: string; name: string }[] | null;
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
  if (error || !data.user) throw new Error(`Sign-in failed: ${error?.message}`);
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", data.user.id)
    .single();
  if (profile?.role !== "admin") {
    throw new Error(`Admin required (${email} is ${profile?.role})`);
  }
  console.log(`✓ Signed in as ${profile.full_name} (${email}, admin)\n`);
  return supabase;
}

function firstJob(rel: InvoiceRow["jobs"]): { name: string } | null {
  if (!rel) return null;
  if (Array.isArray(rel)) return rel[0] ?? null;
  return rel;
}

async function main() {
  console.log("Retroactive invoice file rename\n");
  const supabase = await signInAsAdmin();

  const { data, error } = await supabase
    .from("invoices")
    .select(
      "id, vendor_name_raw, invoice_number, invoice_date, original_file_url, original_filename, original_file_type, document_category, jobs:job_id (id, name)"
    )
    .is("deleted_at", null)
    .not("original_file_url", "is", null)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Failed to load invoices: ${error.message}`);
  const invoices = (data ?? []) as InvoiceRow[];

  console.log(`Found ${invoices.length} invoices with files to rename\n`);

  let renamed = 0;
  let skipped = 0;
  let failed = 0;

  for (const inv of invoices) {
    const currentPath = inv.original_file_url!;
    const job = firstJob(inv.jobs);
    const overhead = inv.document_category === "overhead";

    const ext = extensionFor(null, inv.original_file_type, inv.original_filename ?? currentPath);
    const cleanName = buildCleanFilename({
      jobName: job?.name ?? null,
      overhead,
      vendorName: inv.vendor_name_raw,
      invoiceNumber: inv.invoice_number,
      invoiceDate: inv.invoice_date,
      extension: ext,
    });
    const desiredPath = storagePathFor(cleanName);

    if (desiredPath === currentPath) {
      skipped += 1;
      continue;
    }

    try {
      const finalPath = await renameStorageObject(
        supabase,
        BUCKET,
        currentPath,
        desiredPath
      );

      // Persist the new path; preserve original_filename (the user-uploaded name)
      // if it's empty by extracting from the old storage path.
      const patch: Record<string, unknown> = { original_file_url: finalPath };
      if (!inv.original_filename) {
        const oldBase = currentPath.split("/").pop() ?? currentPath;
        patch.original_filename = oldBase.replace(/^\d+_/, "");
      }
      const { error: updateError } = await supabase
        .from("invoices")
        .update(patch)
        .eq("id", inv.id);
      if (updateError) throw new Error(updateError.message);

      renamed += 1;
      console.log(`  ✓ ${currentPath}  →  ${finalPath}`);
    } catch (err) {
      failed += 1;
      console.log(`  ✗ ${currentPath} — ${err instanceof Error ? err.message : err}`);
    }
  }

  console.log("");
  console.log("─".repeat(70));
  console.log("Rename summary");
  console.log("─".repeat(70));
  console.log(`Renamed:  ${renamed}`);
  console.log(`Skipped (already clean): ${skipped}`);
  console.log(`Failed:   ${failed}`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
