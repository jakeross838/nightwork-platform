import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { notifyRole } from "@/lib/notifications";
import { logActivity } from "@/lib/activity-log";

export const dynamic = "force-dynamic";

/**
 * Daily cron — find invoices that are 30+ days past their approval/received
 * date and still unpaid, then notify accounting with a digest.
 *
 * Trigger: Vercel cron or any external scheduler hitting this endpoint once
 * per day. Optional auth via CRON_SECRET matching ?key=…
 */
export async function GET(request: NextRequest) {
  try {
    const expectedKey = process.env.CRON_SECRET;
    if (expectedKey) {
      const provided =
        request.nextUrl.searchParams.get("key") ??
        request.headers.get("authorization")?.replace(/^Bearer /, "") ??
        "";
      if (provided !== expectedKey) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const supabase = createServiceRoleClient();
    // Group by org so each tenant gets their own digest.
    const { data: orgs } = await supabase.from("organizations").select("id, name");
    const results: Array<{ org_id: string; count: number; total: number }> = [];

    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoff = thirtyDaysAgo.toISOString().slice(0, 10);

    for (const org of orgs ?? []) {
      const { data: stale } = await supabase
        .from("invoices")
        .select("id, total_amount, received_date, vendor_name_raw, invoice_number, jobs:job_id (name)")
        .eq("org_id", org.id)
        .in("payment_status", ["unpaid", "scheduled"])
        .in("status", ["qa_approved", "pushed_to_qb", "in_draw"])
        .is("deleted_at", null)
        .lt("received_date", cutoff);
      const count = (stale ?? []).length;
      if (count === 0) continue;

      const totalCents = (stale ?? []).reduce(
        (s, r) => s + ((r as { total_amount: number }).total_amount ?? 0),
        0
      );
      const totalDollars = `$${Math.round(totalCents / 100).toLocaleString("en-US")}`;

      await notifyRole(org.id as string, ["accounting", "admin"], {
        notification_type: "invoice_overdue",
        subject: `${count} invoice(s) 30+ days overdue — ${totalDollars}`,
        body: `${count} invoice(s) totaling ${totalDollars} are 30+ days past their received date and still unpaid.`,
        action_url: `/invoices/payments`,
      });

      await logActivity({
        org_id: org.id as string,
        entity_type: "invoice",
        action: "updated",
        details: { overdue_digest: { count, total: totalCents } },
      });
      results.push({ org_id: org.id as string, count, total: totalCents });
    }

    return NextResponse.json({ ok: true, digests: results });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
