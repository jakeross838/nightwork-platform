import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { ApiError, withApiError } from "@/lib/api/errors";
import { getCurrentMembership } from "@/lib/org/session";
import { correctLine } from "@/lib/cost-intelligence/correct-line";
import type {
  ProposedItemData,
  ComponentType,
  ComponentSource,
} from "@/lib/cost-intelligence/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const COMPONENT_TYPES: ComponentType[] = [
  "material",
  "fabrication",
  "installation",
  "labor",
  "equipment_rental",
  "delivery",
  "fuel_surcharge",
  "handling",
  "restocking",
  "tax",
  "waste_disposal",
  "permit_fee",
  "bundled",
  "other",
];

const COMPONENT_SOURCES: ComponentSource[] = [
  "invoice_explicit",
  "ai_extracted",
  "human_added",
  "default_bundled",
];

interface BodyComponent {
  component_type: ComponentType;
  amount_cents: number;
  source?: ComponentSource;
  notes?: string | null;
  quantity?: number | null;
  unit?: string | null;
  unit_rate_cents?: number | null;
}

interface Body {
  line_ids?: string[];
  classification?: {
    item_id?: string;
    new_item?: ProposedItemData;
  };
  /**
   * Components to apply uniformly to every line in the group. If omitted,
   * each line's existing staged components stay put (useful when the PM
   * only changed the classification).
   */
  components?: BodyComponent[];
  correction_notes?: string;
}

function validateComponent(c: unknown): BodyComponent | null {
  if (!c || typeof c !== "object") return null;
  const obj = c as Record<string, unknown>;
  const type = typeof obj.component_type === "string" ? obj.component_type : "";
  if (!COMPONENT_TYPES.includes(type as ComponentType)) return null;
  const amountCents =
    typeof obj.amount_cents === "number" && Number.isFinite(obj.amount_cents)
      ? Math.round(obj.amount_cents)
      : null;
  if (amountCents == null) return null;
  const source =
    typeof obj.source === "string" && COMPONENT_SOURCES.includes(obj.source as ComponentSource)
      ? (obj.source as ComponentSource)
      : "human_added";
  return {
    component_type: type as ComponentType,
    amount_cents: amountCents,
    source,
    notes: typeof obj.notes === "string" ? obj.notes : null,
    quantity:
      typeof obj.quantity === "number" && Number.isFinite(obj.quantity) ? obj.quantity : null,
    unit: typeof obj.unit === "string" ? obj.unit : null,
    unit_rate_cents:
      typeof obj.unit_rate_cents === "number" && Number.isFinite(obj.unit_rate_cents)
        ? Math.round(obj.unit_rate_cents)
        : null,
  };
}

/**
 * POST /api/cost-intelligence/extraction-lines/bulk-approve-group
 *
 * Applies one classification + (optionally) one component breakdown to a
 * group of extraction lines the PM reviewed together. All lines get
 * committed to the spine with the same item_id.
 *
 * Body:
 *   {
 *     line_ids: [uuid, ...],
 *     classification: { item_id } | { new_item: ProposedItemData },
 *     components?: [{ component_type, amount_cents, source?, notes?, ... }],
 *     correction_notes?: string
 *   }
 */
export const POST = withApiError(async (req: NextRequest) => {
  const membership = await getCurrentMembership();
  if (!membership) throw new ApiError("Not authenticated", 401);
  if (!["owner", "admin", "pm", "accounting"].includes(membership.role)) {
    throw new ApiError("Insufficient permissions", 403);
  }

  const supabase = createServerClient();
  const { data: user } = await supabase.auth.getUser();
  const userId = user.user?.id ?? null;
  if (!userId) throw new ApiError("Must be logged in", 401);

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    throw new ApiError("Invalid JSON body", 400);
  }

  const lineIds = Array.isArray(body.line_ids) ? body.line_ids.filter((id) => typeof id === "string") : [];
  if (lineIds.length === 0) {
    throw new ApiError("line_ids is required", 400);
  }
  if (lineIds.length > 200) {
    throw new ApiError("Max 200 line_ids per request", 400);
  }

  const classification = body.classification ?? {};
  const hasItemId = typeof classification.item_id === "string" && classification.item_id.length > 0;
  const hasNewItem = classification.new_item && typeof classification.new_item === "object";
  if (!hasItemId && !hasNewItem) {
    throw new ApiError("classification.item_id or classification.new_item required", 400);
  }

  const rawComponents = Array.isArray(body.components) ? body.components : [];
  const validatedComponents = rawComponents
    .map(validateComponent)
    .filter((c): c is BodyComponent => c !== null);

  // 1. Authorize: all lines belong to caller's org and are pending.
  const { data: lines, error: linesErr } = await supabase
    .from("invoice_extraction_lines")
    .select("id, org_id, verification_status, raw_total_cents, is_allocated_overhead, is_transaction_line")
    .in("id", lineIds)
    .is("deleted_at", null);

  if (linesErr) throw new ApiError(`Failed to load lines: ${linesErr.message}`, 500);

  const loaded = (lines ?? []) as Array<{
    id: string;
    org_id: string;
    verification_status: string;
    raw_total_cents: number | null;
    is_allocated_overhead: boolean;
    is_transaction_line: boolean;
  }>;

  if (loaded.length !== lineIds.length) {
    throw new ApiError("Some line_ids were not found", 404);
  }

  for (const l of loaded) {
    if (l.org_id !== membership.org_id) {
      throw new ApiError(`Line ${l.id} not in your org`, 403);
    }
    if (l.verification_status !== "pending") {
      throw new ApiError(
        `Line ${l.id} is ${l.verification_status}, not pending`,
        409
      );
    }
    if (l.is_allocated_overhead) {
      throw new ApiError(`Line ${l.id} is an overhead row and cannot be approved`, 400);
    }
    if (l.is_transaction_line) {
      throw new ApiError(
        `Line ${l.id} is a transaction line — use mark-non-item instead`,
        400
      );
    }
  }

  // 2. Resolve target item_id. If creating a new item, the calling client
  //    sends the proposed data; we persist it once so the whole group maps
  //    to the same item row. We let correctLine / commitLineToSpine insert
  //    the item on the FIRST line then re-use that id for subsequent lines.
  const approved: string[] = [];
  const errors: Array<{ line_id: string; error: string }> = [];
  let resolvedItemId: string | null = hasItemId ? classification.item_id! : null;

  // Replace components on each line with the user-supplied set, if any.
  if (validatedComponents.length > 0) {
    for (const lineId of lineIds) {
      const { error: delErr } = await supabase
        .from("line_cost_components")
        .update({ deleted_at: new Date().toISOString() })
        .eq("invoice_extraction_line_id", lineId)
        .is("deleted_at", null);
      if (delErr) {
        errors.push({ line_id: lineId, error: `Reset components failed: ${delErr.message}` });
        continue;
      }
      const inserts = validatedComponents.map((c, i) => ({
        org_id: membership.org_id,
        invoice_extraction_line_id: lineId,
        component_type: c.component_type,
        amount_cents: c.amount_cents,
        source: c.source ?? "human_added",
        notes: c.notes ?? null,
        quantity: c.quantity ?? null,
        unit: c.unit ?? null,
        unit_rate_cents: c.unit_rate_cents ?? null,
        display_order: i,
        created_by: userId,
      }));
      const { error: insErr } = await supabase.from("line_cost_components").insert(inserts);
      if (insErr) {
        errors.push({ line_id: lineId, error: `Insert components failed: ${insErr.message}` });
      }
    }
  }

  for (const lineId of lineIds) {
    try {
      if (resolvedItemId) {
        await correctLine(
          supabase,
          lineId,
          {
            corrected_item_id: resolvedItemId,
            correction_notes: body.correction_notes,
          },
          userId
        );
      } else {
        // First line of a new-item group — creates the item row so the rest
        // of the group can re-use its id.
        const result = await correctLine(
          supabase,
          lineId,
          {
            corrected_proposed_data: classification.new_item,
            correction_notes: body.correction_notes,
          },
          userId
        );
        resolvedItemId = result.item_id;
      }
      approved.push(lineId);
    } catch (err) {
      errors.push({
        line_id: lineId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({
    approved: approved.length,
    failed: errors.length,
    item_id: resolvedItemId,
    approved_line_ids: approved,
    errors,
  });
});
