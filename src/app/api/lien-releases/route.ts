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
    return NextResponse.json(data ?? []);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
