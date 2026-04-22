import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentMembership } from "@/lib/org/session";

const SAMPLE_JOB_NAME = "Sample Residence — 123 Demo St";

const SAMPLE_VENDORS = [
  { name: "Sample Electric LLC", default_cost_code: "09101" },
  { name: "Sample Plumbing Co", default_cost_code: "10101" },
  { name: "Sample Lumber Inc", default_cost_code: "06101" },
];

const SAMPLE_BUDGET_LINES: Array<{
  code: string;
  description: string;
  category: string;
  original_estimate: number;
}> = [
  { code: "01101", description: "Architectural Services", category: "Pre-Construction", original_estimate: 2500000 },
  { code: "01104", description: "Permitting & Planning", category: "Pre-Construction", original_estimate: 1500000 },
  { code: "03110", description: "Temporary Electric & Water", category: "Site Work", original_estimate: 800000 },
  { code: "03112", description: "Debris Removal", category: "Site Work", original_estimate: 1200000 },
  { code: "04101", description: "Site Work / Excavation", category: "Site Work", original_estimate: 3500000 },
  { code: "05101", description: "Concrete / Foundation", category: "Concrete", original_estimate: 4500000 },
  { code: "05102", description: "Concrete Flatwork", category: "Concrete", original_estimate: 2000000 },
  { code: "05103", description: "Concrete Block / CMU", category: "Concrete", original_estimate: 1800000 },
  { code: "06101", description: "Framing — Lumber", category: "Framing", original_estimate: 6500000 },
  { code: "06102", description: "Framing — Labor", category: "Framing", original_estimate: 4500000 },
  { code: "06103", description: "Trusses", category: "Framing", original_estimate: 3200000 },
  { code: "06104", description: "Sheathing & Wrap", category: "Framing", original_estimate: 1500000 },
  { code: "09101", description: "Electrical — Rough", category: "Electrical", original_estimate: 2800000 },
  { code: "09102", description: "Electrical — Finish", category: "Electrical", original_estimate: 1900000 },
  { code: "10101", description: "Plumbing — Rough", category: "Plumbing", original_estimate: 2200000 },
  { code: "10102", description: "Plumbing — Finish", category: "Plumbing", original_estimate: 1600000 },
  { code: "15101", description: "Drywall — Hang", category: "Finishes", original_estimate: 2500000 },
  { code: "15102", description: "Drywall — Finish & Texture", category: "Finishes", original_estimate: 1800000 },
  { code: "16101", description: "Interior Paint", category: "Finishes", original_estimate: 2200000 },
  { code: "17101", description: "Flooring — Tile", category: "Finishes", original_estimate: 3000000 },
];

export async function POST() {
  const membership = await getCurrentMembership();
  if (!membership) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (membership.role !== "admin" && membership.role !== "owner") {
    return NextResponse.json({ error: "Admin or owner required" }, { status: 403 });
  }

  const orgId = membership.org_id;
  const supabase = createServerClient();

  const { count: existingSample } = await supabase
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("name", SAMPLE_JOB_NAME)
    .is("deleted_at", null);
  if ((existingSample ?? 0) > 0) {
    return NextResponse.json({ error: "Sample data already loaded" }, { status: 409 });
  }

  const { data: job, error: jobErr } = await supabase
    .from("jobs")
    .insert({
      org_id: orgId,
      name: SAMPLE_JOB_NAME,
      address: "123 Demo St",
      client_name: "Sample Client",
      client_email: "sample@example.com",
      contract_type: "cost_plus",
      original_contract_amount: 50000000,
      current_contract_amount: 50000000,
      status: "active",
      deposit_percentage: 0.10,
      gc_fee_percentage: 0.20,
    })
    .select("id")
    .single();
  if (jobErr || !job) {
    return NextResponse.json({ error: jobErr?.message ?? "Failed to create job" }, { status: 500 });
  }
  const jobId = job.id;

  const vendorInserts = SAMPLE_VENDORS.map((v) => ({
    org_id: orgId,
    name: v.name,
  }));
  const { data: vendors, error: vendorErr } = await supabase
    .from("vendors")
    .insert(vendorInserts)
    .select("id, name");
  if (vendorErr) {
    return NextResponse.json({ error: vendorErr.message }, { status: 500 });
  }
  const vendorMap = new Map((vendors ?? []).map((v) => [v.name, v.id]));

  const codeInserts = SAMPLE_BUDGET_LINES.map((bl, i) => ({
    org_id: orgId,
    code: bl.code,
    description: bl.description,
    category: bl.category,
    sort_order: (i + 1) * 10,
  }));

  const { data: existingCodes } = await supabase
    .from("cost_codes")
    .select("id, code")
    .eq("org_id", orgId)
    .is("deleted_at", null);
  const existingCodeMap = new Map((existingCodes ?? []).map((c) => [c.code, c.id]));

  const newCodes = codeInserts.filter((c) => !existingCodeMap.has(c.code));
  if (newCodes.length > 0) {
    const { data: inserted } = await supabase
      .from("cost_codes")
      .insert(newCodes)
      .select("id, code");
    (inserted ?? []).forEach((c) => existingCodeMap.set(c.code, c.id));
  }

  // no user session: dev-only sample-data generator. Caller may be
  // authenticated, but the rows are synthetic seed data attributed to the
  // system, not the operator. NULL created_by is intentional here.
  const budgetInserts = SAMPLE_BUDGET_LINES.map((bl) => ({
    org_id: orgId,
    job_id: jobId,
    cost_code_id: existingCodeMap.get(bl.code) ?? null,
    original_estimate: bl.original_estimate,
    revised_estimate: bl.original_estimate,
  }));
  await supabase.from("budget_lines").insert(budgetInserts);

  const { data: po } = await supabase
    .from("purchase_orders")
    .insert({
      org_id: orgId,
      job_id: jobId,
      vendor_id: vendorMap.get("Sample Lumber Inc"),
      cost_code_id: existingCodeMap.get("06101"),
      po_number: "SAMPLE-PO-001",
      description: "Framing lumber package",
      amount: 6500000,
      status: "issued",
      status_history: [{ who: "system", when: new Date().toISOString(), old_status: null, new_status: "issued", note: "Sample data" }],
    })
    .select("id")
    .single();

  const invoiceData = [
    { vendor: "Sample Electric LLC", code: "09101", amount: 1400000, status: "pm_approved", inv_num: "SE-1001" },
    { vendor: "Sample Electric LLC", code: "09102", amount: 950000, status: "pm_review", inv_num: "SE-1002" },
    { vendor: "Sample Plumbing Co", code: "10101", amount: 1100000, status: "qa_approved", inv_num: "SP-2001" },
    { vendor: "Sample Plumbing Co", code: "10102", amount: 800000, status: "pm_denied", inv_num: "SP-2002" },
    { vendor: "Sample Lumber Inc", code: "06101", amount: 3250000, status: "in_draw", inv_num: "SL-3001", po_id: po?.id },
  ];

  for (const inv of invoiceData) {
    await supabase.from("invoices").insert({
      org_id: orgId,
      job_id: jobId,
      vendor_id: vendorMap.get(inv.vendor),
      cost_code_id: existingCodeMap.get(inv.code),
      po_id: inv.po_id ?? null,
      invoice_number: inv.inv_num,
      invoice_date: new Date().toISOString().split("T")[0],
      vendor_name_raw: inv.vendor,
      description: `Sample invoice from ${inv.vendor}`,
      total_amount: inv.amount,
      invoice_type: "lump_sum",
      confidence_score: 0.95,
      status: inv.status,
      status_history: [
        { who: "system", when: new Date().toISOString(), old_status: null, new_status: "received", note: "Sample data" },
        { who: "system", when: new Date().toISOString(), old_status: "received", new_status: inv.status, note: "Sample data" },
      ],
    });
  }

  const { data: draw } = await supabase
    .from("draws")
    .insert({
      org_id: orgId,
      job_id: jobId,
      draw_number: 1,
      application_date: new Date().toISOString().split("T")[0],
      period_start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      period_end: new Date().toISOString().split("T")[0],
      status: "draft",
      revision_number: 0,
      original_contract_sum: 50000000,
      net_change_orders: 0,
      contract_sum_to_date: 50000000,
      total_completed_to_date: 3250000,
      less_previous_payments: 0,
      current_payment_due: 3250000,
      balance_to_finish: 46750000,
      status_history: [{ who: "system", when: new Date().toISOString(), old_status: null, new_status: "draft", note: "Sample data" }],
    })
    .select("id")
    .single();

  await supabase.from("activity_log").insert({
    org_id: orgId,
    entity_type: "job",
    entity_id: jobId,
    action: "created",
    details: { note: "Sample data loaded", job_name: SAMPLE_JOB_NAME },
  });

  return NextResponse.json({
    success: true,
    created: { job: jobId, vendors: vendors?.length ?? 0, budget_lines: budgetInserts.length, invoices: invoiceData.length, po: po?.id, draw: draw?.id },
  });
}

export async function DELETE() {
  const membership = await getCurrentMembership();
  if (!membership) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (membership.role !== "admin" && membership.role !== "owner") {
    return NextResponse.json({ error: "Admin or owner required" }, { status: 403 });
  }

  const orgId = membership.org_id;
  const supabase = createServerClient();

  const { data: sampleJob } = await supabase
    .from("jobs")
    .select("id")
    .eq("org_id", orgId)
    .eq("name", SAMPLE_JOB_NAME)
    .is("deleted_at", null)
    .maybeSingle();

  if (!sampleJob) {
    return NextResponse.json({ error: "No sample data found" }, { status: 404 });
  }

  const jobId = sampleJob.id;
  const now = new Date().toISOString();

  await supabase.from("draw_line_items").update({ deleted_at: now }).eq("org_id", orgId).in("draw_id",
    supabase.from("draws").select("id").eq("job_id", jobId) as unknown as string[]
  );
  await supabase.from("draws").update({ deleted_at: now }).eq("job_id", jobId).eq("org_id", orgId);
  await supabase.from("invoices").update({ deleted_at: now }).eq("job_id", jobId).eq("org_id", orgId);
  await supabase.from("purchase_orders").update({ deleted_at: now }).eq("job_id", jobId).eq("org_id", orgId);
  await supabase.from("budget_lines").update({ deleted_at: now }).eq("job_id", jobId).eq("org_id", orgId);
  await supabase.from("jobs").update({ deleted_at: now }).eq("id", jobId).eq("org_id", orgId);

  const sampleVendorNames = SAMPLE_VENDORS.map((v) => v.name);
  const { data: sampleVendors } = await supabase
    .from("vendors")
    .select("id")
    .eq("org_id", orgId)
    .in("name", sampleVendorNames)
    .is("deleted_at", null);
  const vendorIds = (sampleVendors ?? []).map((v) => v.id);

  for (const vid of vendorIds) {
    const { count } = await supabase
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .eq("vendor_id", vid)
      .is("deleted_at", null);
    if ((count ?? 0) === 0) {
      await supabase.from("vendors").update({ deleted_at: now }).eq("id", vid).eq("org_id", orgId);
    }
  }

  await supabase.from("activity_log").insert({
    org_id: orgId,
    entity_type: "job",
    entity_id: jobId,
    action: "deleted",
    details: { note: "Sample data removed", job_name: SAMPLE_JOB_NAME },
  });

  return NextResponse.json({ success: true });
}
