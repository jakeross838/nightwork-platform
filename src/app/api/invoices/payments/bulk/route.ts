import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity-log";
import { getOrgPaymentSchedule, scheduledPaymentDate } from "@/lib/payment-schedule";

export const dynamic = "force-dynamic";

const ORG_ID = "00000000-0000-0000-0000-000000000001";

/**
 * POST /api/invoices/payments/bulk
 * Body: { ids: string[], action: 'schedule' | 'mark_paid',
 *         payment_date?, payment_method? }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const body = (await request.json()) as {
      ids?: string[];
      action?: "schedule" | "mark_paid";
      payment_date?: string;
      payment_method?: string;
    };
    const ids = body.ids ?? [];
    if (ids.length === 0) {
      return NextResponse.json({ error: "No ids provided" }, { status: 400 });
    }

    if (body.action === "schedule") {
      const schedule = await getOrgPaymentSchedule(ORG_ID);
      const { data: invs } = await supabase
        .from("invoices")
        .select("id, received_date, payment_status")
        .in("id", ids);
      let updated = 0;
      for (const inv of invs ?? []) {
        if (inv.payment_status === "paid") continue;
        const date = scheduledPaymentDate(inv.received_date as string | null, schedule);
        if (!date) continue;
        await supabase
          .from("invoices")
          .update({ scheduled_payment_date: date, payment_status: "scheduled" })
          .eq("id", inv.id);
        updated++;
      }
      await logActivity({
        org_id: ORG_ID,
        entity_type: "invoice",
        action: "updated",
        details: { bulk_schedule: updated },
      });
      return NextResponse.json({ ok: true, updated });
    }

    if (body.action === "mark_paid") {
      const payment_date = body.payment_date ?? new Date().toISOString().slice(0, 10);
      const payment_method = body.payment_method ?? "check";
      const { data: invs } = await supabase
        .from("invoices")
        .select("id, total_amount")
        .in("id", ids);
      for (const inv of invs ?? []) {
        await supabase
          .from("invoices")
          .update({
            payment_status: "paid",
            payment_date,
            payment_amount: (inv as { total_amount: number }).total_amount,
            payment_method,
            status: "paid",
          })
          .eq("id", inv.id);
      }
      await logActivity({
        org_id: ORG_ID,
        entity_type: "invoice",
        action: "status_changed",
        details: { bulk_paid: (invs ?? []).length, payment_method },
      });
      return NextResponse.json({ ok: true, updated: (invs ?? []).length });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
