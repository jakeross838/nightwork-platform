/**
 * Bulk invoice import.
 *
 * Usage:
 *   npm run bulk-import -- "C:\\Users\\Jake\\Downloads\\Test Invoices"
 *
 * Reads every PDF / DOCX / JPG / PNG from the given folder, runs each
 * through the same parse + save pipeline the UI uses
 * (`@/lib/invoices/parse-file` + `@/lib/invoices/save`), and writes the
 * result to Supabase.
 *
 * Auth: signs in as an admin so writes land under the admin RLS policies.
 * Credentials come from env (BULK_IMPORT_EMAIL / BULK_IMPORT_PASSWORD) with
 * dev-env defaults.
 *
 * Processes one file at a time to avoid tripping Claude's rate limits.
 * If a file fails, we log the error and continue.
 */

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import * as dotenv from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  fileKindFromExtension,
  mimeTypeForImageExtension,
  parseInvoiceFile,
  type FileKind,
} from "@/lib/invoices/parse-file";
import {
  saveParsedInvoice,
  type SaveInvoiceRequest,
} from "@/lib/invoices/save";

// Load .env.local first (Next.js convention), fall back to .env.
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const SUPPORTED_EXTENSIONS = new Set([".pdf", ".docx", ".jpg", ".jpeg", ".png"]);

type FailureRecord = { file: string; error: string };
type SuccessRecord = {
  file: string;
  id?: string;
  vendor: string;
  total: number; // cents
  confidence: number;
  duplicate?: boolean;
};

function fmtDollars(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function mimeTypeForKind(kind: FileKind, fileName: string): string {
  if (kind === "pdf") return "application/pdf";
  if (kind === "image") return mimeTypeForImageExtension(fileName);
  if (kind === "docx")
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  return "application/octet-stream";
}

async function signInAsAdmin(): Promise<SupabaseClient> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY. Check .env.local."
    );
  }
  const email = process.env.BULK_IMPORT_EMAIL ?? "jake@rossbuilt.com";
  const password = process.env.BULK_IMPORT_PASSWORD ?? "RossBuilt2026!";

  const supabase = createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    throw new Error(`Sign-in failed for ${email}: ${error?.message ?? "unknown"}`);
  }

  // Verify admin role — writing under a non-admin account would be allowed by
  // some RLS policies but silently blocked by others, so we fail loudly.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", data.user.id)
    .single();
  if (profile?.role !== "admin") {
    throw new Error(
      `Bulk import requires an admin user. ${email} has role: ${profile?.role ?? "unknown"}`
    );
  }
  console.log(`✓ Signed in as ${profile.full_name} (${email}, admin)\n`);

  return supabase;
}

async function uploadToStorage(
  supabase: SupabaseClient,
  fileName: string,
  buffer: Buffer,
  mediaType: string
): Promise<string> {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `uploads/${Date.now()}_${safeName}`;
  const { error } = await supabase.storage
    .from("invoice-files")
    .upload(storagePath, buffer, { contentType: mediaType, upsert: false });
  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }
  return storagePath;
}

async function processFile(
  supabase: SupabaseClient,
  folder: string,
  fileName: string
): Promise<SuccessRecord> {
  const fileKind = fileKindFromExtension(fileName);
  if (!fileKind || fileKind === "xlsx") {
    throw new Error(`Unsupported file kind for ${fileName}`);
  }

  const fullPath = path.join(folder, fileName);
  const buffer = await readFile(fullPath);
  const mediaType = mimeTypeForKind(fileKind, fileName);

  // 1. Upload to Supabase Storage (same path convention as the UI upload)
  const storagePath = await uploadToStorage(supabase, fileName, buffer, mediaType);

  // 2. Parse through Claude — identical logic to the /api/invoices/parse route
  const parsed = await parseInvoiceFile({
    buffer,
    mediaType,
    fileKind,
    fileName,
    supabase,
  });

  // 3. Save — identical logic to the /api/invoices/save route
  const req: SaveInvoiceRequest = {
    parsed,
    file_url: storagePath,
    file_name: fileName,
    file_type: fileKind,
  };
  const result = await saveParsedInvoice(supabase, req);

  if (result.duplicate) {
    return {
      file: fileName,
      vendor: parsed.vendor_name ?? "(unknown)",
      total: Math.round((parsed.total_amount ?? 0) * 100),
      confidence: parsed.confidence_score ?? 0,
      duplicate: true,
    };
  }

  return {
    file: fileName,
    id: result.id,
    vendor: parsed.vendor_name ?? "(unknown)",
    total: Math.round((parsed.total_amount ?? 0) * 100),
    confidence: parsed.confidence_score ?? 0,
  };
}

async function main() {
  const folderArg = process.argv[2];
  if (!folderArg) {
    console.error("Usage: npm run bulk-import -- <folder-path>");
    process.exit(1);
  }

  const folder = path.resolve(folderArg);
  console.log(`Bulk invoice import`);
  console.log(`Folder: ${folder}\n`);

  // Discover files
  const entries = await readdir(folder, { withFileTypes: true });
  const files = entries
    .filter((e) => e.isFile())
    .map((e) => e.name)
    .filter((name) =>
      SUPPORTED_EXTENSIONS.has(path.extname(name).toLowerCase())
    )
    .sort();

  if (files.length === 0) {
    console.log("No supported files (.pdf .docx .jpg .jpeg .png) found.");
    return;
  }

  console.log(`Found ${files.length} file${files.length === 1 ? "" : "s"} to process\n`);

  const supabase = await signInAsAdmin();

  const successes: SuccessRecord[] = [];
  const failures: FailureRecord[] = [];
  const startedAt = Date.now();

  for (let i = 0; i < files.length; i++) {
    const name = files[i];
    process.stdout.write(`Processing ${i + 1}/${files.length}: ${name}... `);
    try {
      const result = await processFile(supabase, folder, name);
      successes.push(result);
      const dupTag = result.duplicate ? " [DUPLICATE, skipped]" : "";
      console.log(
        `✓ Vendor: ${result.vendor} | ${fmtDollars(result.total)} | ${Math.round(result.confidence * 100)}% confidence${dupTag}`
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      failures.push({ file: name, error: message });
      console.log(`✗ ${message}`);
    }
  }

  // Summary
  const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
  const savedCount = successes.filter((s) => !s.duplicate).length;
  const dupCount = successes.filter((s) => s.duplicate).length;
  const totalCents = successes.reduce(
    (sum, s) => (s.duplicate ? sum : sum + s.total),
    0
  );
  const avgConfidence =
    successes.length > 0
      ? successes.reduce((sum, s) => sum + s.confidence, 0) / successes.length
      : 0;

  console.log("");
  console.log("─".repeat(70));
  console.log("Bulk import summary");
  console.log("─".repeat(70));
  console.log(`Files found:         ${files.length}`);
  console.log(`Saved:               ${savedCount}`);
  if (dupCount > 0) {
    console.log(`Duplicates skipped:  ${dupCount}`);
  }
  console.log(`Failed:              ${failures.length}`);
  console.log(`Total value saved:   ${fmtDollars(totalCents)}`);
  console.log(
    `Average confidence:  ${successes.length > 0 ? Math.round(avgConfidence * 100) : 0}%`
  );
  console.log(`Elapsed:             ${elapsedSec}s`);

  if (failures.length > 0) {
    console.log("");
    console.log("Failures:");
    for (const f of failures) {
      console.log(`  ✗ ${f.file}`);
      console.log(`    ${f.error}`);
    }
  }

  if (dupCount > 0) {
    console.log("");
    console.log("Duplicates (not inserted):");
    for (const s of successes.filter((x) => x.duplicate)) {
      console.log(`  · ${s.file} — ${s.vendor} ${fmtDollars(s.total)}`);
    }
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
