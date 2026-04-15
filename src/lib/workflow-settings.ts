import { createServerClient } from "@/lib/supabase/server";
import { tryCreateServiceRoleClient } from "@/lib/supabase/service";

export type DuplicateSensitivity = "strict" | "moderate" | "loose";

export type WorkflowSettings = {
  id: string;
  org_id: string;

  // Invoice approvals
  batch_approval_enabled: boolean;
  quick_approve_enabled: boolean;
  quick_approve_min_confidence: number;
  require_invoice_date: boolean;
  require_budget_allocation: boolean;
  require_po_linkage: boolean;
  over_budget_requires_note: boolean;

  // Duplicate detection
  duplicate_detection_enabled: boolean;
  duplicate_detection_sensitivity: DuplicateSensitivity;

  // AI routing
  auto_route_high_confidence: boolean;
  auto_route_confidence_threshold: number;

  // Draw & payment
  require_lien_release_for_draw: boolean;
  co_approval_required: boolean;
  payment_auto_scheduling: boolean;

  created_at: string;
  updated_at: string;
};

export const DEFAULT_WORKFLOW_SETTINGS: Omit<
  WorkflowSettings,
  "id" | "org_id" | "created_at" | "updated_at"
> = {
  batch_approval_enabled: true,
  quick_approve_enabled: true,
  quick_approve_min_confidence: 95,
  require_invoice_date: true,
  require_budget_allocation: false,
  require_po_linkage: false,
  over_budget_requires_note: true,
  duplicate_detection_enabled: true,
  duplicate_detection_sensitivity: "moderate",
  auto_route_high_confidence: true,
  auto_route_confidence_threshold: 85,
  require_lien_release_for_draw: true,
  co_approval_required: true,
  payment_auto_scheduling: true,
};

const COLUMNS =
  "id, org_id, batch_approval_enabled, quick_approve_enabled, quick_approve_min_confidence, " +
  "require_invoice_date, require_budget_allocation, require_po_linkage, over_budget_requires_note, " +
  "duplicate_detection_enabled, duplicate_detection_sensitivity, " +
  "auto_route_high_confidence, auto_route_confidence_threshold, " +
  "require_lien_release_for_draw, co_approval_required, payment_auto_scheduling, " +
  "created_at, updated_at";

// In-process cache with 5-minute TTL so hot paths (invoice list, upload, approval)
// don't re-query the table for every request.
type CacheEntry = { at: number; value: WorkflowSettings };
const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, CacheEntry>();

function fallback(orgId: string): WorkflowSettings {
  const now = new Date().toISOString();
  return {
    id: "",
    org_id: orgId,
    ...DEFAULT_WORKFLOW_SETTINGS,
    created_at: now,
    updated_at: now,
  };
}

/**
 * Fetch workflow settings for an org, creating the row with defaults if missing.
 * Cached in-memory for 5 minutes per org_id.
 *
 * Every feature that gates on a setting MUST call this — never query
 * org_workflow_settings directly from component code.
 */
export async function getWorkflowSettings(
  orgId: string
): Promise<WorkflowSettings> {
  if (!orgId) return fallback(orgId);

  const cached = cache.get(orgId);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value;

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("org_workflow_settings")
    .select(COLUMNS)
    .eq("org_id", orgId)
    .maybeSingle();

  if (error || !data) {
    // Either RLS is blocking the caller (unusual — the "members read" policy
    // covers all authenticated org members) or the row just doesn't exist yet.
    // Try to self-heal with the service-role client; if that's unavailable we
    // fall through to defaults so features don't break.
    const service = tryCreateServiceRoleClient();
    if (service) {
      await service
        .from("org_workflow_settings")
        .upsert({ org_id: orgId }, { onConflict: "org_id" });
      const { data: retryData } = await service
        .from("org_workflow_settings")
        .select(COLUMNS)
        .eq("org_id", orgId)
        .maybeSingle();
      if (retryData) {
        const value = retryData as unknown as WorkflowSettings;
        cache.set(orgId, { at: Date.now(), value });
        return value;
      }
    }
    return fallback(orgId);
  }

  const value = data as unknown as WorkflowSettings;
  cache.set(orgId, { at: Date.now(), value });
  return value;
}

/**
 * Invalidate the in-memory cache for an org. Call this after updating
 * settings so subsequent reads pick up the change instantly.
 */
export function invalidateWorkflowSettings(orgId: string): void {
  cache.delete(orgId);
}

/**
 * Update workflow settings for an org. Owner/admin only (RLS enforced).
 * Invalidates the cache on success.
 */
export async function updateWorkflowSettings(
  orgId: string,
  patch: Partial<
    Omit<WorkflowSettings, "id" | "org_id" | "created_at" | "updated_at">
  >
): Promise<{ ok: boolean; error?: string }> {
  const supabase = createServerClient();
  const { error } = await supabase
    .from("org_workflow_settings")
    .update(patch)
    .eq("org_id", orgId);
  if (error) return { ok: false, error: error.message };
  invalidateWorkflowSettings(orgId);
  return { ok: true };
}

// ============================================================
// Sensitivity thresholds used by duplicate detection.
// ============================================================
export const DUPLICATE_SENSITIVITY_CONFIG: Record<
  DuplicateSensitivity,
  { amountPct: number; dateDays: number; label: string; description: string }
> = {
  strict: {
    amountPct: 2,
    dateDays: 14,
    label: "Strict",
    description: "Amount within 2%, date within 14 days",
  },
  moderate: {
    amountPct: 5,
    dateDays: 30,
    label: "Moderate",
    description: "Amount within 5%, date within 30 days",
  },
  loose: {
    amountPct: 10,
    dateDays: 60,
    label: "Loose",
    description: "Amount within 10%, date within 60 days",
  },
};
