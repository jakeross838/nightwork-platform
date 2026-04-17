import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { ApiError, withApiError } from "@/lib/api/errors";
import { getCurrentMembership } from "@/lib/org/session";
import { checkPlanLimit, planDisplayName } from "@/lib/plan-limits";
import { recalcDraftDrawsForJob } from "@/lib/draw-calc";
import { logActivity } from "@/lib/activity-log";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

type JobBody = {
  name?: string;
  address?: string | null;
  client_name?: string | null;
  client_email?: string | null;
  client_phone?: string | null;
  contract_type?: "cost_plus" | "fixed";
  original_contract_amount?: number; // cents
  deposit_percentage?: number;       // 0..100 (whole percent, e.g. 10 = 10%)
  gc_fee_percentage?: number;        // 0..100 (whole percent)
  retainage_percent?: number;        // 0..100 (whole percent, e.g. 10 = 10%)
  // Phase D baseline fields — how much of the job's history predates Nightwork.
  starting_application_number?: number;  // 1-based; default 1 = Nightwork's first draw is App #1
  previous_certificates_total?: number;  // cents — pre-Nightwork certified payments
  previous_change_orders_total?: number; // cents — pre-Nightwork net CO total (incl. fees)
  pm_id?: string | null;
  contract_date?: string | null;     // YYYY-MM-DD
  status?: "active" | "complete" | "warranty" | "cancelled";
};

export const POST = withApiError(async (request: NextRequest) => {
  const supabase = createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new ApiError("Not authenticated", 401);

  const membership = await getCurrentMembership();
  if (!membership) throw new ApiError("No active organization", 403);
  if (membership.role !== "admin" && membership.role !== "owner") {
    throw new ApiError("Only admins can create jobs", 403);
  }

  const body: JobBody = await request.json();

  if (!body.name || !body.name.trim()) {
    throw new ApiError("Job name is required", 400);
  }
  if (body.contract_type && !["cost_plus", "fixed"].includes(body.contract_type)) {
    throw new ApiError("Invalid contract_type", 400);
  }
  if (body.status && !["active", "complete", "warranty", "cancelled"].includes(body.status)) {
    throw new ApiError("Invalid status", 400);
  }

  // Only active jobs count toward the plan limit — completed/warranty/cancelled
  // don't consume a slot. We only need to guard creation when the new job will
  // actually be active; completed-at-creation is a rare import path.
  const incomingStatus = body.status ?? "active";
  if (incomingStatus === "active") {
    const jobsCheck = await checkPlanLimit(membership.org_id, "active_jobs");
    if (!jobsCheck.allowed) {
      throw new ApiError(
        `You've reached your active job limit (${jobsCheck.current} of ${jobsCheck.limit}) on ${planDisplayName(jobsCheck.plan)}. Upgrade your plan or complete an existing job to start a new one.`,
        402
      );
    }
  }

  const original = Math.max(0, Math.round(body.original_contract_amount ?? 0));

  // Inherit org's default retainage when caller doesn't override it. Ross
  // Built's org default is 0; new orgs default to 10.
  let retainageToUse: number | undefined;
  if (body.retainage_percent !== undefined) {
    retainageToUse = Number(body.retainage_percent);
  } else {
    const { data: orgRow } = await supabase
      .from("organizations")
      .select("default_retainage_percent")
      .eq("id", membership.org_id)
      .maybeSingle();
    const dflt =
      (orgRow as { default_retainage_percent?: number } | null)?.default_retainage_percent;
    if (dflt !== undefined && dflt !== null) retainageToUse = Number(dflt);
  }

  const { data, error } = await supabase
    .from("jobs")
    .insert({
      name: body.name.trim(),
      address: body.address ?? null,
      client_name: body.client_name ?? null,
      client_email: body.client_email ?? null,
      client_phone: body.client_phone ?? null,
      contract_type: body.contract_type ?? "cost_plus",
      original_contract_amount: original,
      current_contract_amount: original, // start equal; COs adjust later
      deposit_percentage: body.deposit_percentage ?? 10,
      gc_fee_percentage: body.gc_fee_percentage ?? 20,
      ...(retainageToUse !== undefined ? { retainage_percent: retainageToUse } : {}),
      pm_id: body.pm_id ?? null,
      contract_date: body.contract_date ?? null,
      status: body.status ?? "active",
      org_id: membership.org_id,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) throw new ApiError(error.message, 500);

  return NextResponse.json({ id: data.id });
});

export const PATCH = withApiError(async (request: NextRequest) => {
  const supabase = createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new ApiError("Not authenticated", 401);

  const membership = await getCurrentMembership();
  if (!membership || (membership.role !== "admin" && membership.role !== "owner")) {
    throw new ApiError("Only admins can edit jobs", 403);
  }

  const body: JobBody & { id: string } = await request.json();
  if (!body.id) throw new ApiError("Missing job id", 400);

  // Read current value so we can detect an actual retainage change and
  // cascade it to draft draws. Also used for activity-log deltas.
  const { data: existing } = await supabase
    .from("jobs")
    .select("retainage_percent, org_id")
    .eq("id", body.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!existing) throw new ApiError("Job not found", 404);
  const previousRetainage = Number(
    (existing as { retainage_percent?: number }).retainage_percent ?? 0
  );

  const patch: Record<string, unknown> = {};
  if (body.name !== undefined) patch.name = body.name;
  if (body.address !== undefined) patch.address = body.address;
  if (body.client_name !== undefined) patch.client_name = body.client_name;
  if (body.client_email !== undefined) patch.client_email = body.client_email;
  if (body.client_phone !== undefined) patch.client_phone = body.client_phone;
  if (body.contract_type !== undefined) patch.contract_type = body.contract_type;
  if (body.original_contract_amount !== undefined) patch.original_contract_amount = body.original_contract_amount;
  if (body.deposit_percentage !== undefined) patch.deposit_percentage = body.deposit_percentage;
  if (body.gc_fee_percentage !== undefined) patch.gc_fee_percentage = body.gc_fee_percentage;

  let retainageChanged = false;
  let newRetainage = previousRetainage;
  if (body.retainage_percent !== undefined) {
    const pct = Number(body.retainage_percent);
    if (Number.isNaN(pct) || pct < 0 || pct > 100) {
      throw new ApiError("retainage_percent must be between 0 and 100", 400);
    }
    patch.retainage_percent = pct;
    newRetainage = pct;
    retainageChanged = pct !== previousRetainage;
  }
  if (body.pm_id !== undefined) patch.pm_id = body.pm_id;
  if (body.contract_date !== undefined) patch.contract_date = body.contract_date;
  if (body.status !== undefined) patch.status = body.status;
  if (body.starting_application_number !== undefined) {
    const n = Number(body.starting_application_number);
    if (Number.isNaN(n) || n < 1) {
      throw new ApiError("starting_application_number must be ≥ 1", 400);
    }
    patch.starting_application_number = n;
  }
  if (body.previous_certificates_total !== undefined) {
    patch.previous_certificates_total = Math.max(0, Math.round(body.previous_certificates_total));
  }
  if (body.previous_change_orders_total !== undefined) {
    patch.previous_change_orders_total = Math.round(body.previous_change_orders_total);
  }

  const { error } = await supabase
    .from("jobs")
    .update(patch)
    .eq("id", body.id)
    .is("deleted_at", null);

  if (error) throw new ApiError(error.message, 500);

  // Cascade: when retainage OR any baseline-history field changes,
  // recompute draft draws so Line 2/5a-c/6/7/8/9 and Application # stay
  // in sync. Submitted/approved/locked/paid draws keep their captured
  // values — retroactive changes there would be a revision event, not a
  // silent edit.
  const baselineChanged =
    body.starting_application_number !== undefined ||
    body.previous_certificates_total !== undefined ||
    body.previous_change_orders_total !== undefined;
  if (retainageChanged || baselineChanged) {
    const recomputed = await recalcDraftDrawsForJob(body.id);
    await logActivity({
      org_id: (existing as { org_id: string }).org_id,
      user_id: user.id,
      entity_type: "job",
      entity_id: body.id,
      action: "updated",
      details: {
        field: "retainage_percent",
        from: previousRetainage,
        to: newRetainage,
        draft_draws_recomputed: recomputed,
      },
    });
  }

  return NextResponse.json({ ok: true });
});
