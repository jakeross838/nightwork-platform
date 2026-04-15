import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/lien-releases
 *   ?job_id=...       filter to one job
 *   ?draw_id=...      filter to one draw
 *   ?vendor_id=...    filter to one vendor
 *   ?status=...       filter by status
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const { searchParams } = request.nextUrl;
    let query = supabase
      .from("lien_releases")
      .select(
        `id, org_id, job_id, vendor_id, draw_id, po_id, release_type, amount, status,
         through_date, received_at, document_url, notes, created_at, updated_at,
         vendors:vendor_id (id, name),
         jobs:job_id (id, name),
         draws:draw_id (id, draw_number, revision_number)`
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    const jobId = searchParams.get("job_id");
    const drawId = searchParams.get("draw_id");
    const vendorId = searchParams.get("vendor_id");
    const status = searchParams.get("status");
    if (jobId) query = query.eq("job_id", jobId);
    if (drawId) query = query.eq("draw_id", drawId);
    if (vendorId) query = query.eq("vendor_id", vendorId);
    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Phase 8f Part E: enrich each release with payment status of the
    // invoices that share its (vendor_id, draw_id) so the table can show
    // "Payment Status" without N+1 fetches client-side.
    const releases = (data ?? []) as Array<Record<string, unknown>>;
    const pairs = releases
      .map((r) => ({
        vendor_id: r.vendor_id as string | null,
        draw_id: r.draw_id as string | null,
      }))
      .filter((p) => p.vendor_id && p.draw_id);

    if (pairs.length > 0) {
      const { data: invs } = await supabase
        .from("invoices")
        .select("id, vendor_id, draw_id, payment_status, total_amount, payment_amount")
        .in("vendor_id", Array.from(new Set(pairs.map((p) => p.vendor_id))) as string[])
        .in("draw_id", Array.from(new Set(pairs.map((p) => p.draw_id))) as string[])
        .is("deleted_at", null);

      const invByKey = new Map<
        string,
        { paid_count: number; total_count: number; paid_amount: number; total_amount: number }
      >();
      for (const inv of (invs ?? []) as Array<{
        vendor_id: string | null;
        draw_id: string | null;
        payment_status: string | null;
        total_amount: number;
        payment_amount: number | null;
      }>) {
        if (!inv.vendor_id || !inv.draw_id) continue;
        const key = `${inv.vendor_id}|${inv.draw_id}`;
        const cur = invByKey.get(key) ?? {
          paid_count: 0,
          total_count: 0,
          paid_amount: 0,
          total_amount: 0,
        };
        cur.total_count += 1;
        cur.total_amount += inv.total_amount;
        if (inv.payment_status === "paid") {
          cur.paid_count += 1;
          cur.paid_amount += inv.payment_amount ?? inv.total_amount;
        }
        invByKey.set(key, cur);
      }

      for (const r of releases) {
        const key = `${r.vendor_id ?? ""}|${r.draw_id ?? ""}`;
        const stat = invByKey.get(key);
        r.payment_summary = stat ?? null;
      }
    }

    return NextResponse.json(releases);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
