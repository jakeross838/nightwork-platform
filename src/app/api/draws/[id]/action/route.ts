import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const STATUS_FLOW: Record<string, string> = {
  submit: "pm_review",
  approve: "approved",
  mark_submitted: "submitted",
  mark_paid: "paid",
};

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient();
    const { action } = await request.json();

    const newStatus = STATUS_FLOW[action];
    if (!newStatus) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const { data: draw, error: fetchError } = await supabase
      .from("draws")
      .select("status, status_history")
      .eq("id", params.id)
      .single();

    if (fetchError || !draw) {
      return NextResponse.json({ error: "Draw not found" }, { status: 404 });
    }

    const existingHistory = Array.isArray(draw.status_history) ? draw.status_history : [];
    const statusEntry = {
      who: "user",
      when: new Date().toISOString(),
      old_status: draw.status,
      new_status: newStatus,
      note: `Draw ${action.replace(/_/g, " ")}`,
    };

    const updates: Record<string, unknown> = {
      status: newStatus,
      status_history: [...existingHistory, statusEntry],
    };

    if (newStatus === "submitted") updates.submitted_at = new Date().toISOString();
    if (newStatus === "paid") updates.paid_at = new Date().toISOString();

    const { error } = await supabase
      .from("draws")
      .update(updates)
      .eq("id", params.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ status: newStatus });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
