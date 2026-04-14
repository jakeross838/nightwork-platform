import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { ApiError, withApiError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

interface PartialApproveBody {
  approved_line_item_ids: string[];
  note: string; // reason for the held portion
}

export const POST = withApiError(
  async (request: NextRequest, { params }: { params: { id: string } }) => {
    const supabase = createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new ApiError("Not authenticated", 401);

    const body: PartialApproveBody = await request.json();
    if (!body.note || !body.note.trim()) {
      throw new ApiError("A note is required — explain why the remaining lines are held", 400);
    }
    if (!body.approved_line_item_ids || body.approved_line_item_ids.length === 0) {
      throw new ApiError("Select at least one line item to approve", 400);
    }

    // Load parent invoice
    const { data: parent, error: parentErr } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", params.id)
      .is("deleted_at", null)
      .single();
    if (parentErr || !parent) throw new ApiError("Invoice not found", 404);

    if (!parent.job_id || !parent.cost_code_id) {
      throw new ApiError("Job and cost code must be assigned before partial approval", 422);
    }

    // Load parent's line items
    const { data: allLines } = await supabase
      .from("invoice_line_items")
      .select("*")
      .eq("invoice_id", params.id)
      .is("deleted_at", null)
      .order("line_index", { ascending: true });
    const lines = (allLines ?? []) as Array<{
      id: string;
      line_index: number;
      description: string | null;
      qty: number | null;
      unit: string | null;
      rate: number | null;
      amount_cents: number;
      cost_code_id: string | null;
      budget_line_id: string | null;
      is_change_order: boolean;
      co_reference: string | null;
      ai_suggested_cost_code_id: string | null;
      ai_suggestion_confidence: number | null;
    }>;
    if (lines.length === 0) {
      throw new ApiError("Invoice has no line items — use Approve or Deny instead", 422);
    }

    const approvedSet = new Set(body.approved_line_item_ids);
    const approvedLines = lines.filter((l) => approvedSet.has(l.id));
    const heldLines = lines.filter((l) => !approvedSet.has(l.id));

    if (approvedLines.length === 0) throw new ApiError("No approved lines found", 400);
    if (heldLines.length === 0) {
      throw new ApiError("All lines are approved — use the regular Approve button instead", 400);
    }

    // Block approval if any approved CO line is missing a co_reference.
    const missingRef = approvedLines.filter(
      (l) => l.is_change_order && (!l.co_reference || !l.co_reference.trim())
    );
    if (missingRef.length > 0) {
      return NextResponse.json(
        {
          error: `CO Reference required on ${missingRef.length} change-order line(s) before approval`,
          lines: missingRef,
        },
        { status: 422 }
      );
    }

    const approvedTotal = approvedLines.reduce((s, l) => s + (l.amount_cents ?? 0), 0);
    const heldTotal = heldLines.reduce((s, l) => s + (l.amount_cents ?? 0), 0);
    const nowIso = new Date().toISOString();

    // Create child invoice for approved portion
    const childInsert: Record<string, unknown> = {
      job_id: parent.job_id,
      vendor_id: parent.vendor_id,
      cost_code_id: parent.cost_code_id,
      po_id: parent.po_id,
      co_id: parent.co_id,
      invoice_number: parent.invoice_number
        ? `${parent.invoice_number}-A`
        : null,
      invoice_date: parent.invoice_date,
      vendor_name_raw: parent.vendor_name_raw,
      job_reference_raw: parent.job_reference_raw,
      po_reference_raw: parent.po_reference_raw,
      co_reference_raw: parent.co_reference_raw,
      description: parent.description,
      total_amount: approvedTotal,
      ai_parsed_total_amount: approvedTotal,
      is_change_order: parent.is_change_order,
      invoice_type: parent.invoice_type,
      confidence_score: parent.confidence_score,
      confidence_details: parent.confidence_details,
      ai_model_used: parent.ai_model_used,
      ai_raw_response: parent.ai_raw_response,
      status: "pm_approved",
      status_history: [
        {
          who: "pm",
          when: nowIso,
          old_status: null,
          new_status: "pm_approved",
          note: `Approved portion of partial split from invoice ${parent.invoice_number ?? parent.id}`,
        },
        {
          who: "system",
          when: nowIso,
          old_status: "pm_approved",
          new_status: "qa_review",
          note: "Auto-routed to QA review",
        },
      ],
      received_date: parent.received_date,
      payment_date: parent.payment_date,
      original_file_url: parent.original_file_url,
      original_file_type: parent.original_file_type,
      original_filename: parent.original_filename,
      signed_file_url: parent.signed_file_url,
      document_category: parent.document_category,
      assigned_pm_id: parent.assigned_pm_id,
      parent_invoice_id: parent.id,
      org_id: parent.org_id,
      created_by: user.id,
    };

    // Auto-advance to qa_review like the single-Approve flow does.
    childInsert.status = "qa_review";

    const { data: childRow, error: childErr } = await supabase
      .from("invoices")
      .insert(childInsert)
      .select("id")
      .single();
    if (childErr || !childRow) {
      throw new ApiError(`Failed to create approved portion: ${childErr?.message ?? "unknown error"}`, 500);
    }

    // Move approved line items to the child invoice (retain their ids, just update invoice_id).
    const approvedIds = approvedLines.map((l) => l.id);
    const { error: moveErr } = await supabase
      .from("invoice_line_items")
      .update({ invoice_id: childRow.id, updated_at: nowIso })
      .in("id", approvedIds);
    if (moveErr) {
      // Attempt rollback of the child row so we don't leave orphans.
      await supabase.from("invoices").update({ deleted_at: nowIso }).eq("id", childRow.id);
      throw new ApiError(`Failed to move line items: ${moveErr.message}`, 500);
    }

    // Update parent: reduce total, set pm_held status, write the note + history entry.
    const parentHistory = Array.isArray(parent.status_history) ? parent.status_history : [];
    const { error: parentUpdateErr } = await supabase
      .from("invoices")
      .update({
        total_amount: heldTotal,
        status: "pm_held",
        partial_approval_note: body.note.trim(),
        status_history: [
          ...parentHistory,
          {
            who: "pm",
            when: nowIso,
            old_status: parent.status,
            new_status: "pm_held",
            note: `Partial approval: ${approvedLines.length} line(s) totaling ${approvedTotal} split to new invoice. Reason for held portion: ${body.note.trim()}`,
          },
        ],
      })
      .eq("id", parent.id);

    if (parentUpdateErr) {
      throw new ApiError(`Failed to update parent invoice: ${parentUpdateErr.message}`, 500);
    }

    return NextResponse.json({
      child_invoice_id: childRow.id,
      approved_total: approvedTotal,
      held_total: heldTotal,
      approved_line_count: approvedLines.length,
      held_line_count: heldLines.length,
    });
  }
);
