import { NextRequest, NextResponse } from "next/server";
import { ApiError, withApiError } from "@/lib/api/errors";
import {
  getCurrentMembership,
  getMembershipFromRequest,
} from "@/lib/org/session";
import { createServerClient } from "@/lib/supabase/server";
import { tryCreateServiceRoleClient } from "@/lib/supabase/service";
import { timed } from "@/lib/perf-log";

/**
 * GET /api/jobs/[id]/overview
 *
 * Single-round-trip batch endpoint for the job detail page. Collapses the
 * three independent client useEffects (page shell, financial bar, overview
 * cards) into one server-side Promise.all so the page stops waterfalling.
 *
 * Perf: every query runs in parallel. Counts via `head: true` avoid shipping
 * row data when only a count is needed.
 */

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
export const maxDuration = 30;

const SPENT_STATUSES = [
  "pm_approved",
  "qa_review",
  "qa_approved",
  "pushed_to_qb",
  "in_draw",
  "paid",
];

const PM_PENDING_STATUSES = ["received", "ai_processed", "pm_review"];

export const GET = withApiError(async (
  req: NextRequest,
  { params }: { params: { id: string } }
) => {
  const Tauth = Date.now();
  const membership = getMembershipFromRequest(req) ?? (await getCurrentMembership());
  if (!membership) throw new ApiError("Not authenticated", 401);
  if (process.env.PERF_LOG === "1") {
    console.log(`[perf] job-overview auth+membership: ${Date.now() - Tauth}ms`);
  }

  const supabase = tryCreateServiceRoleClient() ?? createServerClient();
  const orgId = membership.org_id;
  const jobId = params.id;
  const today = new Date().toISOString().slice(0, 10);
  const in30 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const T0 = Date.now();
  const [
    jobRes,
    usersRes,
    budgetLinesRes,
    billedInvoicesRes,
    pendingInvoicesRes,
    draftPosRes,
    pendingCosRes,
    pendingLiensRes,
    activityRes,
    upcomingPaymentsRes,
    budgetCountRes,
    orgProfilesRes,
  ] = await Promise.all([
    timed("job-overview", "jobs.by_id", false,
      supabase.from("jobs").select("*").eq("id", jobId).eq("org_id", orgId).is("deleted_at", null).maybeSingle()),
    timed("job-overview", "users.pm_admin", false,
      supabase.from("users").select("id, full_name").in("role", ["pm", "admin"]).is("deleted_at", null).order("full_name")),
    timed("job-overview", "budget_lines.by_job", false,
      supabase.from("budget_lines").select("id, revised_estimate, committed, invoiced")
        .eq("job_id", jobId).eq("org_id", orgId).is("deleted_at", null)),
    timed("job-overview", "invoices.billed", false,
      supabase.from("invoices").select("total_amount")
        .eq("job_id", jobId).eq("org_id", orgId).in("status", SPENT_STATUSES).is("deleted_at", null)),
    timed("job-overview", "invoices.pending", false,
      supabase.from("invoices").select("id, total_amount")
        .eq("job_id", jobId).eq("org_id", orgId).in("status", PM_PENDING_STATUSES).is("deleted_at", null)),
    timed("job-overview", "purchase_orders.draft", false,
      supabase.from("purchase_orders").select("id", { count: "exact", head: true })
        .eq("job_id", jobId).eq("org_id", orgId).eq("status", "draft").is("deleted_at", null)),
    timed("job-overview", "change_orders.pending", false,
      supabase.from("change_orders").select("id", { count: "exact", head: true })
        .eq("job_id", jobId).eq("org_id", orgId).in("status", ["draft", "pending"]).is("deleted_at", null)),
    timed("job-overview", "lien_releases.pending", false,
      supabase.from("lien_releases").select("id", { count: "exact", head: true })
        .eq("job_id", jobId).eq("org_id", orgId).eq("status", "pending").is("deleted_at", null)),
    timed("job-overview", "activity_log.job", false,
      supabase.from("activity_log")
        .select("id, created_at, entity_type, action, user_id, details")
        .eq("org_id", orgId).eq("entity_type", "job").eq("entity_id", jobId)
        .order("created_at", { ascending: false }).limit(10)),
    timed("job-overview", "invoices.upcoming_payments", false,
      supabase.from("invoices")
        .select("id, vendor_id, vendor_name_raw, total_amount, scheduled_payment_date, vendors:vendor_id(name)")
        .eq("job_id", jobId).eq("org_id", orgId)
        .not("scheduled_payment_date", "is", null)
        .gte("scheduled_payment_date", today)
        .lte("scheduled_payment_date", in30)
        .is("deleted_at", null).order("scheduled_payment_date")),
    timed("job-overview", "budget_lines.count", false,
      supabase.from("budget_lines").select("id", { count: "exact", head: true })
        .eq("job_id", jobId).eq("org_id", orgId).is("deleted_at", null)),
    timed("job-overview", "profiles.org_members", false,
      supabase.from("org_members")
        .select("user_id, profiles:user_id (id, full_name)")
        .eq("org_id", orgId).eq("is_active", true)),
  ]);
  if (process.env.PERF_LOG === "1") {
    console.log(`[perf] job-overview wave1 total: ${Date.now() - T0}ms`);
  }

  if (!jobRes.data) {
    throw new ApiError("Job not found", 404);
  }

  const job = jobRes.data as Record<string, unknown>;
  const original = (job.original_contract_amount as number) ?? 0;
  const approvedCos = (job.approved_cos_total as number) ?? 0;
  const revised = (job.current_contract_amount as number) ?? original + approvedCos;

  // Financial bar — billed + % complete + remaining.
  // Include pre-Nightwork baseline for mid-project imports.
  const baseline = (job.previous_certificates_total as number) ?? 0;
  const nightworkBilled = (billedInvoicesRes.data ?? []).reduce(
    (s: number, r: { total_amount?: number }) => s + (r.total_amount ?? 0), 0
  );
  const billed = baseline + nightworkBilled;
  const pendingInvoiceRows = (pendingInvoicesRes.data ?? []) as Array<{ total_amount: number }>;
  const pctComplete = revised > 0 ? Math.min(100, Math.max(0, (billed / revised) * 100)) : 0;

  // Budget health buckets
  let overBudget = 0, underCommitted = 0;
  const lines = (budgetLinesRes.data ?? []) as Array<{
    revised_estimate: number | null;
    committed: number | null;
    invoiced: number | null;
  }>;
  for (const l of lines) {
    const rev = l.revised_estimate ?? 0;
    const committed = l.committed ?? 0;
    const invoiced = l.invoiced ?? 0;
    if (rev > 0 && invoiced + committed > rev) overBudget += 1;
    if (rev > 0 && committed === 0) underCommitted += 1;
  }

  // Activity feed — resolve user names via prefetched org_members
  const nameById = new Map<string, string>();
  for (const raw of (orgProfilesRes.data ?? []) as Array<Record<string, unknown>>) {
    const profile = Array.isArray(raw.profiles) ? raw.profiles[0] : raw.profiles;
    const p = profile as { id?: string; full_name?: string | null } | null;
    if (p?.id && p.full_name) nameById.set(p.id, p.full_name);
  }
  const activity = ((activityRes.data ?? []) as Array<{
    id: string;
    created_at: string;
    entity_type: string;
    action: string;
    user_id: string | null;
    details: Record<string, unknown> | null;
  }>).map((a) => ({
    id: a.id,
    created_at: a.created_at,
    entity_type: a.entity_type,
    action: a.action,
    user_name: a.user_id ? nameById.get(a.user_id) ?? null : null,
    details: a.details,
  }));

  // Upcoming payments — flatten vendor join
  const payments = ((upcomingPaymentsRes.data ?? []) as Array<{
    id: string;
    vendor_id: string | null;
    vendor_name_raw: string | null;
    total_amount: number;
    scheduled_payment_date: string | null;
    vendors: { name: string } | { name: string }[] | null;
  }>).map((r) => {
    const vendorName = Array.isArray(r.vendors) ? r.vendors[0]?.name : r.vendors?.name;
    return {
      id: r.id,
      vendor_id: r.vendor_id,
      vendor_name: vendorName ?? null,
      vendor_name_raw: r.vendor_name_raw,
      total_amount: r.total_amount,
      scheduled_payment_date: r.scheduled_payment_date,
    };
  });

  const resp = NextResponse.json({
    membership_role: membership.role,
    job,
    pms: usersRes.data ?? [],
    financial_bar: {
      original_contract: original,
      approved_cos: approvedCos,
      revised_contract: revised,
      billed_to_date: billed,
      percent_complete: pctComplete,
      remaining: revised - billed,
    },
    overview_cards: {
      budget_health: {
        total_lines: lines.length,
        over_budget: overBudget,
        under_committed: underCommitted,
      },
      open_items: {
        pending_invoices_count: pendingInvoiceRows.length,
        pending_invoices_total: pendingInvoiceRows.reduce(
          (s, r) => s + (r.total_amount ?? 0), 0
        ),
        draft_pos: draftPosRes.count ?? 0,
        pending_cos: pendingCosRes.count ?? 0,
        pending_liens: pendingLiensRes.count ?? 0,
      },
      activity,
      payments,
    },
    budget_count: budgetCountRes.count ?? 0,
  });
  resp.headers.set("Cache-Control", "private, max-age=15, stale-while-revalidate=60");
  return resp;
});
