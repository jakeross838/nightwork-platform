/**
 * Lien release helpers — Phase 8.
 *
 * One lien release per vendor per draw. Auto-generated when a draw moves
 * draft → submitted (one progress release per vendor). On the final draw,
 * the default type flips to unconditional_final.
 *
 * All writes use the service-role client so they can run from API routes.
 */

import { createServiceRoleClient } from "@/lib/supabase/service";

export interface LienReleaseSeed {
  vendor_id: string;
  amount: number;
  draw_id: string;
  job_id: string;
  org_id: string;
  release_type: string;
  through_date: string | null;
  created_by: string | null;
}

/**
 * Create one pending lien release per vendor represented in the draw. If a
 * release already exists for that (draw_id, vendor_id) pair, skip (idempotent).
 *
 * Returns how many new records were inserted.
 */
export async function autoGenerateLienReleases(args: {
  draw_id: string;
  job_id: string;
  org_id: string;
  isFinal: boolean;
  through_date: string | null;
  created_by: string | null;
}): Promise<number> {
  const supabase = createServiceRoleClient();
  const { draw_id, job_id, org_id, isFinal, through_date, created_by } = args;

  // 1. Get every invoice in this draw with vendor + amount.
  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, vendor_id, total_amount")
    .eq("draw_id", draw_id)
    .is("deleted_at", null);

  if (!invoices || invoices.length === 0) return 0;

  // 2. Sum by vendor.
  const byVendor = new Map<string, number>();
  for (const inv of invoices) {
    const vid = (inv as { vendor_id: string | null }).vendor_id;
    if (!vid) continue;
    const amt = (inv as { total_amount: number }).total_amount ?? 0;
    byVendor.set(vid, (byVendor.get(vid) ?? 0) + amt);
  }
  if (byVendor.size === 0) return 0;

  // 3. Find existing releases for this draw so we don't duplicate.
  const { data: existing } = await supabase
    .from("lien_releases")
    .select("vendor_id")
    .eq("draw_id", draw_id)
    .is("deleted_at", null);
  const existingVendorIds = new Set(
    (existing ?? []).map((r) => (r as { vendor_id: string | null }).vendor_id).filter(Boolean)
  );

  const release_type = isFinal ? "unconditional_final" : "conditional_progress";

  const rows: Record<string, unknown>[] = [];
  for (const [vendor_id, amount] of Array.from(byVendor.entries())) {
    if (existingVendorIds.has(vendor_id)) continue;
    rows.push({
      org_id,
      job_id,
      vendor_id,
      draw_id,
      release_type,
      amount,
      status: "pending",
      through_date,
      created_by,
    });
  }
  if (rows.length === 0) return 0;

  const { error, data: inserted } = await supabase
    .from("lien_releases")
    .insert(rows)
    .select("id");

  if (error) {
    console.warn(`[lien-releases] insert failed: ${error.message}`);
    return 0;
  }
  return inserted?.length ?? 0;
}

/**
 * Count pending lien releases that would block draw approval. Returns both
 * the count and the list of blocking vendor_ids for a richer error message.
 */
export async function pendingReleaseBlockers(
  draw_id: string
): Promise<{ count: number; total: number }> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("lien_releases")
    .select("id, status")
    .eq("draw_id", draw_id)
    .is("deleted_at", null);
  const rows = data ?? [];
  const pending = rows.filter((r) => r.status === "pending").length;
  return { count: pending, total: rows.length };
}

/**
 * Phase 8f Part F: count releases that need a document attached. A release
 * needs a document when its status is pending OR received AND document_url
 * is empty.
 */
export async function missingDocumentBlockers(
  draw_id: string
): Promise<{ missing: number; total: number; vendors: string[] }> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("lien_releases")
    .select("id, status, document_url, vendors:vendor_id (name)")
    .eq("draw_id", draw_id)
    .is("deleted_at", null);
  const rows = (data ?? []) as Array<{
    id: string;
    status: string;
    document_url: string | null;
    vendors: { name?: string } | { name?: string }[] | null;
  }>;
  const totalRequired = rows.filter((r) => r.status !== "waived" && r.status !== "not_required");
  const missing = totalRequired.filter((r) => !r.document_url);
  const vendorNames = missing
    .map((r) => {
      const v = Array.isArray(r.vendors) ? r.vendors[0] : r.vendors;
      return v?.name ?? null;
    })
    .filter((n): n is string => !!n);
  return { missing: missing.length, total: totalRequired.length, vendors: vendorNames };
}

/** Mark all releases for a draw as not_required (used when draw is voided). */
export async function markDrawReleasesNotRequired(draw_id: string): Promise<void> {
  const supabase = createServiceRoleClient();
  await supabase
    .from("lien_releases")
    .update({ status: "not_required" })
    .eq("draw_id", draw_id)
    .eq("status", "pending");
}
