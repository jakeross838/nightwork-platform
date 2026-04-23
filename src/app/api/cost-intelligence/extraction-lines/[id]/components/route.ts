import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { ApiError, withApiError } from "@/lib/api/errors";
import { getCurrentMembership } from "@/lib/org/session";
import type {
  ComponentType,
  ComponentSource,
} from "@/lib/cost-intelligence/types";

export const dynamic = "force-dynamic";

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

interface IncomingComponent {
  component_type: ComponentType;
  amount_cents: number;
  source?: ComponentSource;
  notes?: string | null;
  quantity?: number | null;
  unit?: string | null;
  unit_rate_cents?: number | null;
}

function validate(raw: unknown): IncomingComponent | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const type = typeof obj.component_type === "string" ? obj.component_type : "";
  if (!COMPONENT_TYPES.includes(type as ComponentType)) return null;
  const amount =
    typeof obj.amount_cents === "number" && Number.isFinite(obj.amount_cents)
      ? Math.round(obj.amount_cents)
      : null;
  if (amount == null) return null;
  const source = typeof obj.source === "string" ? obj.source : "human_added";
  return {
    component_type: type as ComponentType,
    amount_cents: amount,
    source: COMPONENT_SOURCES.includes(source as ComponentSource)
      ? (source as ComponentSource)
      : "human_added",
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
 * PUT /api/cost-intelligence/extraction-lines/[id]/components
 *
 * Replace the full set of components on one pending extraction line.
 * Soft-deletes the existing set and inserts the new set atomically enough
 * for this workflow (no DB transaction API via Supabase JS — if the insert
 * fails the caller is told so the UI can retry).
 */
export const PUT = withApiError(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const membership = await getCurrentMembership();
    if (!membership) throw new ApiError("Not authenticated", 401);
    if (!["owner", "admin", "pm", "accounting"].includes(membership.role)) {
      throw new ApiError("Insufficient permissions", 403);
    }

    const supabase = createServerClient();
    const { data: user } = await supabase.auth.getUser();
    const userId = user.user?.id ?? null;

    let body: { components?: unknown };
    try {
      body = (await req.json()) as { components?: unknown };
    } catch {
      throw new ApiError("Invalid JSON body", 400);
    }

    const rawComponents = Array.isArray(body.components) ? body.components : [];
    const validated = rawComponents
      .map(validate)
      .filter((c): c is IncomingComponent => c !== null);

    if (validated.length === 0) {
      throw new ApiError("At least one valid component is required", 400);
    }

    // Authorize: line belongs to caller's org.
    const { data: line } = await supabase
      .from("document_extraction_lines")
      .select("id, org_id, verification_status")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (!line) throw new ApiError("Line not found", 404);
    const row = line as { id: string; org_id: string; verification_status: string };
    if (row.org_id !== membership.org_id) throw new ApiError("Line not in your org", 403);

    // Soft-delete the current set
    const { error: delErr } = await supabase
      .from("line_cost_components")
      .update({ deleted_at: new Date().toISOString() })
      .eq("invoice_extraction_line_id", id)
      .is("deleted_at", null);
    if (delErr) throw new ApiError(`Reset failed: ${delErr.message}`, 500);

    // Insert the new set
    const inserts = validated.map((c, i) => ({
      org_id: membership.org_id,
      invoice_extraction_line_id: id,
      component_type: c.component_type,
      amount_cents: c.amount_cents,
      source: c.source,
      notes: c.notes,
      quantity: c.quantity,
      unit: c.unit,
      unit_rate_cents: c.unit_rate_cents,
      display_order: i,
      created_by: userId,
    }));

    const { error: insErr } = await supabase
      .from("line_cost_components")
      .insert(inserts);
    if (insErr) throw new ApiError(`Insert failed: ${insErr.message}`, 500);

    return NextResponse.json({
      line_id: id,
      component_count: validated.length,
    });
  }
);
