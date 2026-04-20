import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { ApiError, withApiError } from "@/lib/api/errors";
import { getCurrentMembership } from "@/lib/org/session";
import { logActivity } from "@/lib/activity-log";
import { recalcBudgetLine, recalcBudgetTotals } from "@/lib/recalc";

export const dynamic = "force-dynamic";

interface PostBody {
  job_id: string;
  cost_code_id: string;
  original_estimate?: number;
  description?: string | null;
  notes?: string | null;
  is_allowance?: boolean;
}

/**
 * POST /api/budget-lines
 *
 * Phase 8d — inline "+ Add line" flow. Creates one budget_line on the given
 * job for the given cost_code. Requires admin/owner. If a budget_line
 * already exists (same job, same cost_code, not soft-deleted), returns a
 * conflict so the caller can focus the existing row instead of inserting a
 * duplicate.
 */
export const POST = withApiError(async (request: NextRequest) => {
  const membership = await getCurrentMembership();
  if (!membership) throw new ApiError("Not authenticated", 401);
  if (!["owner", "admin"].includes(membership.role)) {
    throw new ApiError("Only admins can add budget lines", 403);
  }

  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const body: PostBody = await request.json();

  if (!body.job_id) throw new ApiError("Missing job_id", 400);
  if (!body.cost_code_id) throw new ApiError("Missing cost_code_id", 400);
  const original = Math.max(0, Math.round(body.original_estimate ?? 0));

  // Dedup: one budget_line per (job, cost_code) in the active set.
  const { data: existing } = await supabase
    .from("budget_lines")
    .select("id")
    .eq("job_id", body.job_id)
    .eq("cost_code_id", body.cost_code_id)
    .is("deleted_at", null)
    .maybeSingle();
  if (existing) {
    throw new ApiError(
      "A budget line for that cost code already exists on this job",
      409
    );
  }

  // Find a budget_id if the job already has one (budgets table is the
  // parent container; some phases wire it, some don't). Use the first
  // active budget if present; otherwise leave null (budget_lines.budget_id
  // is nullable).
  const { data: budgetRow } = await supabase
    .from("budgets")
    .select("id")
    .eq("job_id", body.job_id)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();

  const { data: inserted, error } = await supabase
    .from("budget_lines")
    .insert({
      job_id: body.job_id,
      cost_code_id: body.cost_code_id,
      original_estimate: original,
      revised_estimate: original, // COs will adjust later
      previous_applications_baseline: 0,
      co_adjustments: 0,
      committed: 0,
      invoiced: 0,
      is_allowance: !!body.is_allowance,
      description: body.description ?? null,
      notes: body.notes ?? null,
      budget_id: (budgetRow as { id?: string } | null)?.id ?? null,
      org_id: membership.org_id,
      created_by: user?.id ?? null,
    })
    .select("id, budget_id")
    .single();
  if (error) throw new ApiError(error.message, 500);

  // Trigger a recalc so committed/invoiced stay at 0 (noop but idempotent)
  // and ensure budget totals stay in sync.
  await recalcBudgetLine((inserted as { id: string }).id);
  const budgetId = (inserted as { budget_id?: string | null }).budget_id;
  if (budgetId) await recalcBudgetTotals(budgetId);

  await logActivity({
    org_id: membership.org_id,
    user_id: user?.id ?? null,
    entity_type: "budget_line",
    entity_id: (inserted as { id: string }).id,
    action: "created",
    details: {
      job_id: body.job_id,
      cost_code_id: body.cost_code_id,
      original_estimate: original,
    },
  });

  return NextResponse.json({ id: (inserted as { id: string }).id });
});
