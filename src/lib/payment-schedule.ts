/**
 * Utility functions for invoice payment scheduling.
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
 *
 * ─── Phase 1.3 narrowing ───────────────────────────────────────────────
 * Previously this module also exported `autoScheduleDrawPayments` — the
 * function that bulk-scheduled every invoice in a newly-approved draw. As
 * part of the atomic-cascade rebuild, that logic moved into the
 * `draw_approve_rpc` Postgres function (see migration 00061). This module
 * is now utility-only and serves `src/app/api/invoices/[id]/payment/route.ts`
 * and `src/app/api/invoices/payments/bulk/route.ts`.
 *
 * The date-math here is duplicated in PL/pgSQL as
 * `public._compute_scheduled_payment_date` (migration 00061). Any change to
 * the schedule semantics must be reflected in BOTH implementations until a
 * later branch consolidates them — tracked as a Branch 8/9 cleanup
 * candidate (see Phase 1.3 QA report for the GH issue reference).
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
 *
 * Mirrored in migration 00061 as `_compute_scheduled_payment_date`.
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
      target = new Date(Date.UTC(year, month + 1, 0));
    } else {
      target = new Date(Date.UTC(year, month + 1, 15));
    }
  } else if (schedule === "15_30") {
    if (day <= 15) {
      target = new Date(Date.UTC(year, month + 1, 0));
    } else {
      target = new Date(Date.UTC(year, month + 1, 15));
    }
  } else {
    target = new Date(Date.UTC(year, month + 2, 0));
  }

  const dow = target.getUTCDay();
  if (dow === 6) target.setUTCDate(target.getUTCDate() + 2);
  else if (dow === 0) target.setUTCDate(target.getUTCDate() + 1);

  return `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, "0")}-${String(target.getUTCDate()).padStart(2, "0")}`;
}

function parseDate(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}
