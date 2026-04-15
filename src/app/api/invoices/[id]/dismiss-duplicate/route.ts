import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { ApiError, withApiError } from "@/lib/api/errors";
import { logStatusChange } from "@/lib/activity-log";
import { getCurrentMembership } from "@/lib/org/session";

export const dynamic = "force-dynamic";

export const POST = withApiError(async (
  _request: NextRequest,
  { params }: { params: { id: string } }
) => {
  const membership = await getCurrentMembership();
  if (!membership) throw new ApiError("Not authenticated", 401);

  const supabase = createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: invoice, error: fetchErr } = await supabase
    .from("invoices")
    .select("id, org_id, is_potential_duplicate, duplicate_of_id, status")
    .eq("id", params.id)
    .maybeSingle();

  if (fetchErr || !invoice) throw new ApiError("Invoice not found", 404);

  if (!invoice.is_potential_duplicate) {
    return NextResponse.json({ ok: true, note: "Not flagged" });
  }

  const { error: updErr } = await supabase
    .from("invoices")
    .update({
      is_potential_duplicate: false,
      duplicate_dismissed_at: new Date().toISOString(),
      duplicate_dismissed_by: user?.id ?? null,
    })
    .eq("id", params.id);

  if (updErr) throw new ApiError(updErr.message, 500);

  await logStatusChange({
    org_id: (invoice.org_id as string | null) ?? membership.org_id,
    user_id: user?.id ?? null,
    entity_type: "invoice",
    entity_id: params.id,
    from: invoice.status as string,
    to: invoice.status as string,
    reason: "Duplicate flag dismissed",
    extra: {
      action: "dismiss_duplicate",
      duplicate_of_id: invoice.duplicate_of_id ?? null,
    },
  });

  return NextResponse.json({ ok: true });
});
