/**
 * One-time rematch: re-run job matching on every unmatched invoice using
 * the improved matcher in `/lib/invoices/job-matcher.ts`.
 *
 * Usage:
 *   npm run rematch-jobs
 *
 * For each invoice with `job_id IS NULL`:
 *   - Re-run the matcher over job_reference_raw, po_reference_raw,
 *     vendor_name_raw, description, and the filename (derived from
 *     original_filename or the original_file_url storage path).
 *   - If a match is found, update job_id + assigned_pm_id (from the
 *     job's pm_id) and append a status_history entry explaining how
 *     we matched.
 *   - If no match is found, check the overhead detector and set
 *     document_category accordingly.
 *
 * Failures on any single invoice do NOT abort the run.
 */

import path from "node:path";
import * as dotenv from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  detectOverhead,
  loadJobCandidates,
  matchJobForInvoice,
  type JobCandidate,
  type MatchResult,
} from "@/lib/invoices/job-matcher";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

interface InvoiceRow {
  id: string;
  vendor_name_raw: string | null;
  job_reference_raw: string | null;
  po_reference_raw: string | null;
  description: string | null;
  original_filename: string | null;
  original_file_url: string | null;
  total_amount: number;
  document_category: string | null;
  status_history: unknown;
  confidence_details: Record<string, unknown> | null;
}

function fmtDollars(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

/**
 * The storage key for uploaded files is `uploads/<timestamp>_<sanitized-name>`.
 * Strip the prefix so the matcher can look at the original filename.
 */
function filenameFromFileUrl(fileUrl: string | null): string | null {
  if (!fileUrl) return null;
  const base = fileUrl.split("/").pop() ?? fileUrl;
  const stripped = base.replace(/^\d+_/, "");
  return stripped || null;
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
    throw new Error(`Rematch requires admin. ${email} has role: ${profile?.role}`);
  }
  console.log(`✓ Signed in as ${profile.full_name} (${email}, admin)\n`);
  return supabase;
}

async function loadUnmatched(supabase: SupabaseClient): Promise<InvoiceRow[]> {
  const { data, error } = await supabase
    .from("invoices")
    .select(
      "id, vendor_name_raw, job_reference_raw, po_reference_raw, description, original_filename, original_file_url, total_amount, document_category, status_history, confidence_details"
    )
    .is("deleted_at", null)
    .is("job_id", null)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Failed to load invoices: ${error.message}`);
  return (data ?? []) as InvoiceRow[];
}

async function updateMatched(
  supabase: SupabaseClient,
  invoice: InvoiceRow,
  match: MatchResult,
  filename: string | null
) {
  const history = Array.isArray(invoice.status_history)
    ? (invoice.status_history as unknown[])
    : [];
  const entry = {
    who: "system",
    when: new Date().toISOString(),
    old_status: "unmatched",
    new_status: "job_matched",
    note: `Rematch: job auto-matched to ${match.job.name} (score ${match.score}: ${match.reasons.join("; ")}${match.ambiguous ? "; flagged as ambiguous" : ""}).`,
  };

  const newConfDetails = {
    ...(invoice.confidence_details ?? {}),
    job_match: {
      score: match.score,
      reasons: match.reasons,
      ambiguous: match.ambiguous,
      rematched: true,
    },
    auto_fills: {
      ...(((invoice.confidence_details ?? {}) as Record<string, unknown>).auto_fills as
        | Record<string, unknown>
        | undefined),
      job_id: true,
    },
  };

  const patch: Record<string, unknown> = {
    job_id: match.job.id,
    assigned_pm_id: match.job.pm_id ?? null,
    status_history: [...history, entry],
    confidence_details: newConfDetails,
  };
  // Also backfill the filename if we now have one.
  if (filename && !invoice.original_filename) {
    patch.original_filename = filename;
  }

  const { error } = await supabase.from("invoices").update(patch).eq("id", invoice.id);
  if (error) throw new Error(error.message);
}

async function updateOverhead(
  supabase: SupabaseClient,
  invoice: InvoiceRow,
  reason: string,
  filename: string | null
) {
  const history = Array.isArray(invoice.status_history)
    ? (invoice.status_history as unknown[])
    : [];
  const entry = {
    who: "system",
    when: new Date().toISOString(),
    old_status: "unmatched",
    new_status: "overhead_flagged",
    note: `Rematch: flagged as overhead expense — ${reason}.`,
  };
  const newConfDetails = {
    ...(invoice.confidence_details ?? {}),
    overhead_reason: reason,
  };

  const patch: Record<string, unknown> = {
    document_category: "overhead",
    status_history: [...history, entry],
    confidence_details: newConfDetails,
  };
  if (filename && !invoice.original_filename) {
    patch.original_filename = filename;
  }
  const { error } = await supabase.from("invoices").update(patch).eq("id", invoice.id);
  if (error) throw new Error(error.message);
}

async function main() {
  console.log("Job rematch — improved matcher + overhead detection\n");
  const supabase = await signInAsAdmin();

  const jobs: JobCandidate[] = await loadJobCandidates(supabase);
  console.log(`Loaded ${jobs.length} job candidates:`);
  for (const j of jobs) {
    console.log(
      `  · ${j.name} — ${j.address ?? "(no address)"} · ${j.client_name ?? "(no client)"}`
    );
  }
  console.log("");

  const unmatched = await loadUnmatched(supabase);
  console.log(`Unmatched invoices: ${unmatched.length}\n`);

  let matched = 0;
  let flaggedOverhead = 0;
  let noAction = 0;
  let failed = 0;
  const stillUnmatched: InvoiceRow[] = [];

  for (const inv of unmatched) {
    const filename = inv.original_filename ?? filenameFromFileUrl(inv.original_file_url);
    const signals = {
      job_reference_raw: inv.job_reference_raw,
      po_reference_raw: inv.po_reference_raw,
      vendor_name_raw: inv.vendor_name_raw,
      description: inv.description,
      filename,
    };
    const match = matchJobForInvoice(jobs, signals);
    const label = `${inv.vendor_name_raw ?? "(unknown)"} ${fmtDollars(inv.total_amount)}`;

    if (match) {
      try {
        await updateMatched(supabase, inv, match, filename);
        matched += 1;
        const amb = match.ambiguous ? " [AMBIGUOUS]" : "";
        console.log(
          `  ✓ ${label} → matched to ${match.job.name} via ${match.reasons[0]}${amb}`
        );
      } catch (err) {
        failed += 1;
        console.log(`  ✗ ${label} → update failed: ${err instanceof Error ? err.message : err}`);
      }
      continue;
    }

    // No match — try overhead
    const overhead = detectOverhead(signals);
    if (overhead.isOverhead && overhead.reason) {
      if (inv.document_category === "overhead") {
        // Already flagged, nothing to do
        noAction += 1;
        console.log(`  · ${label} → already flagged as overhead`);
        continue;
      }
      try {
        await updateOverhead(supabase, inv, overhead.reason, filename);
        flaggedOverhead += 1;
        console.log(`  ◆ ${label} → flagged overhead (${overhead.reason})`);
      } catch (err) {
        failed += 1;
        console.log(`  ✗ ${label} → overhead update failed: ${err instanceof Error ? err.message : err}`);
      }
      continue;
    }

    // Truly no match, not overhead — leave as-is
    stillUnmatched.push(inv);
    console.log(`  - ${label} → no match found`);
  }

  console.log("");
  console.log("─".repeat(70));
  console.log("Rematch summary");
  console.log("─".repeat(70));
  console.log(`Unmatched to start:  ${unmatched.length}`);
  console.log(`Newly job-matched:   ${matched}`);
  console.log(`Flagged overhead:    ${flaggedOverhead}`);
  console.log(`Already flagged:     ${noAction}`);
  console.log(`Still unmatched:     ${stillUnmatched.length}`);
  console.log(`Failed to update:    ${failed}`);

  if (stillUnmatched.length > 0) {
    console.log("");
    console.log("Still unmatched (no job, not overhead):");
    for (const inv of stillUnmatched) {
      const filename = inv.original_filename ?? filenameFromFileUrl(inv.original_file_url);
      console.log(
        `  · ${inv.vendor_name_raw ?? "(unknown)"} ${fmtDollars(inv.total_amount)}`
      );
      console.log(`      job_ref: ${inv.job_reference_raw ?? "—"}`);
      console.log(`      file:    ${filename ?? "—"}`);
    }
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
