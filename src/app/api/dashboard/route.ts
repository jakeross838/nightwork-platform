import { NextRequest, NextResponse } from "next/server";
import { ApiError, withApiError } from "@/lib/api/errors";
import { getCurrentMembership } from "@/lib/org/session";
import { tryCreateServiceRoleClient } from "@/lib/supabase/service";

/**
 * GET /api/dashboard
 *
 * Phase 8g — single batch endpoint feeding the actionable dashboard:
 *   - top metrics (jobs, PM queue, draws, payments due)
 *   - "Needs Attention" prioritized action list
 *   - recent activity feed
 *   - cash flow summary with aging buckets
 *
 * Org-scoped via the current membership; service-role bypasses RLS so
 * aggregate counts succeed even under restrictive policies.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const PM_REVIEW_STATUSES = ["pm_review", "ai_processed"];
const APPROVED_NOT_PAID = ["pm_approved", "qa_review", "qa_approved", "pushed_to_qb", "in_draw"];
const COUNTING_INVOICE_STATUSES = [
  "pm_approved",
  "qa_review",
  "qa_approved",
  "pushed_to_qb",
  "in_draw",
  "paid",
];

interface AttentionItem {
  kind: string;
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  description: string;
  href: string;
  ageDays?: number;
}

interface ActivityEntry {
  id: string;
  user_name: string | null;
  entity_type: string;
  entity_id: string | null;
  action: string;
  details: Record<string, unknown> | null;
  created_at: string;
  job_name?: string | null;
  job_id?: string | null;
  link_href?: string;
}

export const GET = withApiError(async (_req: NextRequest) => {
  const membership = await getCurrentMembership();
  if (!membership) throw new ApiError("Not authenticated", 401);

  const supabase = tryCreateServiceRoleClient();
  if (!supabase) throw new ApiError("Service unavailable", 503);

  const orgId = membership.org_id;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  // ---------- METRICS ----------
  const [
    activeJobsRes,
    pmQueueRes,
    draftDrawsRes,
    submittedDrawsRes,
    paymentsDueRes,
  ] = await Promise.all([
    supabase
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("status", "active")
      .is("deleted_at", null),
    supabase
      .from("invoices")
      .select("id, received_date, status_history", { count: "exact" })
      .eq("org_id", orgId)
      .in("status", PM_REVIEW_STATUSES)
      .is("deleted_at", null),
    supabase
      .from("draws")
      .select("id, status, created_at, updated_at", { count: "exact" })
      .eq("org_id", orgId)
      .eq("status", "draft")
      .is("deleted_at", null),
    supabase
      .from("draws")
      .select("id, status, submitted_at, updated_at", { count: "exact" })
      .eq("org_id", orgId)
      .eq("status", "submitted")
      .is("deleted_at", null),
    supabase
      .from("invoices")
      .select("id, total_amount, received_date, payment_status, vendor_id, vendor_name_raw, invoice_number, job_id")
      .eq("org_id", orgId)
      .in("status", APPROVED_NOT_PAID)
      .is("deleted_at", null),
  ]);

  const pmQueueCount = pmQueueRes.count ?? 0;
  const pmQueueOldDays = ((pmQueueRes.data ?? []) as Array<{ received_date: string | null }>)
    .map((r) => daysSince(r.received_date))
    .reduce((max, d) => Math.max(max, d), 0);

  const draftDrawCount = draftDrawsRes.count ?? 0;
  const submittedDrawCount = submittedDrawsRes.count ?? 0;
  const submittedDrawsOldDays = ((submittedDrawsRes.data ?? []) as Array<{ submitted_at: string | null; updated_at: string | null }>)
    .map((d) => daysSince(d.submitted_at ?? d.updated_at))
    .reduce((max, d) => Math.max(max, d), 0);
  const openDrawsCount = draftDrawCount + submittedDrawCount;

  const paymentsDueRows = (paymentsDueRes.data ?? []) as Array<{
    id: string;
    total_amount: number | null;
    received_date: string | null;
    payment_status: string | null;
    vendor_id: string | null;
    vendor_name_raw: string | null;
    invoice_number: string | null;
    job_id: string | null;
  }>;
  // Only invoices NOT yet paid (payment_status missing or not "paid")
  const unpaidRows = paymentsDueRows.filter(
    (r) => r.payment_status !== "paid" && r.payment_status !== "void"
  );
  const paymentsDueCents = unpaidRows.reduce(
    (sum, r) => sum + (Number(r.total_amount) || 0),
    0
  );
  const paymentsOverdue30 = unpaidRows.some(
    (r) => daysSince(r.received_date) >= 30
  );

  // ---------- NEEDS ATTENTION ----------
  const attention: AttentionItem[] = [];

  // 1. PM-review invoices > 3 days
  for (const inv of (pmQueueRes.data ?? []) as Array<{
    id: string;
    received_date: string | null;
    status_history: unknown;
  }>) {
    const age = daysSince(inv.received_date);
    if (age >= 3) {
      attention.push({
        kind: "invoice_pm_review_old",
        severity: age >= 7 ? "critical" : age >= 5 ? "high" : "medium",
        title: "Invoice pending PM review",
        description: `Awaiting review for ${age} day${age === 1 ? "" : "s"}`,
        href: `/invoices/${inv.id}`,
        ageDays: age,
      });
    }
  }

  // 2. Draft draws > 7 days
  for (const dr of (draftDrawsRes.data ?? []) as Array<{
    id: string;
    created_at: string;
  }>) {
    const age = daysSince(dr.created_at);
    if (age >= 7) {
      attention.push({
        kind: "draw_draft_old",
        severity: age >= 14 ? "high" : "medium",
        title: "Draw in draft",
        description: `Created ${age} days ago and not submitted`,
        href: `/draws/${dr.id}`,
        ageDays: age,
      });
    }
  }

  // 3. Submitted draws unapproved 5+ days
  for (const dr of (submittedDrawsRes.data ?? []) as Array<{
    id: string;
    submitted_at: string | null;
    updated_at: string | null;
  }>) {
    const age = daysSince(dr.submitted_at ?? dr.updated_at);
    if (age >= 5) {
      attention.push({
        kind: "draw_submitted_pending",
        severity: age >= 10 ? "critical" : "high",
        title: "Submitted draw awaiting approval",
        description: `Pending owner approval for ${age} days`,
        href: `/draws/${dr.id}`,
        ageDays: age,
      });
    }
  }

  // 4. Potential duplicate invoices
  const { data: duplicateInvoices } = await supabase
    .from("invoices")
    .select("id, vendor_name_raw, invoice_number, total_amount, received_date")
    .eq("org_id", orgId)
    .eq("is_potential_duplicate", true)
    .is("duplicate_dismissed_at", null)
    .is("deleted_at", null)
    .limit(20);
  for (const inv of (duplicateInvoices ?? []) as Array<{
    id: string;
    vendor_name_raw: string | null;
    invoice_number: string | null;
    received_date: string | null;
  }>) {
    attention.push({
      kind: "invoice_duplicate",
      severity: "high",
      title: "Possible duplicate invoice",
      description: `${inv.vendor_name_raw ?? "Unknown vendor"} • ${inv.invoice_number ?? "no invoice #"}`,
      href: `/invoices/${inv.id}`,
      ageDays: daysSince(inv.received_date),
    });
  }

  // 5. Invoices missing required data (Unknown vendor or missing #)
  const { data: missingDataInvoices } = await supabase
    .from("invoices")
    .select("id, vendor_id, vendor_name_raw, invoice_number, received_date, status")
    .eq("org_id", orgId)
    .in("status", PM_REVIEW_STATUSES)
    .is("deleted_at", null)
    .limit(50);
  for (const inv of (missingDataInvoices ?? []) as Array<{
    id: string;
    vendor_id: string | null;
    vendor_name_raw: string | null;
    invoice_number: string | null;
    received_date: string | null;
  }>) {
    const noVendor =
      !inv.vendor_id ||
      (inv.vendor_name_raw ?? "").trim().toLowerCase() === "unknown" ||
      !inv.vendor_name_raw?.trim();
    const noNumber = !inv.invoice_number?.trim();
    if (noVendor || noNumber) {
      attention.push({
        kind: "invoice_missing_data",
        severity: "medium",
        title: noVendor ? "Invoice with unknown vendor" : "Invoice missing invoice #",
        description: noVendor
          ? "Assign a vendor before this can be approved"
          : `${inv.vendor_name_raw ?? "Vendor"} • assign an invoice number`,
        href: `/invoices/${inv.id}`,
        ageDays: daysSince(inv.received_date),
      });
    }
  }

  // 6. Over-budget lines (variance < 0)
  const { data: overBudget } = await supabase
    .from("budget_lines")
    .select("id, job_id, revised_estimate, invoiced, cost_codes(code, description), jobs(name)")
    .eq("org_id", orgId)
    .is("deleted_at", null)
    .limit(100);
  for (const raw of (overBudget ?? []) as unknown as Array<Record<string, unknown>>) {
    const line = {
      id: String(raw.id),
      job_id: String(raw.job_id),
      revised_estimate: typeof raw.revised_estimate === "number" ? raw.revised_estimate : null,
      invoiced: typeof raw.invoiced === "number" ? raw.invoiced : null,
      cost_codes: pickFirst(raw.cost_codes) as { code: string; description: string } | null,
      jobs: pickFirst(raw.jobs) as { name: string } | null,
    };
    const variance = (line.revised_estimate ?? 0) - (line.invoiced ?? 0);
    if (variance < 0) {
      attention.push({
        kind: "budget_overrun",
        severity: "high",
        title: "Over budget",
        description: `${line.jobs?.name ?? "Job"} • ${line.cost_codes?.code ?? ""} ${line.cost_codes?.description ?? ""} — ${formatCentsShort(Math.abs(variance))} over`,
        href: `/jobs/${line.job_id}/budget`,
      });
    }
  }

  // 7. POs nearly exhausted (<10% remaining)
  const { data: pos } = await supabase
    .from("purchase_orders")
    .select("id, job_id, po_number, amount, invoiced_total, status, vendors(name)")
    .eq("org_id", orgId)
    .in("status", ["issued", "partially_invoiced"])
    .is("deleted_at", null)
    .limit(100);
  for (const raw of (pos ?? []) as unknown as Array<Record<string, unknown>>) {
    const po = {
      id: String(raw.id),
      po_number: raw.po_number == null ? null : String(raw.po_number),
      amount: typeof raw.amount === "number" ? raw.amount : null,
      invoiced_total: typeof raw.invoiced_total === "number" ? raw.invoiced_total : null,
      vendors: pickFirst(raw.vendors) as { name: string } | null,
    };
    const total = po.amount ?? 0;
    const used = po.invoiced_total ?? 0;
    if (total > 0) {
      const remainingPct = ((total - used) / total) * 100;
      if (remainingPct >= 0 && remainingPct < 10) {
        attention.push({
          kind: "po_nearly_exhausted",
          severity: remainingPct < 5 ? "high" : "medium",
          title: "PO nearly exhausted",
          description: `${po.vendors?.name ?? "Vendor"} • PO ${po.po_number ?? ""} — ${remainingPct.toFixed(1)}% remaining`,
          href: `/purchase-orders/${po.id}`,
        });
      }
    }
  }

  // 8. Submitted draws missing lien releases
  const { data: submittedDrawsForLiens } = await supabase
    .from("draws")
    .select("id, job_id, draw_number, jobs(name)")
    .eq("org_id", orgId)
    .eq("status", "submitted")
    .is("deleted_at", null)
    .limit(20);
  for (const raw of (submittedDrawsForLiens ?? []) as unknown as Array<Record<string, unknown>>) {
    const dr = {
      id: String(raw.id),
      draw_number: typeof raw.draw_number === "number" ? raw.draw_number : Number(raw.draw_number) || 0,
      jobs: pickFirst(raw.jobs) as { name: string } | null,
    };
    const { count: lienCount } = await supabase
      .from("lien_releases")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("draw_id", dr.id)
      .is("deleted_at", null);
    if ((lienCount ?? 0) === 0) {
      attention.push({
        kind: "draw_missing_liens",
        severity: "medium",
        title: "Draw missing lien releases",
        description: `${dr.jobs?.name ?? "Job"} • Draw #${dr.draw_number}`,
        href: `/draws/${dr.id}`,
      });
    }
  }

  // Sort by severity then age
  const SEVERITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  attention.sort((a, b) => {
    const sevDiff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (sevDiff !== 0) return sevDiff;
    return (b.ageDays ?? 0) - (a.ageDays ?? 0);
  });

  const attentionTotal = attention.length;
  const attentionTop = attention.slice(0, 10);

  // ---------- ACTIVITY FEED ----------
  const { data: activityRows } = await supabase
    .from("activity_log")
    .select("id, entity_type, entity_id, action, details, created_at, user_id")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(20);

  const userIds = Array.from(
    new Set(((activityRows ?? []) as Array<{ user_id: string | null }>).map((r) => r.user_id).filter(Boolean) as string[])
  );
  const userNameMap = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: profileRows } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);
    for (const p of (profileRows ?? []) as Array<{ id: string; full_name: string | null }>) {
      if (p.full_name) userNameMap.set(p.id, p.full_name);
    }
  }

  // Resolve job names for entities tied to a job
  const invoiceIds = ((activityRows ?? []) as Array<{ entity_type: string; entity_id: string | null }>)
    .filter((r) => r.entity_type === "invoice" && r.entity_id)
    .map((r) => r.entity_id as string);
  const drawIds = ((activityRows ?? []) as Array<{ entity_type: string; entity_id: string | null }>)
    .filter((r) => r.entity_type === "draw" && r.entity_id)
    .map((r) => r.entity_id as string);
  const jobMap = new Map<string, { id: string; name: string }>();

  if (invoiceIds.length > 0) {
    const { data: invRows } = await supabase
      .from("invoices")
      .select("id, jobs(id, name)")
      .in("id", invoiceIds);
    for (const raw of (invRows ?? []) as unknown as Array<Record<string, unknown>>) {
      const job = pickFirst(raw.jobs) as { id: string; name: string } | null;
      if (job) jobMap.set(`invoice:${String(raw.id)}`, job);
    }
  }
  if (drawIds.length > 0) {
    const { data: dRows } = await supabase
      .from("draws")
      .select("id, jobs(id, name)")
      .in("id", drawIds);
    for (const raw of (dRows ?? []) as unknown as Array<Record<string, unknown>>) {
      const job = pickFirst(raw.jobs) as { id: string; name: string } | null;
      if (job) jobMap.set(`draw:${String(raw.id)}`, job);
    }
  }

  const activity: ActivityEntry[] = ((activityRows ?? []) as Array<{
    id: string;
    entity_type: string;
    entity_id: string | null;
    action: string;
    details: Record<string, unknown> | null;
    created_at: string;
    user_id: string | null;
  }>).map((r) => {
    const job = r.entity_id ? jobMap.get(`${r.entity_type}:${r.entity_id}`) ?? null : null;
    let href = "";
    if (r.entity_id) {
      switch (r.entity_type) {
        case "invoice": href = `/invoices/${r.entity_id}`; break;
        case "draw": href = `/draws/${r.entity_id}`; break;
        case "purchase_order": href = `/purchase-orders/${r.entity_id}`; break;
        case "change_order": href = `/change-orders/${r.entity_id}`; break;
        case "vendor": href = `/vendors/${r.entity_id}`; break;
        case "job": href = `/jobs/${r.entity_id}`; break;
      }
    }
    return {
      id: r.id,
      user_name: r.user_id ? userNameMap.get(r.user_id) ?? "Team member" : "System",
      entity_type: r.entity_type,
      entity_id: r.entity_id,
      action: r.action,
      details: r.details,
      created_at: r.created_at,
      job_name: job?.name ?? null,
      job_id: job?.id ?? null,
      link_href: href || undefined,
    };
  });

  // ---------- CASH FLOW SUMMARY ----------
  const { data: monthInvoiced } = await supabase
    .from("invoices")
    .select("total_amount")
    .eq("org_id", orgId)
    .gte("created_at", monthStart)
    .in("status", COUNTING_INVOICE_STATUSES)
    .is("deleted_at", null);
  const totalInvoicedThisMonth = ((monthInvoiced ?? []) as Array<{ total_amount: number | null }>)
    .reduce((sum, r) => sum + (Number(r.total_amount) || 0), 0);

  const { data: monthPaid } = await supabase
    .from("invoices")
    .select("total_amount, payment_amount")
    .eq("org_id", orgId)
    .eq("payment_status", "paid")
    .gte("updated_at", monthStart)
    .is("deleted_at", null);
  const totalPaidThisMonth = ((monthPaid ?? []) as Array<{ total_amount: number | null; payment_amount: number | null }>)
    .reduce((sum, r) => sum + (Number(r.payment_amount ?? r.total_amount) || 0), 0);

  // Aging buckets — uses received_date as proxy for invoice age
  const aging = { current: 0, d30: 0, d60: 0, d90: 0 };
  for (const r of unpaidRows) {
    const age = daysSince(r.received_date);
    const cents = Number(r.total_amount) || 0;
    if (age < 30) aging.current += cents;
    else if (age < 60) aging.d30 += cents;
    else if (age < 90) aging.d60 += cents;
    else aging.d90 += cents;
  }

  // Upcoming = open POs minus invoiced
  const { data: openPosForCash } = await supabase
    .from("purchase_orders")
    .select("amount, invoiced_total")
    .eq("org_id", orgId)
    .in("status", ["issued", "partially_invoiced"])
    .is("deleted_at", null);
  const upcomingCommitted = ((openPosForCash ?? []) as Array<{ amount: number | null; invoiced_total: number | null }>)
    .reduce((sum, r) => sum + Math.max(0, (r.amount ?? 0) - (r.invoiced_total ?? 0)), 0);

  return NextResponse.json({
    metrics: {
      activeJobs: activeJobsRes.count ?? 0,
      pmQueueCount,
      pmQueueOldDays,
      openDrawsCount,
      submittedDrawsOldDays,
      paymentsDueCents,
      paymentsOverdue30,
    },
    attention: {
      total: attentionTotal,
      items: attentionTop,
    },
    activity,
    cashFlow: {
      monthInvoiced: totalInvoicedThisMonth,
      monthPaid: totalPaidThisMonth,
      monthNet: totalInvoicedThisMonth - totalPaidThisMonth,
      outstandingTotal: paymentsDueCents,
      aging,
      upcomingCommitted,
    },
  });
});

function daysSince(d: string | null | undefined): number {
  if (!d) return 0;
  const dt = new Date(d.includes("T") ? d : d + "T00:00:00");
  if (isNaN(dt.getTime())) return 0;
  return Math.floor((Date.now() - dt.getTime()) / (1000 * 60 * 60 * 24));
}

/** Supabase joins return arrays in some cases — pick the first row defensively. */
function pickFirst(value: unknown): unknown {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function formatCentsShort(cents: number): string {
  const dollars = cents / 100;
  if (dollars >= 1000) return `$${(dollars / 1000).toFixed(1)}k`;
  return `$${dollars.toFixed(0)}`;
}
