/**
 * Invoice permission + lock utilities — Phase 2.
 *
 * Single source of truth for:
 *   - which statuses lock an invoice's editable fields
 *   - which roles can override the lock
 *   - combined "can this user edit this invoice?" check
 *
 * No DB schema changes. The lock is derived from `invoices.status`.
 * Fields automatically re-unlock when status reverts (e.g. kickback
 * qa_review → pm_review).
 *
 * See qa-reports/… for the audit trail that produced this module's
 * behaviour.
 */

import type { OrgMemberRole } from "@/lib/org/session";

/**
 * Every value allowed by the `invoices.status` CHECK constraint as of
 * migration 00060. Kept in sync manually — when a new value is added
 * to the CHECK, add it here AND decide whether it belongs in
 * `LOCKED_STATUSES`.
 */
export type InvoiceStatus =
  | "received"
  | "ai_processed"
  | "pm_review"
  | "pm_approved"
  | "pm_held"
  | "pm_denied"
  | "qa_review"
  | "qa_approved"
  | "qa_kicked_back"
  | "pushed_to_qb"
  | "qb_failed"
  | "in_draw"
  | "paid"
  | "void"
  | "import_queued"
  | "import_parsing"
  | "import_parsed"
  | "import_error"
  | "import_duplicate"
  | "info_requested"
  | "info_received";

/**
 * Statuses at or past PM approval. Once an invoice reaches one of
 * these states, PM-level edits are locked — only privileged roles can
 * mutate PM-approved fields, and every such edit is audit-logged.
 */
export const LOCKED_STATUSES: ReadonlySet<InvoiceStatus> = new Set<InvoiceStatus>([
  "pm_approved",
  "qa_review",
  "qa_approved",
  "in_draw",
  "paid",
]);

/**
 * Roles with blanket authority to edit locked fields. "accounting"
 * owns QA + QuickBooks mapping. "admin" / "owner" are superusers.
 * "pm" intentionally absent — PMs approve once, then stop editing.
 */
export const PRIVILEGED_ROLES: ReadonlySet<OrgMemberRole> = new Set<OrgMemberRole>([
  "accounting",
  "admin",
  "owner",
]);

/** True when the invoice's status places PM-approved fields under lock. */
export function isInvoiceLocked(status: InvoiceStatus | string): boolean {
  return LOCKED_STATUSES.has(status as InvoiceStatus);
}

/** True when the role can edit a locked invoice's fields. */
export function canEditLockedFields(role: OrgMemberRole): boolean {
  return PRIVILEGED_ROLES.has(role);
}

/**
 * Convenience wrapper: combines the lock check and the role check.
 *
 * An invoice is editable when:
 *   - it is not locked, OR
 *   - the caller holds a privileged role.
 *
 * Privileged-role edits on a locked invoice should still be audit-
 * logged via `logFieldEdit` so the activity_log retains a per-field
 * record of the override.
 */
export function canEditInvoice(
  invoice: { status: InvoiceStatus | string },
  role: OrgMemberRole
): boolean {
  return !isInvoiceLocked(invoice.status) || canEditLockedFields(role);
}
