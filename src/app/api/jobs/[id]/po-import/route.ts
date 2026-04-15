import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { ApiError, withApiError } from "@/lib/api/errors";
import { getCurrentMembership } from "@/lib/org/session";

export const dynamic = "force-dynamic";

type ImportRow = {
  po_number: string;
  vendor_name?: string;
  description?: string;
  amount: string;
  cost_code?: string;
  budget_line?: string;
  issued_date?: string;
  notes?: string;
};

function parseAmountToCents(s: string): number | null {
  if (!s) return null;
  const clean = String(s).replace(/[$,\s]/g, "");
  const n = parseFloat(clean);
  if (!isFinite(n)) return null;
  return Math.round(n * 100);
}

export const POST = withApiError(async (request: NextRequest, { params }: { params: { id: string } }) => {
  const membership = await getCurrentMembership();
  if (!membership) throw new ApiError("Not authenticated", 401);
  if (!["owner", "admin", "pm"].includes(membership.role)) throw new ApiError("Forbidden", 403);

  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new ApiError("Not authenticated", 401);

  const body = (await request.json()) as { rows?: ImportRow[] };
  if (!Array.isArray(body.rows) || body.rows.length === 0) throw new ApiError("No rows supplied", 400);

  const [{ data: vendors }, { data: budgetLines }] = await Promise.all([
    supabase.from("vendors").select("id, name").eq("org_id", membership.org_id).is("deleted_at", null),
    supabase
      .from("budget_lines")
      .select("id, cost_code_id, cost_codes:cost_code_id(code)")
      .eq("job_id", params.id)
      .is("deleted_at", null),
  ]);

  const vendorByName = new Map<string, string>();
  for (const v of vendors ?? []) vendorByName.set(v.name.toLowerCase().trim(), v.id as string);

  const budgetLineByCode = new Map<string, string>();
  for (const bl of budgetLines ?? []) {
    const code = (bl as unknown as { cost_codes: { code: string } | null }).cost_codes?.code;
    if (code) budgetLineByCode.set(code.toLowerCase().trim(), bl.id as string);
  }

  let inserts = 0;
  let skipped: Array<{ row: number; reason: string }> = [];
  let newVendors = 0;

  for (let i = 0; i < body.rows.length; i++) {
    const row = body.rows[i];
    const poNumber = row.po_number?.trim();
    const amount = parseAmountToCents(row.amount ?? "");
    if (!poNumber) { skipped.push({ row: i + 1, reason: "Missing po_number" }); continue; }
    if (amount == null) { skipped.push({ row: i + 1, reason: "Invalid amount" }); continue; }

    // Resolve / create vendor.
    let vendorId: string | null = null;
    if (row.vendor_name) {
      const key = row.vendor_name.toLowerCase().trim();
      vendorId = vendorByName.get(key) ?? null;
      if (!vendorId) {
        const { data: created, error: vendorErr } = await supabase
          .from("vendors")
          .insert({ org_id: membership.org_id, name: row.vendor_name.trim() })
          .select("id")
          .single();
        if (vendorErr) { skipped.push({ row: i + 1, reason: `Vendor insert failed: ${vendorErr.message}` }); continue; }
        vendorId = created?.id ?? null;
        if (vendorId) { vendorByName.set(key, vendorId); newVendors++; }
      }
    }

    // Resolve budget line by cost_code or budget_line column.
    let budgetLineId: string | null = null;
    const blRef = (row.budget_line ?? row.cost_code ?? "").trim();
    if (blRef) budgetLineId = budgetLineByCode.get(blRef.toLowerCase()) ?? null;

    // Duplicate PO number?
    const { data: existing } = await supabase
      .from("purchase_orders")
      .select("id")
      .eq("org_id", membership.org_id)
      .eq("po_number", poNumber)
      .is("deleted_at", null)
      .maybeSingle();
    if (existing) { skipped.push({ row: i + 1, reason: `PO ${poNumber} already exists` }); continue; }

    const { error: insErr } = await supabase.from("purchase_orders").insert({
      org_id: membership.org_id,
      job_id: params.id,
      vendor_id: vendorId,
      budget_line_id: budgetLineId,
      po_number: poNumber,
      description: row.description ?? null,
      amount,
      status: row.issued_date ? "issued" : "draft",
      issued_date: row.issued_date ?? null,
      notes: row.notes ?? null,
      created_by: user.id,
      status_history: [
        {
          who: user.id,
          when: new Date().toISOString(),
          old_status: null,
          new_status: row.issued_date ? "issued" : "draft",
          note: "Imported",
        },
      ],
    });
    if (insErr) { skipped.push({ row: i + 1, reason: `Insert failed: ${insErr.message}` }); continue; }
    inserts++;
  }

  return NextResponse.json({ imported: inserts, skipped, new_vendors: newVendors });
});
