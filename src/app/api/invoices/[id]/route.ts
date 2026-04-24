import { NextRequest, NextResponse } from "next/server";
import { ApiError, withApiError } from "@/lib/api/errors";
import {
  getCurrentMembership,
  getMembershipFromRequest,
} from "@/lib/org/session";
import { createServerClient } from "@/lib/supabase/server";
import { tryCreateServiceRoleClient } from "@/lib/supabase/service";
import { captureCorrections } from "@/lib/invoices/corrections";
import {
  isInvoiceLocked,
  canEditLockedFields,
} from "@/lib/invoice-permissions";
import { logFieldEdit } from "@/lib/audit/log-field-edit";

// ─── PATCH allowlist (segmented by rule matrix) ──────────────────────
// Each category has different lock/privilege/integrity/audit semantics.
// Anything outside the union of these sets is rejected with 400.

/** PM-approved data. Locked after pm_approved; privileged-only edit
 *  when locked; hard-blocked on in_draw/paid (integrity); audit-logged
 *  when edited during lock by a privileged role. */
const FINANCIAL_FIELDS = new Set<string>([
  "vendor_name_raw",
  "invoice_number",
  "invoice_date",
  "total_amount",
  "invoice_type",
  "description",
]);

/** Payment-tracking metadata. No lock — these fields exist to be
 *  edited on post-payment states (check_number recorded on pickup,
 *  mailed_date on mail-out, etc.). Routine work; no audit log. */
const PAYMENT_TRACKING_FIELDS = new Set<string>([
  "check_number",
  "picked_up",
  "mailed_date",
]);

/** Operational assignment. No lock; any org member can reassign. But
 *  reassignment on a locked invoice is unusual, so it's audit-logged
 *  regardless of role. */
const ASSIGNMENT_FIELDS = new Set<string>([
  "assigned_pm_id",
]);

const ALLOWED_PATCH_FIELDS = new Set<string>([
  ...Array.from(FINANCIAL_FIELDS),
  ...Array.from(PAYMENT_TRACKING_FIELDS),
  ...Array.from(ASSIGNMENT_FIELDS),
]);

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const GET = withApiError(async (
  req: NextRequest,
  { params }: { params: { id: string } }
) => {
  const membership = getMembershipFromRequest(req) ?? (await getCurrentMembership());
  if (!membership) throw new ApiError("Not authenticated", 401);

  // Service-role for the aggregate; the explicit org_id filter plus RLS-
  // level org isolation still give identical results, but avoid the RLS
  // 406/403 noise that was blocking detail loads for invoices whose
  // user.session hadn't fully rehydrated.
  const supabase = tryCreateServiceRoleClient() ?? createServerClient();
  const orgId = membership.org_id;

  const { data: invoice, error } = await supabase
    .from("invoices")
    .select(`
      *,
      jobs:job_id (id, name, address, client_name, original_contract_amount, current_contract_amount),
      vendors:vendor_id (id, name, phone, email, address),
      cost_codes:cost_code_id (id, code, description),
      assigned_pm:assigned_pm_id (id, full_name, role)
    `)
    .eq("id", params.id)
    .eq("org_id", orgId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    console.error("[api] invoice detail query error:", error);
    throw new ApiError(`Invoice query failed: ${error.message}`, 500);
  }
  if (!invoice) {
    throw new ApiError("Invoice not found", 404);
  }

  const [lineItemsRes, urlRes, pmUsersRes] = await Promise.all([
    supabase
      .from("invoice_line_items")
      .select(`
        id, line_index, description, qty, unit, rate, amount_cents,
        cost_code_id, budget_line_id, is_change_order, co_reference,
        ai_suggested_cost_code_id, ai_suggestion_confidence,
        cost_codes:cost_code_id (id, code, description, category, is_change_order)
      `)
      .eq("invoice_id", params.id)
      .is("deleted_at", null)
      .order("line_index"),
    invoice.original_file_url
      ? supabase.storage.from("invoice-files").createSignedUrl(invoice.original_file_url, 3600)
      : Promise.resolve({ data: null as { signedUrl: string } | null }),
    supabase
      .from("users")
      .select("id, full_name")
      .in("role", ["pm", "admin"])
      .is("deleted_at", null)
      .order("full_name"),
  ]);

  const signedUrl = (urlRes as { data: { signedUrl?: string } | null }).data?.signedUrl ?? null;

  let duplicateOf = null as null | {
    id: string;
    vendor_name_raw: string | null;
    total_amount: number;
    invoice_date: string | null;
    invoice_number: string | null;
    job_name: string | null;
  };
  const dupId = (invoice as { duplicate_of_id?: string | null }).duplicate_of_id;
  const dupFlag = (invoice as { is_potential_duplicate?: boolean | null }).is_potential_duplicate;
  if (dupFlag && dupId) {
    const { data: dup } = await supabase
      .from("invoices")
      .select(
        "id, vendor_name_raw, total_amount, invoice_date, invoice_number, jobs:job_id(name)"
      )
      .eq("id", dupId)
      .eq("org_id", orgId)
      .maybeSingle();
    if (dup) {
      duplicateOf = {
        id: dup.id as string,
        vendor_name_raw: (dup.vendor_name_raw as string | null) ?? null,
        total_amount: dup.total_amount as number,
        invoice_date: (dup.invoice_date as string | null) ?? null,
        invoice_number: (dup.invoice_number as string | null) ?? null,
        job_name: (dup.jobs as { name?: string | null } | null)?.name ?? null,
      };
    }
  }

  return NextResponse.json({
    ...invoice,
    signed_file_url: signedUrl,
    pm_users: pmUsersRes.data ?? [],
    invoice_line_items: lineItemsRes.data ?? [],
    duplicate_of: duplicateOf,
  });
});

export const PATCH = withApiError(async (
  request: NextRequest,
  { params }: { params: { id: string } }
) => {
  const membership = getMembershipFromRequest(request) ?? (await getCurrentMembership());
  if (!membership) throw new ApiError("Not authenticated", 401);

  const body = (await request.json()) as Record<string, unknown>;

  // 1. Allowlist: reject any field outside the union of FINANCIAL /
  //    PAYMENT_TRACKING / ASSIGNMENT sets. Closes the pre-3b hole
  //    where any invoice column could be PATCHed (status, org_id,
  //    created_at, …).
  const rejectedKeys = Object.keys(body).filter((k) => !ALLOWED_PATCH_FIELDS.has(k));
  if (rejectedKeys.length > 0) {
    throw new ApiError(
      `Fields not allowed for PATCH: ${rejectedKeys.join(", ")}`,
      400
    );
  }
  const changedKeys = Object.keys(body);
  if (changedKeys.length === 0) {
    throw new ApiError("No fields to update", 400);
  }

  // Auth lookup goes through the session-bearing client, not the
  // service-role client — the latter has no user context, so
  // auth.getUser() would return null and the audit log would no-op.
  const authClient = createServerClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  const supabase = tryCreateServiceRoleClient() ?? authClient;

  // 2. Fetch current invoice so we can (a) evaluate lock/integrity
  //    gates against the current status and (b) diff old→new values
  //    for audit logging.
  const { data: invoice, error: fetchError } = await supabase
    .from("invoices")
    .select(
      "id, org_id, status, vendor_name_raw, invoice_number, invoice_date, total_amount, invoice_type, description, check_number, picked_up, mailed_date, assigned_pm_id"
    )
    .eq("id", params.id)
    .single();
  if (fetchError || !invoice || invoice.org_id !== membership.org_id) {
    throw new ApiError("Invoice not found", 404);
  }

  const status = invoice.status as string;
  const locked = isInvoiceLocked(status);
  const privileged = canEditLockedFields(membership.role);

  // 3. Category-specific gates. Only FINANCIAL fields enforce lock
  //    or integrity. PAYMENT_TRACKING/ASSIGNMENT skip those checks.
  const touchesFinancial = changedKeys.some((k) => FINANCIAL_FIELDS.has(k));
  if (touchesFinancial) {
    // Integrity guard — in_draw / paid block edits for every role.
    // Draw math and payment records depend on these values being
    // stable after the invoice has been drawn / paid.
    if (["in_draw", "paid"].includes(status)) {
      throw new ApiError(
        `Cannot edit financial fields on a ${status} invoice — post-draw / post-payment edits are blocked for all roles`,
        403
      );
    }
    // Lock gate — privileged-only when the invoice is in a locked
    // (post-approval) status.
    if (locked && !privileged) {
      throw new ApiError(
        `This invoice is in ${status} status and can only be edited by accounting, admin, or owner roles.`,
        403
      );
    }
  }

  // 4. Capture parser corrections BEFORE applying the update so the
  //    corrections module can diff against pre-update values. Fire-
  //    and-forget — never blocks the save (pre-existing behaviour).
  if (user) {
    captureCorrections(supabase, params.id, body, user.id).catch((err) => {
      console.warn("[corrections] capture failed:", err);
    });
  }

  // 5. Apply the update.
  const { data, error } = await supabase
    .from("invoices")
    .update(body)
    .eq("id", params.id)
    .eq("org_id", membership.org_id)
    .select("id")
    .single();
  if (error) throw new ApiError(error.message, 500);

  // 6. Audit log per category rules.
  //    - FINANCIAL: log when locked AND privileged (override event)
  //    - ASSIGNMENT: log when locked (any role) — reassignment on a
  //      post-approval invoice is unusual enough to trail
  //    - PAYMENT_TRACKING: never — routine operational work
  if (user) {
    const invoiceRecord = invoice as unknown as Record<string, unknown>;
    for (const field of changedKeys) {
      const isFinancial = FINANCIAL_FIELDS.has(field);
      const isAssignment = ASSIGNMENT_FIELDS.has(field);
      const shouldLog =
        (isFinancial && locked && privileged) || (isAssignment && locked);
      if (!shouldLog) continue;
      const oldValue = invoiceRecord[field] ?? null;
      const newValue = body[field];
      if (oldValue === newValue) continue;
      await logFieldEdit({
        invoiceId: params.id,
        orgId: membership.org_id,
        userId: user.id,
        field,
        oldValue,
        newValue,
        byRole: membership.role,
      });
    }
  }

  return NextResponse.json(data);
});
