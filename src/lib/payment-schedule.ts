/**
 * Payment schedule automation — Phase 8.
 *
 * Org-level payment cadence drives each invoice's scheduled_payment_date.
 * The schedule types live on `organizations.payment_schedule_type`:
 *   - '5_20'    → invoice received by 5th  → pay on 15th. By 20th → pay 30th.
 *   - '15_30'   → received by 15th → pay by end of month. After 15th → pay 15th next month.
 *   - 'monthly' → pay on the last business day of the following month.
 *   - 'custom'  → no automation; manual scheduling only.
 *
 * Weekend/holiday rule: if the computed payment date lands on Sat/Sun, slide
 * to the next Monday. (We don't maintain a federal-holiday calendar yet; the
 * org can manually adjust if a holiday affects a pay cycle.)
 */

import { createServiceRoleClient } from "@/lib/supabase/service";

export type PaymentScheduleType = "5_20" | "15_30" | "monthly" | "custom";

export async function getOrgPaymentSchedule(
  org_id: string
): Promise<PaymentScheduleType> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("organizations")
    .select("payment_schedule_type")
    .eq("id", org_id)
    .maybeSingle();
  return (data?.payment_schedule_type as PaymentScheduleType) ?? "5_20";
}

/**
 * Given a received_date and a schedule type, compute when the invoice should
 * be paid. Returns null for 'custom' (manual) or when received_date is null.
 */
export function scheduledPaymentDate(
  received_date: string | null,
  schedule: PaymentScheduleType
): string | null {
  if (!received_date || schedule === "custom") return null;
  const d = parseDate(received_date);
  if (!d) return null;

  const year = d.getUTCFullYear();
  const month = d.getUTCMonth();
  const day = d.getUTCDate();

  let target: Date;
  if (schedule === "5_20") {
    if (day <= 5) {
      target = new Date(Date.UTC(year, month, 15));
    } else if (day <= 20) {
      // Last day of this month (UTC day 0 of next month).
      target = new Date(Date.UTC(year, month + 1, 0));
    } else {
      // After the 20th — rolls to next month 15.
      target = new Date(Date.UTC(year, month + 1, 15));
    }
  } else if (schedule === "15_30") {
    if (day <= 15) {
      target = new Date(Date.UTC(year, month + 1, 0)); // end of this month
    } else {
      target = new Date(Date.UTC(year, month + 1, 15));
    }
  } else {
    // monthly: pay at the end of the NEXT month.
    target = new Date(Date.UTC(year, month + 2, 0));
  }

  // Bump off weekends.
  const dow = target.getUTCDay();
  if (dow === 6) target.setUTCDate(target.getUTCDate() + 2); // Sat → Mon
  else if (dow === 0) target.setUTCDate(target.getUTCDate() + 1); // Sun → Mon

  return `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, "0")}-${String(target.getUTCDate()).padStart(2, "0")}`;
}

function parseDate(s: string): Date | null {
  // Treat plain YYYY-MM-DD as UTC midnight to avoid local-TZ drift.
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

/**
 * Set scheduled_payment_date on every invoice in a draw that doesn't already
 * have one (status 'unpaid' with a null scheduled_payment_date). Used when
 * the draw is approved.
 */
export async function autoScheduleDrawPayments(args: {
  draw_id: string;
  org_id: string;
}): Promise<number> {
  const supabase = createServiceRoleClient();
  const schedule = await getOrgPaymentSchedule(args.org_id);
  const { data: invs } = await supabase
    .from("invoices")
    .select("id, received_date, payment_status, scheduled_payment_date")
    .eq("draw_id", args.draw_id)
    .is("deleted_at", null);
  if (!invs || invs.length === 0) return 0;

  let updated = 0;
  for (const inv of invs) {
    const row = inv as {
      id: string;
      received_date: string | null;
      payment_status: string;
      scheduled_payment_date: string | null;
    };
    if (row.payment_status === "paid") continue;
    if (row.scheduled_payment_date) continue;
    const date = scheduledPaymentDate(row.received_date, schedule);
    if (!date) continue;
    await supabase
      .from("invoices")
      .update({
        scheduled_payment_date: date,
        payment_status: row.payment_status === "unpaid" ? "scheduled" : row.payment_status,
      })
      .eq("id", row.id);
    updated++;
  }
  return updated;
}
