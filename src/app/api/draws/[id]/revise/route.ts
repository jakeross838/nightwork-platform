import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity-log";

export const dynamic = "force-dynamic";

const ORG_ID = "00000000-0000-0000-0000-000000000001";

/**
 * Create a revision of a locked/submitted/approved/paid draw. The original
 * draw stays in place as the historical record. The revision inherits the
 * same draw_number and starts at revision_number = parent.revision_number + 1.
 * Also copies invoice links to the revision, then un-links them from the
 * parent so they appear on the newer revision's line items.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient();

    const { data: original, error: fetchError } = await supabase
      .from("draws")
      .select("*")
      .eq("id", params.id)
      .is("deleted_at", null)
      .single();
    if (fetchError || !original) {
      return NextResponse.json({ error: "Draw not found" }, { status: 404 });
    }

    if (!["submitted", "approved", "locked", "paid"].includes(original.status)) {
      return NextResponse.json(
        {
          error: `Only submitted/approved/locked/paid draws can be revised. Current status: ${original.status}`,
        },
        { status: 400 }
      );
    }

    const newRevisionNumber = ((original as { revision_number?: number }).revision_number ?? 0) + 1;

    const { data: revision, error: createError } = await supabase
      .from("draws")
      .insert({
        job_id: original.job_id,
        draw_number: original.draw_number,
        revision_number: newRevisionNumber,
        parent_draw_id: original.id,
        application_date: original.application_date,
        period_start: original.period_start,
        period_end: original.period_end,
        status: "draft",
        is_final: (original as { is_final?: boolean }).is_final ?? false,
        original_contract_sum: original.original_contract_sum,
        net_change_orders: original.net_change_orders,
        contract_sum_to_date: original.contract_sum_to_date,
        total_completed_to_date: original.total_completed_to_date,
        retainage_on_completed: (original as { retainage_on_completed?: number }).retainage_on_completed ?? 0,
        retainage_on_stored: (original as { retainage_on_stored?: number }).retainage_on_stored ?? 0,
        total_retainage: (original as { total_retainage?: number }).total_retainage ?? 0,
        total_earned_less_retainage:
          (original as { total_earned_less_retainage?: number }).total_earned_less_retainage ?? 0,
        less_previous_certificates:
          (original as { less_previous_certificates?: number }).less_previous_certificates ?? 0,
        less_previous_payments: original.less_previous_payments,
        current_payment_due: original.current_payment_due,
        balance_to_finish: original.balance_to_finish,
        deposit_amount: original.deposit_amount,
        status_history: [
          {
            who: "system",
            when: new Date().toISOString(),
            old_status: null,
            new_status: "draft",
            note: `Revision ${newRevisionNumber} created from Rev ${(original as { revision_number?: number }).revision_number ?? 0} (parent was ${original.status})`,
          },
        ],
        org_id: ORG_ID,
      })
      .select("id, draw_number, revision_number")
      .single();

    if (createError || !revision) {
      return NextResponse.json(
        { error: createError?.message ?? "Failed to create revision" },
        { status: 500 }
      );
    }

    // Move invoices from parent to revision so the new draft starts with the
    // same population. Invoice status stays whatever it was (in_draw if parent
    // was submitted+).
    const { data: invs } = await supabase
      .from("invoices")
      .select("id")
      .eq("draw_id", original.id)
      .is("deleted_at", null);
    const invIds = (invs ?? []).map((i) => i.id as string);
    if (invIds.length > 0) {
      await supabase
        .from("invoices")
        .update({ draw_id: revision.id })
        .in("id", invIds);
    }

    await logActivity({
      org_id: ORG_ID,
      entity_type: "draw",
      entity_id: revision.id as string,
      action: "created",
      details: {
        parent_draw_id: original.id,
        revision_number: newRevisionNumber,
        inherited_invoices: invIds.length,
      },
    });

    return NextResponse.json({
      id: revision.id,
      draw_number: revision.draw_number,
      revision_number: revision.revision_number,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
