import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

interface ActionRequest {
  action: "approve" | "hold" | "deny" | "request_info";
  note?: string;
  pm_overrides?: Record<string, { old: unknown; new: unknown }>;
  updates?: Record<string, unknown>;
}

const ACTION_STATUS_MAP: Record<string, string> = {
  approve: "pm_approved",
  hold: "pm_held",
  deny: "pm_denied",
  request_info: "pm_held",
};

const NEXT_STATUS_MAP: Record<string, string> = {
  pm_approved: "qa_review",
};

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient();
    const body: ActionRequest = await request.json();
    const { action, note, pm_overrides, updates } = body;

    if (!ACTION_STATUS_MAP[action]) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    if ((action === "hold" || action === "deny") && !note) {
      return NextResponse.json(
        { error: `${action} requires a note` },
        { status: 400 }
      );
    }

    // Get current invoice
    const { data: invoice, error: fetchError } = await supabase
      .from("invoices")
      .select("status, status_history, pm_overrides")
      .eq("id", params.id)
      .single();

    if (fetchError || !invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const newStatus = ACTION_STATUS_MAP[action];
    const finalStatus = NEXT_STATUS_MAP[newStatus] ?? newStatus;

    const statusEntry = {
      who: "pm",
      when: new Date().toISOString(),
      old_status: invoice.status,
      new_status: finalStatus,
      note: note ?? `PM ${action}d`,
    };

    const existingHistory = Array.isArray(invoice.status_history)
      ? invoice.status_history
      : [];

    const mergedOverrides = {
      ...(invoice.pm_overrides as Record<string, unknown> ?? {}),
      ...(pm_overrides ?? {}),
    };

    const updatePayload: Record<string, unknown> = {
      status: finalStatus,
      status_history: [...existingHistory, statusEntry],
      pm_overrides: Object.keys(mergedOverrides).length > 0 ? mergedOverrides : null,
      ...(updates ?? {}),
    };

    const { error: updateError } = await supabase
      .from("invoices")
      .update(updatePayload)
      .eq("id", params.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ status: finalStatus, action });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
