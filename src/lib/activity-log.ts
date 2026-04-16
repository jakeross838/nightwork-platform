/**
 * Activity log — Phase 7b.
 *
 * The activity_log table was scaffolded in Phase 5 (migration 00026). This
 * module is the single write-path. Every status change, financial mutation,
 * or deletion attempt (successful or blocked) should call logActivity.
 *
 * Design rules:
 *   - logActivity NEVER throws. A failed audit write must not block a user
 *     action (we'd rather have a slightly incomplete log than a cascading
 *     failure). Errors are console.warn'd.
 *   - Uses the service-role client so the write succeeds even under
 *     RESTRICTIVE RLS policies.
 *   - `details` is JSONB; callers should include `from` / `to` for status
 *     changes, and a `reason` string where the user supplied a note.
 */

import { tryCreateServiceRoleClient } from "@/lib/supabase/service";

export type ActivityEntityType =
  | "invoice"
  | "invoice_import_batch"
  | "purchase_order"
  | "change_order"
  | "budget_line"
  | "budget"
  | "job"
  | "vendor"
  | "cost_code"
  | "draw"
  | "user";

export type ActivityAction =
  | "created"
  | "updated"
  | "status_changed"
  | "deleted"
  | "delete_blocked"
  | "voided"
  | "void_blocked"
  | "merged"
  | "imported"
  | "recomputed"
  | "approved"
  | "denied"
  // Bulk import batch actions
  | "bulk_assigned_job"
  | "sent_to_queue"
  | "deleted_errors";

interface LogActivityArgs {
  org_id: string;
  user_id?: string | null;
  entity_type: ActivityEntityType;
  entity_id?: string | null;
  action: ActivityAction;
  details?: Record<string, unknown> | null;
}

export async function logActivity(args: LogActivityArgs): Promise<void> {
  const supabase = tryCreateServiceRoleClient();
  if (!supabase) {
    console.warn(
      `[activity-log] SUPABASE_SERVICE_ROLE_KEY not configured — skipping log for ${args.entity_type}/${args.action}`
    );
    return;
  }
  try {
    const { error } = await supabase.from("activity_log").insert({
      org_id: args.org_id,
      user_id: args.user_id ?? null,
      entity_type: args.entity_type,
      entity_id: args.entity_id ?? null,
      action: args.action,
      details: args.details ?? null,
    });
    if (error) {
      console.warn(`[activity-log] insert failed: ${error.message}`);
    }
  } catch (err) {
    console.warn(
      `[activity-log] unexpected error: ${err instanceof Error ? err.message : err}`
    );
  }
}

/** Convenience: log a status change with from/to details. */
export async function logStatusChange(
  args: Omit<LogActivityArgs, "action" | "details"> & {
    from: string | null;
    to: string;
    reason?: string;
    extra?: Record<string, unknown>;
  }
): Promise<void> {
  const { from, to, reason, extra, ...rest } = args;
  await logActivity({
    ...rest,
    action: "status_changed",
    details: { from, to, ...(reason ? { reason } : {}), ...(extra ?? {}) },
  });
}
