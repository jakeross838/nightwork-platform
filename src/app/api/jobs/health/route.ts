import { NextRequest, NextResponse } from "next/server";
import { ApiError, withApiError } from "@/lib/api/errors";
import { getCurrentMembership } from "@/lib/org/session";
import { tryCreateServiceRoleClient } from "@/lib/supabase/service";

/**
 * GET /api/jobs/health
 *
 * Phase 8g — returns every job in the org enriched with health stats so the
 * job list can render colored health dots and quick stats without N+1 queries.
 *
 * Health rules:
 *   green  — variance < 5%, no overdue invoices, no attention items
 *   yellow — variance 5..15%, OR invoices pending 7+ days, OR 1-2 attention items
 *   red    — variance > 15%, OR invoices pending 14+ days, OR submitted draw 10+ days
 *            old, OR 3+ attention items
 */

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const PM_REVIEW_STATUSES = ["pm_review", "ai_processed"];
const COUNTING_INVOICE_STATUSES = [
  "pm_approved",
  "qa_review",
  "qa_approved",
  "pushed_to_qb",
  "in_draw",
  "paid",
];

export interface JobHealth {
  id: string;
  name: string;
  address: string | null;
  client_name: string | null;
  contract_type: string;
  original_contract_amount: number;
  current_contract_amount: number;
  contract_date: string | null;
  status: string;
  pm_id: string | null;
  pm_name: string | null;

  // Computed:
  health: "green" | "yellow" | "red";
  health_reasons: string[];
  pct_complete: number; // 0..100 (invoiced / revised_estimate sum)
  budget_used_pct: number; // 0..100
  open_invoices: number;
  oldest_invoice_days: number;
  last_activity_at: string | null;
  budget_total: number; // cents (revised)
  invoiced_total: number; // cents
}

export const GET = withApiError(async (_req: NextRequest) => {
  const membership = await getCurrentMembership();
  if (!membership) throw new ApiError("Not authenticated", 401);

  const supabase = tryCreateServiceRoleClient();
  if (!supabase) throw new ApiError("Service unavailable", 503);

  const orgId = membership.org_id;

  // 1. Jobs (all non-deleted)
  const { data: jobs, error: jobsErr } = await supabase
    .from("jobs")
    .select(
      "id, name, address, client_name, contract_type, original_contract_amount, current_contract_amount, contract_date, status, pm_id"
    )
    .eq("org_id", orgId)
    .is("deleted_at", null)
    .order("name");
  if (jobsErr) throw new ApiError(jobsErr.message, 500);
  const jobList = (jobs ?? []) as Array<JobHealth>;
  if (jobList.length === 0) return NextResponse.json([]);

  const jobIds = jobList.map((j) => j.id);

  // 2. PM names
  const pmIds = Array.from(new Set(jobList.map((j) => j.pm_id).filter(Boolean) as string[]));
  const pmNameMap = new Map<string, string>();
  if (pmIds.length > 0) {
    const { data: profileRows } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", pmIds);
    for (const p of (profileRows ?? []) as Array<{ id: string; full_name: string | null }>) {
      if (p.full_name) pmNameMap.set(p.id, p.full_name);
    }
  }

  // 3. Budget aggregates per job
  const { data: budgetLines } = await supabase
    .from("budget_lines")
    .select("job_id, revised_estimate, invoiced")
    .in("job_id", jobIds)
    .is("deleted_at", null);
  const budgetMap = new Map<string, { revised: number; invoiced: number }>();
  for (const line of (budgetLines ?? []) as Array<{
    job_id: string;
    revised_estimate: number | null;
    invoiced: number | null;
  }>) {
    const cur = budgetMap.get(line.job_id) ?? { revised: 0, invoiced: 0 };
    cur.revised += line.revised_estimate ?? 0;
    cur.invoiced += line.invoiced ?? 0;
    budgetMap.set(line.job_id, cur);
  }

  // 4. Invoice queue stats per job — open count + oldest age
  const { data: openInvoices } = await supabase
    .from("invoices")
    .select("job_id, received_date, status")
    .in("job_id", jobIds)
    .in("status", PM_REVIEW_STATUSES)
    .is("deleted_at", null);
  const openInvoiceMap = new Map<string, { count: number; oldestDays: number }>();
  for (const inv of (openInvoices ?? []) as Array<{
    job_id: string;
    received_date: string | null;
  }>) {
    const cur = openInvoiceMap.get(inv.job_id) ?? { count: 0, oldestDays: 0 };
    cur.count += 1;
    cur.oldestDays = Math.max(cur.oldestDays, daysSince(inv.received_date));
    openInvoiceMap.set(inv.job_id, cur);
  }

  // 5. Submitted draws older than threshold per job
  const { data: pendingDraws } = await supabase
    .from("draws")
    .select("job_id, submitted_at, updated_at, status")
    .in("job_id", jobIds)
    .eq("status", "submitted")
    .is("deleted_at", null);
  const pendingDrawAge = new Map<string, number>();
  for (const d of (pendingDraws ?? []) as Array<{
    job_id: string;
    submitted_at: string | null;
    updated_at: string | null;
  }>) {
    const age = daysSince(d.submitted_at ?? d.updated_at);
    const cur = pendingDrawAge.get(d.job_id) ?? 0;
    if (age > cur) pendingDrawAge.set(d.job_id, age);
  }

  // 6. Last activity per job — fetch from activity_log; we filter by entities
  // tied to the job (invoices, draws, POs, COs, budget_lines for the job).
  // To keep this fast, just look at the activity_log filtered by org and pull
  // the latest 200 entries; mapping requires join lookups.
  const { data: recentActivity } = await supabase
    .from("activity_log")
    .select("entity_type, entity_id, created_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(500);

  const lastActivityByJob = new Map<string, string>();
  if (recentActivity && recentActivity.length > 0) {
    // Resolve entity_id → job_id for invoices, draws, POs, COs, budget_lines.
    const allEntityIds = new Set<string>();
    for (const r of recentActivity as Array<{ entity_id: string | null }>) {
      if (r.entity_id) allEntityIds.add(r.entity_id);
    }
    if (allEntityIds.size > 0) {
      // Resolve in parallel for each entity type
      const lookups = await Promise.all([
        supabase.from("invoices").select("id, job_id").in("id", Array.from(allEntityIds)),
        supabase.from("draws").select("id, job_id").in("id", Array.from(allEntityIds)),
        supabase.from("purchase_orders").select("id, job_id").in("id", Array.from(allEntityIds)),
        supabase.from("change_orders").select("id, job_id").in("id", Array.from(allEntityIds)),
        supabase.from("budget_lines").select("id, job_id").in("id", Array.from(allEntityIds)),
      ]);
      const entityToJob = new Map<string, string>();
      for (const lk of lookups) {
        for (const row of (lk.data ?? []) as Array<{ id: string; job_id: string | null }>) {
          if (row.job_id) entityToJob.set(row.id, row.job_id);
        }
      }
      for (const r of recentActivity as Array<{
        entity_type: string;
        entity_id: string | null;
        created_at: string;
      }>) {
        if (r.entity_type === "job" && r.entity_id) {
          if (!lastActivityByJob.has(r.entity_id)) lastActivityByJob.set(r.entity_id, r.created_at);
        } else if (r.entity_id) {
          const jid = entityToJob.get(r.entity_id);
          if (jid && !lastActivityByJob.has(jid)) lastActivityByJob.set(jid, r.created_at);
        }
      }
    }
  }

  // Compute health
  const enriched: JobHealth[] = jobList.map((j) => {
    const budget = budgetMap.get(j.id) ?? { revised: 0, invoiced: 0 };
    const inv = openInvoiceMap.get(j.id) ?? { count: 0, oldestDays: 0 };
    const drawAge = pendingDrawAge.get(j.id) ?? 0;

    // Variance: if invoiced > revised → over budget (positive overrun pct)
    const variancePct = budget.revised > 0
      ? ((budget.invoiced - budget.revised) / budget.revised) * 100
      : 0;
    const budgetUsedPct = budget.revised > 0 ? (budget.invoiced / budget.revised) * 100 : 0;
    const pctComplete = budgetUsedPct;

    const reasons: string[] = [];
    let attentionCount = 0;
    if (variancePct > 15) {
      reasons.push(`Over budget by ${variancePct.toFixed(1)}%`);
      attentionCount += 2;
    } else if (variancePct > 5) {
      reasons.push(`Budget variance ${variancePct.toFixed(1)}%`);
      attentionCount += 1;
    }
    if (inv.oldestDays >= 14) {
      reasons.push(`Invoice pending ${inv.oldestDays} days`);
      attentionCount += 2;
    } else if (inv.oldestDays >= 7) {
      reasons.push(`Invoice pending ${inv.oldestDays} days`);
      attentionCount += 1;
    }
    if (drawAge >= 10) {
      reasons.push(`Submitted draw ${drawAge} days old`);
      attentionCount += 2;
    } else if (drawAge >= 5) {
      reasons.push(`Submitted draw ${drawAge} days old`);
      attentionCount += 1;
    }

    let health: "green" | "yellow" | "red" = "green";
    if (variancePct > 15 || inv.oldestDays >= 14 || drawAge >= 10 || attentionCount >= 3) {
      health = "red";
    } else if (variancePct > 5 || inv.oldestDays >= 7 || attentionCount >= 1) {
      health = "yellow";
    }

    return {
      ...j,
      pm_name: j.pm_id ? pmNameMap.get(j.pm_id) ?? null : null,
      health,
      health_reasons: reasons,
      pct_complete: Math.min(999, Math.max(0, pctComplete)),
      budget_used_pct: Math.min(999, Math.max(0, budgetUsedPct)),
      open_invoices: inv.count,
      oldest_invoice_days: inv.oldestDays,
      last_activity_at: lastActivityByJob.get(j.id) ?? null,
      budget_total: budget.revised,
      invoiced_total: budget.invoiced,
    };
  });

  return NextResponse.json(enriched);
});

function daysSince(d: string | null | undefined): number {
  if (!d) return 0;
  const dt = new Date(d.includes("T") ? d : d + "T00:00:00");
  if (isNaN(dt.getTime())) return 0;
  return Math.floor((Date.now() - dt.getTime()) / (1000 * 60 * 60 * 24));
}
