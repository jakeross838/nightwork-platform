import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentMembership } from "@/lib/org/session";
import { logActivity, logStatusChange } from "@/lib/activity-log";
import { recalcLinesAndPOs } from "@/lib/recalc";

export const dynamic = "force-dynamic";

interface VendorBatch {
  vendor_id: string;
  invoice_ids: string[];
  payment_method: "check" | "ach" | "wire" | "credit_card";
  payment_reference?: string | null;
}

interface BatchRequest {
  payment_date?: string;
  vendors: VendorBatch[];
}

/**
 * POST /api/invoices/payments/batch-by-vendor
 *
 * Phase 8f Part D: marks every invoice for each vendor in the batch as paid,
 * sets payment_date / method / reference on each, logs each status change to
 * activity_log, and runs the recalc cascade on every affected budget line.
 *
 * Returns a per-vendor receipt array for the printable confirmation.
 */
export async function POST(request: NextRequest) {
  try {
    const membership = await getCurrentMembership();
    if (!membership) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const orgId = membership.org_id;

    const supabase = createServerClient();
    const body = (await request.json()) as BatchRequest;
    if (!body.vendors || body.vendors.length === 0) {
      return NextResponse.json({ error: "No vendors supplied" }, { status: 400 });
    }
    const payment_date = body.payment_date ?? new Date().toISOString().slice(0, 10);

    const allInvoiceIds = body.vendors.flatMap((v) => v.invoice_ids);
    if (allInvoiceIds.length === 0) {
      return NextResponse.json({ error: "No invoices to pay" }, { status: 400 });
    }

    // Pull the invoices once so we can record their amounts and trigger
    // recalc on the right budget lines + POs.
    const { data: invs } = await supabase
      .from("invoices")
      .select(
        "id, vendor_id, total_amount, status, payment_status, draw_id, vendor_name_raw"
      )
      .eq("org_id", orgId)
      .in("id", allInvoiceIds)
      .is("deleted_at", null);
    type InvRow = {
      id: string;
      vendor_id: string | null;
      total_amount: number;
      status: string;
      payment_status: string;
      draw_id: string | null;
      vendor_name_raw: string | null;
    };
    const invMap = new Map<string, InvRow>();
    for (const i of (invs ?? []) as InvRow[]) invMap.set(i.id, i);

    const receipts: {
      vendor_id: string;
      vendor_name: string;
      invoice_count: number;
      total: number;
      payment_method: string;
      payment_reference: string | null;
      payment_date: string;
      missing_lien_release: boolean;
      draw_ids: string[];
    }[] = [];

    // Process vendor by vendor so we can persist a per-vendor reference and
    // emit a clean activity log entry per group.
    for (const vendor of body.vendors) {
      let vendorTotal = 0;
      const drawIds = new Set<string>();
      for (const invId of vendor.invoice_ids) {
        const inv = invMap.get(invId);
        if (!inv) continue;
        if (inv.payment_status === "paid") continue;
        vendorTotal += inv.total_amount;
        if (inv.draw_id) drawIds.add(inv.draw_id);
        await supabase
          .from("invoices")
          .update({
            payment_status: "paid",
            payment_date,
            payment_method: vendor.payment_method,
            payment_reference: vendor.payment_reference ?? null,
            payment_amount: inv.total_amount,
            status: "paid",
          })
          .eq("id", invId);
      }

      // Phase 8f Part E: warn (do NOT block) when a vendor has no lien
      // release on file for a draw that includes one of these invoices.
      let missingLienRelease = false;
      if (drawIds.size > 0) {
        const { data: lrs } = await supabase
          .from("lien_releases")
          .select("id, status, document_url")
          .eq("vendor_id", vendor.vendor_id)
          .in("draw_id", Array.from(drawIds))
          .is("deleted_at", null);
        const hasReceived = (lrs ?? []).some(
          (l) => l.status === "received" || l.status === "waived"
        );
        const hasDocs = (lrs ?? []).some((l) => !!l.document_url);
        if (!hasReceived || !hasDocs) missingLienRelease = true;
      }

      const vendorName =
        Array.from(invMap.values()).find((i) => i.vendor_id === vendor.vendor_id)
          ?.vendor_name_raw ?? "Unknown vendor";
      receipts.push({
        vendor_id: vendor.vendor_id,
        vendor_name: vendorName,
        invoice_count: vendor.invoice_ids.length,
        total: vendorTotal,
        payment_method: vendor.payment_method,
        payment_reference: vendor.payment_reference ?? null,
        payment_date,
        missing_lien_release: missingLienRelease,
        draw_ids: Array.from(drawIds),
      });

      // Per-invoice activity log so the audit trail records each status change
      // individually (Cascade audit rule: log every state change).
      for (const invId of vendor.invoice_ids) {
        const inv = invMap.get(invId);
        if (!inv) continue;
        await logStatusChange({
          org_id: orgId,
          entity_type: "invoice",
          entity_id: invId,
          from: inv.payment_status as string,
          to: "paid",
          reason: `Batch payment to ${vendorName} (${vendor.payment_method}${
            vendor.payment_reference ? ` ref ${vendor.payment_reference}` : ""
          })`,
          extra: {
            payment_method: vendor.payment_method,
            payment_reference: vendor.payment_reference,
            payment_date,
            vendor_id: vendor.vendor_id,
            batch: true,
          },
        });
      }
    }

    // Cascade: recalc affected budget lines + POs. This pulls invoice line
    // items to find the right budget_line_ids, mirroring the existing
    // bulk-payment recalc path.
    try {
      const { data: lines } = await supabase
        .from("invoice_line_items")
        .select("budget_line_id, po_id")
        .in("invoice_id", allInvoiceIds)
        .is("deleted_at", null);
      await recalcLinesAndPOs(
        (lines ?? []).map((l) => l.budget_line_id as string),
        (lines ?? []).map((l) => l.po_id as string)
      );
    } catch (err) {
      console.warn(`[batch-by-vendor recalc] ${err instanceof Error ? err.message : err}`);
    }

    await logActivity({
      org_id: orgId,
      entity_type: "invoice",
      action: "status_changed",
      details: {
        batch_payment: {
          vendors: receipts.length,
          invoices: allInvoiceIds.length,
          total: receipts.reduce((s, r) => s + r.total, 0),
          payment_date,
        },
      },
    });

    return NextResponse.json({ ok: true, receipts });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
