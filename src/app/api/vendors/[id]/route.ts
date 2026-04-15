import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { canDeleteVendor, formatBlockers } from "@/lib/deletion-guards";
import { logActivity } from "@/lib/activity-log";
import { getCurrentMembership } from "@/lib/org/session";

export const dynamic = "force-dynamic";

interface PatchBody {
  name?: string;
  default_cost_code_id?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
}

const ALLOWED_FIELDS: (keyof PatchBody)[] = [
  "name",
  "default_cost_code_id",
  "address",
  "phone",
  "email",
  "notes",
];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body: PatchBody = await request.json();

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    let anyField = false;
    for (const f of ALLOWED_FIELDS) {
      if (body[f] !== undefined) {
        updates[f] = body[f];
        anyField = true;
      }
    }
    if (!anyField) {
      return NextResponse.json(
        { error: "At least one editable field is required" },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    const { data, error } = await supabase
      .from("vendors")
      .update(updates)
      .eq("id", id)
      .is("deleted_at", null)
      .select("id, name, default_cost_code_id, address, phone, email, notes")
      .single();

    if (error) {
      console.error("Vendor update error:", error);
      return NextResponse.json({ error: `Failed to update vendor: ${error.message}` }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("Vendor PATCH error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const membership = await getCurrentMembership();
    if (!membership) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const supabase = createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    const guard = await canDeleteVendor(id);
    if (!guard.allowed) {
      await logActivity({
        org_id: membership.org_id,
        user_id: user?.id ?? null,
        entity_type: "vendor",
        entity_id: id,
        action: "delete_blocked",
        details: { blockers: guard.blockers },
      });
      return NextResponse.json({ error: formatBlockers("delete vendor", guard) }, { status: 422 });
    }

    const { error } = await supabase
      .from("vendors")
      .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", id)
      .is("deleted_at", null);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await logActivity({
      org_id: membership.org_id,
      user_id: user?.id ?? null,
      entity_type: "vendor",
      entity_id: id,
      action: "deleted",
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
