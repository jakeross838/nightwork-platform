import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentMembership } from "@/lib/org/session";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET(request: NextRequest) {
  try {
    const membership = await getCurrentMembership();
    if (!membership) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const supabase = createServerClient();
    const jobId = request.nextUrl.searchParams.get("job_id");

    let query = supabase
      .from("draws")
      .select(`*, jobs:job_id (id, name, address)`)
      .eq("org_id", membership.org_id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (jobId) query = query.eq("job_id", jobId);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
