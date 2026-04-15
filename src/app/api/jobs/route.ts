import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { ApiError, withApiError } from "@/lib/api/errors";
import { getCurrentMembership } from "@/lib/org/session";
import { checkPlanLimit, planDisplayName } from "@/lib/plan-limits";

export const dynamic = "force-dynamic";

type JobBody = {
  name?: string;
  address?: string | null;
  client_name?: string | null;
  client_email?: string | null;
  client_phone?: string | null;
  contract_type?: "cost_plus" | "fixed";
  original_contract_amount?: number; // cents
  deposit_percentage?: number;       // 0..1 (e.g. 0.10)
  gc_fee_percentage?: number;        // 0..1
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
      deposit_percentage: body.deposit_percentage ?? 0.1,
      gc_fee_percentage: body.gc_fee_percentage ?? 0.2,
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
  if (body.pm_id !== undefined) patch.pm_id = body.pm_id;
  if (body.contract_date !== undefined) patch.contract_date = body.contract_date;
  if (body.status !== undefined) patch.status = body.status;

  const { error } = await supabase
    .from("jobs")
    .update(patch)
    .eq("id", body.id)
    .is("deleted_at", null);

  if (error) throw new ApiError(error.message, 500);
  return NextResponse.json({ ok: true });
});
