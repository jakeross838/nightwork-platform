/**
 * Per-field audit helper — Phase 2.
 *
 * Thin wrapper around `logActivity` so callers that edit a single
 * invoice field get a consistent `activity_log` row shape. The
 * underlying table + write path is `src/lib/activity-log.ts`.
 *
 * Non-blocking: a failed audit write must never prevent the edit
 * from saving. `logActivity` already swallows its own errors; this
 * wrapper preserves that contract.
 */

import { logActivity } from "@/lib/activity-log";
import type { OrgMemberRole } from "@/lib/org/session";

export interface LogFieldEditArgs {
  invoiceId: string;
  orgId: string;
  userId: string;
  field: string;
  oldValue: unknown;
  newValue: unknown;
  byRole: OrgMemberRole;
}

/**
 * Record a single-field edit on an invoice. Typical caller: a
 * privileged-role user changing a PM-approved (locked) field.
 *
 * Shape written to activity_log.details:
 *   { field, old, new, by_role }
 */
export async function logFieldEdit(args: LogFieldEditArgs): Promise<void> {
  await logActivity({
    org_id: args.orgId,
    user_id: args.userId,
    entity_type: "invoice",
    entity_id: args.invoiceId,
    action: "updated",
    details: {
      field: args.field,
      old: args.oldValue,
      new: args.newValue,
      by_role: args.byRole,
    },
  });
}
