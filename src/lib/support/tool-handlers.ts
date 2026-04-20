/**
 * Tool handlers for the support chatbot. Each handler runs with the
 * authenticated user's Supabase client so RLS decides what's visible —
 * the bot cannot see anything the user couldn't see themselves in the UI.
 *
 * Every handler returns a string. Claude receives that string as the
 * tool_result content. Errors are returned in-band as readable text
 * rather than thrown so the conversation can recover gracefully.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { writePlatformAudit } from "@/lib/auth/platform-admin-audit";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ToolContext = {
  supabase: SupabaseClient; // user's RLS-bound client
  userId: string;
  orgId: string;
  role: string;
  pageUrl: string | null;
  impersonationActive: boolean;
  conversationId: string;
};

type ToolResult = { text: string; structured?: Record<string, unknown> };

export async function runTool(
  ctx: ToolContext,
  name: string,
  input: Record<string, unknown>
): Promise<ToolResult> {
  try {
    switch (name) {
      case "get_user_context":
        return await handleGetUserContext(ctx);
      case "get_invoice":
        return await handleGetInvoice(ctx, input);
      case "get_job":
        return await handleGetJob(ctx, input);
      case "search_recent_activity":
        return await handleSearchRecentActivity(ctx, input);
      case "escalate_to_human":
        return await handleEscalateToHuman(ctx, input);
      default:
        return { text: `Unknown tool: ${name}` };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { text: `Tool error: ${message}` };
  }
}

async function handleGetUserContext(ctx: ToolContext): Promise<ToolResult> {
  const { data: org } = await ctx.supabase
    .from("organizations")
    .select("name")
    .eq("id", ctx.orgId)
    .maybeSingle();

  const structured = {
    user_role: ctx.role,
    org_name: (org as { name: string } | null)?.name ?? null,
    org_id: ctx.orgId,
    current_page_url: ctx.pageUrl,
    impersonation_active: ctx.impersonationActive,
  };
  return { text: JSON.stringify(structured), structured };
}

async function handleGetInvoice(
  ctx: ToolContext,
  input: Record<string, unknown>
): Promise<ToolResult> {
  const identifier =
    typeof input.identifier === "string" ? input.identifier.trim() : "";
  if (!identifier) {
    return { text: "Missing identifier. Provide a UUID or invoice_number." };
  }

  const cols =
    "id, vendor_name_raw, invoice_number, total_amount, status, job_id, created_at, invoice_date, description";

  let query = ctx.supabase.from("invoices").select(cols).is("deleted_at", null);
  if (UUID_RE.test(identifier)) {
    query = query.eq("id", identifier);
  } else {
    query = query.eq("invoice_number", identifier);
  }

  const { data, error } = await query.limit(1).maybeSingle();
  if (error) {
    return { text: `Lookup error: ${error.message}` };
  }
  if (!data) {
    return { text: "Invoice not found or access denied." };
  }
  const inv = data as {
    id: string;
    vendor_name_raw: string | null;
    invoice_number: string | null;
    total_amount: number | null;
    status: string;
    job_id: string;
    created_at: string;
    invoice_date: string | null;
    description: string | null;
  };

  // Allocations (cost code + amount) via invoice_allocations.
  const [{ data: allocs }, { data: job }] = await Promise.all([
    ctx.supabase
      .from("invoice_allocations")
      .select("amount_cents, cost_codes:cost_code_id(code, description)")
      .eq("invoice_id", inv.id),
    ctx.supabase
      .from("jobs")
      .select("id, name")
      .eq("id", inv.job_id)
      .maybeSingle(),
  ]);

  const allocations = (
    (allocs ?? []) as Array<{
      amount_cents: number;
      cost_codes:
        | { code: string; description: string }
        | Array<{ code: string; description: string }>
        | null;
    }>
  ).map((a) => {
    const cc = Array.isArray(a.cost_codes) ? a.cost_codes[0] : a.cost_codes;
    return {
      cost_code: cc?.code ?? null,
      description: cc?.description ?? null,
      amount_cents: a.amount_cents,
    };
  });

  const structured = {
    id: inv.id,
    vendor_name: inv.vendor_name_raw,
    invoice_number: inv.invoice_number,
    total_amount_cents: inv.total_amount,
    status: inv.status,
    invoice_date: inv.invoice_date,
    description: inv.description,
    job_id: inv.job_id,
    job_name: (job as { name: string } | null)?.name ?? null,
    allocations,
    created_at: inv.created_at,
  };
  return { text: JSON.stringify(structured), structured };
}

async function handleGetJob(
  ctx: ToolContext,
  input: Record<string, unknown>
): Promise<ToolResult> {
  const identifier =
    typeof input.identifier === "string" ? input.identifier.trim() : "";
  if (!identifier) {
    return { text: "Missing identifier. Provide a UUID or job name." };
  }

  const cols =
    "id, name, address, original_contract_amount, current_contract_amount";

  if (UUID_RE.test(identifier)) {
    const { data } = await ctx.supabase
      .from("jobs")
      .select(cols)
      .eq("id", identifier)
      .is("deleted_at", null)
      .maybeSingle();
    if (!data) return { text: "Job not found or access denied." };
    return await buildJobResult(ctx, data as JobRow);
  }

  const { data: candidates } = await ctx.supabase
    .from("jobs")
    .select(cols)
    .is("deleted_at", null)
    .ilike("name", `%${identifier}%`)
    .limit(5);

  const rows = (candidates ?? []) as JobRow[];
  if (rows.length === 0) {
    return { text: `No jobs match "${identifier}".` };
  }
  if (rows.length > 1) {
    const list = rows.map((r) => `- ${r.name} (${r.id})`).join("\n");
    return {
      text: `Multiple jobs match "${identifier}". Ask the user which one:\n${list}`,
    };
  }
  return await buildJobResult(ctx, rows[0]);
}

type JobRow = {
  id: string;
  name: string;
  address: string | null;
  original_contract_amount: number | null;
  current_contract_amount: number | null;
};

async function buildJobResult(
  ctx: ToolContext,
  job: JobRow
): Promise<ToolResult> {
  const [cosRes, invoicesRes] = await Promise.all([
    ctx.supabase
      .from("change_orders")
      .select("total_with_fee, status")
      .eq("job_id", job.id)
      .is("deleted_at", null),
    ctx.supabase
      .from("invoices")
      .select("total_amount, status")
      .eq("job_id", job.id)
      .is("deleted_at", null),
  ]);

  const cos = (cosRes.data ?? []) as Array<{
    total_with_fee: number | null;
    status: string;
  }>;
  const invs = (invoicesRes.data ?? []) as Array<{
    total_amount: number | null;
    status: string;
  }>;

  const approvedCosTotal = cos
    .filter((c) => c.status === "approved" || c.status === "executed")
    .reduce((sum, c) => sum + (c.total_with_fee ?? 0), 0);

  const PAID_OR_IN_DRAW = new Set([
    "pm_approved",
    "qa_approved",
    "pushed_to_qb",
    "in_draw",
    "paid",
  ]);
  const billedToDate = invs
    .filter((i) => PAID_OR_IN_DRAW.has(i.status))
    .reduce((sum, i) => sum + (i.total_amount ?? 0), 0);

  const activeInvoices = invs.filter(
    (i) =>
      i.status !== "paid" &&
      i.status !== "void" &&
      i.status !== "pm_denied" &&
      i.status !== "qb_failed"
  ).length;

  const contract = job.current_contract_amount ?? job.original_contract_amount ?? 0;
  const percentComplete =
    contract > 0 ? Math.round((billedToDate / contract) * 1000) / 10 : null;

  const structured = {
    id: job.id,
    name: job.name,
    address: job.address,
    contract_value_cents: contract,
    approved_cos_total_cents: approvedCosTotal,
    billed_to_date_cents: billedToDate,
    percent_complete: percentComplete,
    active_invoices_count: activeInvoices,
  };
  return { text: JSON.stringify(structured), structured };
}

async function handleSearchRecentActivity(
  ctx: ToolContext,
  input: Record<string, unknown>
): Promise<ToolResult> {
  const rawLimit =
    typeof input.limit === "number" ? input.limit : Number(input.limit ?? 10);
  const limit = Math.min(25, Math.max(1, Number.isFinite(rawLimit) ? rawLimit : 10));

  const { data, error } = await ctx.supabase
    .from("activity_log")
    .select("id, entity_type, entity_id, action, details, created_at")
    .eq("user_id", ctx.userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    return { text: `Activity lookup failed: ${error.message}` };
  }

  const rows = (data ?? []) as Array<{
    id: string;
    entity_type: string;
    entity_id: string | null;
    action: string;
    details: Record<string, unknown> | null;
    created_at: string;
  }>;

  if (rows.length === 0) {
    return { text: "No recent activity for this user." };
  }

  const summary = rows.map((r) => {
    const when = new Date(r.created_at).toISOString();
    const detailHint =
      r.details && typeof r.details === "object"
        ? JSON.stringify(r.details)
        : "";
    return `${when} · ${r.entity_type} · ${r.action}${
      r.entity_id ? ` (${r.entity_id})` : ""
    }${detailHint ? ` ${detailHint}` : ""}`;
  });

  return { text: summary.join("\n"), structured: { count: rows.length } };
}

async function handleEscalateToHuman(
  ctx: ToolContext,
  input: Record<string, unknown>
): Promise<ToolResult> {
  const reason =
    typeof input.reason === "string" && input.reason.trim()
      ? input.reason.trim().slice(0, 500)
      : "User requested human support.";

  const { error } = await ctx.supabase
    .from("support_conversations")
    .update({
      status: "escalated",
      escalated_at: new Date().toISOString(),
      escalation_reason: reason,
    })
    .eq("id", ctx.conversationId);
  if (error) {
    return { text: `Escalation failed: ${error.message}` };
  }

  // Record in platform_admin_audit so staff can spot new escalations in the
  // audit log too. Use a system-style admin_user_id: we attribute the audit
  // row to the escalating user (not a staff member) so the log has a valid FK.
  await writePlatformAudit({
    admin_user_id: ctx.userId,
    action: "support_escalation",
    target_org_id: ctx.orgId,
    target_user_id: ctx.userId,
    target_record_type: "support_conversation",
    target_record_id: ctx.conversationId,
    details: { reason },
    reason: `Support conversation escalated: ${reason}`,
  });

  return {
    text: "Escalation recorded. A team member will follow up via email within 24 hours.",
    structured: { escalated: true, reason },
  };
}
