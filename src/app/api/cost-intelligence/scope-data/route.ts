import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { ApiError, withApiError } from "@/lib/api/errors";
import { getCurrentMembership } from "@/lib/org/session";

export const dynamic = "force-dynamic";

/**
 * GET /api/cost-intelligence/scope-data
 *
 * Returns vendor_item_pricing rows for scope items (items.pricing_model =
 * 'scope'), suitable for the scope data completion view.
 *
 * Query params:
 *   status: "incomplete" | "complete" | "all" (default "incomplete")
 *   job_id: filter to one job
 *   vendor_id: filter to one vendor
 *   item_id: filter to one item
 *   limit: max rows (default 200, hard cap 500)
 */
export const GET = withApiError(async (req: NextRequest) => {
  const membership = await getCurrentMembership();
  if (!membership) throw new ApiError("Not authenticated", 401);

  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? "incomplete";
  const jobId = url.searchParams.get("job_id");
  const vendorId = url.searchParams.get("vendor_id");
  const itemId = url.searchParams.get("item_id");
  const limitRaw = Number(url.searchParams.get("limit") ?? "200");
  const limit = Math.max(1, Math.min(500, Number.isFinite(limitRaw) ? limitRaw : 200));

  const supabase = createServerClient();

  // 1. Find scope items first.
  const { data: scopeItemsData, error: itemsErr } = await supabase
    .from("items")
    .select("id, canonical_name, scope_size_metric, category, subcategory, item_type")
    .eq("org_id", membership.org_id)
    .eq("pricing_model", "scope")
    .is("deleted_at", null);

  if (itemsErr) throw new ApiError(`items fetch: ${itemsErr.message}`, 500);

  const scopeItems = (scopeItemsData ?? []) as Array<{
    id: string;
    canonical_name: string;
    scope_size_metric: string | null;
    category: string | null;
    subcategory: string | null;
    item_type: string;
  }>;
  const scopeItemIds = scopeItems.map((i) => i.id);
  const itemById = new Map(scopeItems.map((i) => [i.id, i]));

  if (scopeItemIds.length === 0) {
    return NextResponse.json({ rows: [], total: 0, complete: 0, incomplete: 0 });
  }

  // 2. Pricing rows for those items.
  let query = supabase
    .from("vendor_item_pricing")
    .select(
      "id, item_id, vendor_id, job_id, total_cents, transaction_date, scope_size_value, scope_size_source, scope_size_confidence, scope_size_notes, source_doc_url, source_invoice_id"
    )
    .eq("org_id", membership.org_id)
    .in("item_id", scopeItemIds)
    .is("deleted_at", null)
    .order("transaction_date", { ascending: false })
    .limit(limit);

  if (status === "incomplete") query = query.is("scope_size_value", null);
  if (status === "complete") query = query.not("scope_size_value", "is", null);
  if (jobId) query = query.eq("job_id", jobId);
  if (vendorId) query = query.eq("vendor_id", vendorId);
  if (itemId) query = query.eq("item_id", itemId);

  const { data: pricingData, error: pricingErr } = await query;
  if (pricingErr) throw new ApiError(`pricing fetch: ${pricingErr.message}`, 500);

  const rows = (pricingData ?? []) as Array<{
    id: string;
    item_id: string;
    vendor_id: string;
    job_id: string | null;
    total_cents: number;
    transaction_date: string;
    scope_size_value: number | null;
    scope_size_source: string | null;
    scope_size_confidence: number | null;
    scope_size_notes: string | null;
    source_doc_url: string | null;
    source_invoice_id: string | null;
  }>;

  // 3. Hydrate vendor + job names.
  const vendorIds = Array.from(new Set(rows.map((r) => r.vendor_id)));
  const jobIds = Array.from(
    new Set(rows.map((r) => r.job_id).filter((x): x is string => !!x))
  );

  const [vendorsRes, jobsRes] = await Promise.all([
    vendorIds.length > 0
      ? supabase.from("vendors").select("id, name").in("id", vendorIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
    jobIds.length > 0
      ? supabase.from("jobs").select("id, name").in("id", jobIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
  ]);

  const vendorMap = new Map(
    ((vendorsRes.data ?? []) as Array<{ id: string; name: string }>).map((v) => [v.id, v.name])
  );
  const jobMap = new Map(
    ((jobsRes.data ?? []) as Array<{ id: string; name: string }>).map((j) => [j.id, j.name])
  );

  const hydrated = rows.map((r) => {
    const item = itemById.get(r.item_id);
    return {
      id: r.id,
      item_id: r.item_id,
      item_name: item?.canonical_name ?? "—",
      item_type: item?.item_type ?? null,
      category: item?.category ?? null,
      scope_size_metric: item?.scope_size_metric ?? null,
      vendor_id: r.vendor_id,
      vendor_name: vendorMap.get(r.vendor_id) ?? "—",
      job_id: r.job_id,
      job_name: r.job_id ? jobMap.get(r.job_id) ?? "—" : null,
      total_cents: r.total_cents,
      transaction_date: r.transaction_date,
      scope_size_value: r.scope_size_value,
      scope_size_source: r.scope_size_source,
      scope_size_confidence: r.scope_size_confidence,
      scope_size_notes: r.scope_size_notes,
      source_invoice_id: r.source_invoice_id,
      per_metric_cents:
        r.scope_size_value && r.scope_size_value > 0
          ? Math.round(r.total_cents / r.scope_size_value)
          : null,
    };
  });

  // Counts (across whole org, ignoring current filters) for KPI strip.
  const { count: completeTotal } = await supabase
    .from("vendor_item_pricing")
    .select("id", { count: "exact", head: true })
    .eq("org_id", membership.org_id)
    .in("item_id", scopeItemIds)
    .not("scope_size_value", "is", null)
    .is("deleted_at", null);
  const { count: incompleteTotal } = await supabase
    .from("vendor_item_pricing")
    .select("id", { count: "exact", head: true })
    .eq("org_id", membership.org_id)
    .in("item_id", scopeItemIds)
    .is("scope_size_value", null)
    .is("deleted_at", null);

  return NextResponse.json({
    rows: hydrated,
    total: (completeTotal ?? 0) + (incompleteTotal ?? 0),
    complete: completeTotal ?? 0,
    incomplete: incompleteTotal ?? 0,
  });
});
