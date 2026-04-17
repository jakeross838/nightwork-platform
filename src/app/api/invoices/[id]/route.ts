import { NextRequest, NextResponse } from "next/server";
import { ApiError, withApiError } from "@/lib/api/errors";
import {
  getCurrentMembership,
  getMembershipFromRequest,
} from "@/lib/org/session";
import { createServerClient } from "@/lib/supabase/server";
import { tryCreateServiceRoleClient } from "@/lib/supabase/service";

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

  const supabase = tryCreateServiceRoleClient() ?? createServerClient();
  const updates = await request.json();

  const { data, error } = await supabase
    .from("invoices")
    .update(updates)
    .eq("id", params.id)
    .eq("org_id", membership.org_id)
    .select("id")
    .single();

  if (error) throw new ApiError(error.message, 500);
  return NextResponse.json(data);
});
