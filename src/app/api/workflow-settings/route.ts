import { NextRequest, NextResponse } from "next/server";
import { ApiError, withApiError } from "@/lib/api/errors";
import { ADMIN_OR_OWNER, requireRole } from "@/lib/org/require";
import {
  getWorkflowSettings,
  invalidateWorkflowSettings,
  type DuplicateSensitivity,
} from "@/lib/workflow-settings";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const BOOL_COLUMNS = new Set([
  "batch_approval_enabled",
  "quick_approve_enabled",
  "require_invoice_date",
  "require_budget_allocation",
  "require_po_linkage",
  "over_budget_requires_note",
  "duplicate_detection_enabled",
  "auto_route_high_confidence",
  "require_lien_release_for_draw",
  "co_approval_required",
  "payment_auto_scheduling",
]);

const INT_COLUMNS = new Set([
  "quick_approve_min_confidence",
  "auto_route_confidence_threshold",
  "import_max_batch_size",
  "import_auto_route_threshold",
]);

// UUID columns that accept a UUID string or null (for "unset")
const UUID_COLUMNS = new Set(["import_default_pm_id"]);

const VALID_SENSITIVITY: DuplicateSensitivity[] = ["strict", "moderate", "loose"];

// GET is readable by any active org member (PMs need to know which gates apply).
// PATCH is admin/owner only.
export const GET = withApiError(async () => {
  const { getCurrentMembership } = await import("@/lib/org/session");
  const membership = await getCurrentMembership();
  if (!membership) throw new ApiError("Not authenticated", 401);
  const settings = await getWorkflowSettings(membership.org_id);
  return NextResponse.json({ settings });
});

export const PATCH = withApiError(async (request: NextRequest) => {
  const membership = await requireRole(ADMIN_OR_OWNER);
  const body = (await request.json()) as Record<string, unknown>;

  const update: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (BOOL_COLUMNS.has(k) && typeof v === "boolean") {
      update[k] = v;
    } else if (INT_COLUMNS.has(k) && typeof v === "number") {
      // max_batch_size has a different range (1–200) than confidence %s (0–100).
      const bounds = k === "import_max_batch_size"
        ? { min: 1, max: 200 }
        : { min: 0, max: 100 };
      update[k] = Math.max(bounds.min, Math.min(bounds.max, Math.round(v)));
    } else if (UUID_COLUMNS.has(k) && (typeof v === "string" || v === null)) {
      // null / empty string = unset. Otherwise must look like a UUID.
      const s = typeof v === "string" ? v.trim() : "";
      if (!s) update[k] = null;
      else if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) {
        update[k] = s;
      }
    } else if (
      k === "duplicate_detection_sensitivity" &&
      typeof v === "string" &&
      VALID_SENSITIVITY.includes(v as DuplicateSensitivity)
    ) {
      update[k] = v;
    } else if (
      k === "cover_letter_template" &&
      (typeof v === "string" || v === null)
    ) {
      // Empty string normalizes to NULL so "use default" is unambiguous.
      const trimmed = typeof v === "string" ? v.trim() : null;
      update[k] = trimmed && trimmed.length > 0 ? v : null;
    }
  }
  if (Object.keys(update).length === 0) {
    throw new ApiError("No editable fields supplied", 400);
  }

  const supabase = createServerClient();

  // Upsert by org_id so a missing row is created on first save (defensive —
  // the trigger should have done this at org creation).
  const existing = await supabase
    .from("org_workflow_settings")
    .select("id")
    .eq("org_id", membership.org_id)
    .maybeSingle();

  if (existing.data) {
    const { error } = await supabase
      .from("org_workflow_settings")
      .update(update)
      .eq("org_id", membership.org_id);
    if (error) throw new ApiError(error.message, 500);
  } else {
    const { error } = await supabase
      .from("org_workflow_settings")
      .insert({ org_id: membership.org_id, ...update });
    if (error) throw new ApiError(error.message, 500);
  }

  invalidateWorkflowSettings(membership.org_id);

  const settings = await getWorkflowSettings(membership.org_id);
  return NextResponse.json({ ok: true, settings });
});
