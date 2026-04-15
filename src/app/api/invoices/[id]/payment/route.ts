import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity-log";
import { getOrgPaymentSchedule, scheduledPaymentDate } from "@/lib/payment-schedule";
import { notifyRole, sendNotification } from "@/lib/notifications";

export const dynamic = "force-dynamic";

const ORG_ID = "00000000-0000-0000-0000-000000000001";

/**
 * POST /api/invoices/:id/payment
 * Body: { action: 'schedule' | 'mark_paid' | 'reverse' | 'update',
 *         scheduled_payment_date?, payment_date?, payment_amount?,
 *         payment_method?, payment_reference? }
 *
 * Implements the Phase 8 payment workflow:
 *   - schedule   → set scheduled_payment_date (auto-calculated if omitted),
 *                  payment_status → 'scheduled'
 *   - mark_paid  → set payment_date/amount/method/reference,
 *                  payment_status → 'paid' (or 'partial' if amount < total),
 *                  invoice.status → 'paid' when fully paid
 *   - reverse    → clear payment fields, payment_status → 'unpaid'
 *                  (blocked if draw is locked)
 *   - update     → edit individual fields without changing status
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient();
    const body = (await request.json()) as Record<string, unknown>;
    const action = body.action as string;

    const { data: invoice, error: fetchError } = await supabase
      .from("invoices")
      .select(
        "id, status, org_id, total_amount, received_date, payment_status, scheduled_payment_date, draw_id"
      )
      .eq("id", params.id)
      .single();
    if (fetchError || !invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Paid/denied/pending invoices cannot be paid — must be approved first.
    if (action === "mark_paid" || action === "schedule") {
      if (
        !["pm_approved", "qa_review", "qa_approved", "pushed_to_qb", "in_draw", "paid"].includes(
          invoice.status
        )
      ) {
        return NextResponse.json(
          {
            error: `Invoice must be approved before being scheduled/paid. Current status: ${invoice.status}`,
          },
          { status: 400 }
        );
      }
    }

    const nowIso = new Date().toISOString();

    if (action === "schedule") {
      let date = body.scheduled_payment_date as string | undefined;
      if (!date) {
        const schedule = await getOrgPaymentSchedule(invoice.org_id as string);
        date = scheduledPaymentDate(invoice.received_date as string | null, schedule) ?? undefined;
      }
      if (!date) {
        return NextResponse.json(
          { error: "Could not compute a scheduled date — please specify one manually." },
          { status: 400 }
        );
      }
      await supabase
        .from("invoices")
        .update({
          scheduled_payment_date: date,
          payment_status: "scheduled",
        })
        .eq("id", params.id);
      await logActivity({
        org_id: ORG_ID,
        entity_type: "invoice",
        entity_id: params.id,
        action: "updated",
        details: { scheduled_payment_date: date, payment_status: "scheduled" },
      });
      // Notify vendor if they have an email; otherwise fall back to accounting.
      try {
        const { data: full } = await supabase
          .from("invoices")
          .select(
            "total_amount, vendor_name_raw, vendors:vendor_id (id, name, email)"
          )
          .eq("id", params.id)
          .maybeSingle();
        const vendor = Array.isArray(full?.vendors) ? full?.vendors[0] : full?.vendors;
        const vendorEmail = (vendor as { email?: string | null } | null)?.email ?? null;
        const vendorName = (vendor as { name?: string } | null)?.name ?? full?.vendor_name_raw ?? "vendor";
        const amt = full
          ? `$${Math.round((full.total_amount as number) / 100).toLocaleString("en-US")}`
          : "a payment";
        if (vendorEmail) {
          await sendNotification({
            to_email: vendorEmail,
            org_id: ORG_ID,
            notification_type: "payment_scheduled",
            subject: `Payment ${amt} scheduled for ${date}`,
            body: `Ross Built has scheduled a payment of ${amt} to ${vendorName} for ${date}.`,
            action_url: `/invoices/${params.id}`,
          });
        } else {
          await notifyRole(ORG_ID, ["accounting"], {
            notification_type: "payment_scheduled",
            subject: `Payment scheduled — ${vendorName}`,
            body: `Payment of ${amt} to ${vendorName} scheduled for ${date}.`,
            action_url: `/invoices/${params.id}`,
          });
        }
      } catch (err) {
        console.warn(`[payment schedule notify] ${err instanceof Error ? err.message : err}`);
      }
      return NextResponse.json({ ok: true, scheduled_payment_date: date });
    }

    if (action === "mark_paid") {
      const payment_date = (body.payment_date as string | undefined) ?? nowIso.slice(0, 10);
      const payment_amount =
        (body.payment_amount as number | undefined) ?? (invoice.total_amount as number);
      const payment_method = (body.payment_method as string | undefined) ?? "check";
      const payment_reference = (body.payment_reference as string | undefined) ?? null;
      const isFullPay = payment_amount >= (invoice.total_amount as number);
      const newPayStatus = isFullPay ? "paid" : "partial";
      const updates: Record<string, unknown> = {
        payment_date,
        payment_amount,
        payment_method,
        payment_reference,
        payment_status: newPayStatus,
      };
      // Flip invoice.status to 'paid' when fully paid.
      if (isFullPay) updates.status = "paid";
      await supabase.from("invoices").update(updates).eq("id", params.id);
      await logActivity({
        org_id: ORG_ID,
        entity_type: "invoice",
        entity_id: params.id,
        action: "status_changed",
        details: {
          from: invoice.status,
          to: isFullPay ? "paid" : invoice.status,
          payment_amount,
          payment_method,
          payment_reference,
        },
      });
      return NextResponse.json({ ok: true, payment_status: newPayStatus });
    }

    if (action === "reverse") {
      // Don't let users reverse payment on a locked draw.
      if (invoice.draw_id) {
        const { data: drawRow } = await supabase
          .from("draws")
          .select("status")
          .eq("id", invoice.draw_id as string)
          .maybeSingle();
        if (drawRow && ["locked", "paid"].includes(drawRow.status)) {
          return NextResponse.json(
            {
              error: `Cannot reverse payment — draw is '${drawRow.status}'. Revise the draw first.`,
            },
            { status: 400 }
          );
        }
      }
      await supabase
        .from("invoices")
        .update({
          payment_status: "unpaid",
          payment_amount: null,
          payment_method: null,
          payment_reference: null,
          payment_date: null,
        })
        .eq("id", params.id);
      await logActivity({
        org_id: ORG_ID,
        entity_type: "invoice",
        entity_id: params.id,
        action: "updated",
        details: { payment_reversed: true, prior_status: invoice.payment_status },
      });
      return NextResponse.json({ ok: true });
    }

    if (action === "update") {
      const allowed = [
        "scheduled_payment_date",
        "payment_method",
        "payment_reference",
      ];
      const updates: Record<string, unknown> = {};
      for (const k of allowed) if (k in body) updates[k] = body[k];
      if (Object.keys(updates).length > 0) {
        await supabase.from("invoices").update(updates).eq("id", params.id);
      }
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
