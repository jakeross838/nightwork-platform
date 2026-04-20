import { createServiceRoleClient } from "@/lib/supabase/service";

export type PlatformAuditAction =
  | "impersonate_start"
  | "impersonate_end"
  | "impersonate_write"
  | "impersonation_security_fail"
  | "org_extend_trial"
  | "org_mark_churned"
  | "org_unlock"
  | "user_password_reset"
  | "user_lock"
  | "user_unlock"
  | "user_remove_from_org"
  | "record_edit";

export type AuditWriteArgs = {
  admin_user_id: string;
  action: PlatformAuditAction | string;
  target_org_id?: string | null;
  target_user_id?: string | null;
  target_record_type?: string | null;
  target_record_id?: string | null;
  details?: Record<string, unknown> | null;
  reason: string;
};

/**
 * Write one row into platform_admin_audit. Uses the service-role client
 * because these writes must always succeed regardless of whose session
 * triggered them — a pre-commit audit write should not depend on the
 * caller's RLS context.
 *
 * Returns the inserted row's id on success, or null on failure (logged
 * via console.warn — we never want an audit failure to block the
 * underlying admin action).
 */
export async function writePlatformAudit(
  args: AuditWriteArgs
): Promise<string | null> {
  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("platform_admin_audit")
      .insert({
        admin_user_id: args.admin_user_id,
        action: args.action,
        target_org_id: args.target_org_id ?? null,
        target_user_id: args.target_user_id ?? null,
        target_record_type: args.target_record_type ?? null,
        target_record_id: args.target_record_id ?? null,
        details: args.details ?? null,
        reason: args.reason,
      })
      .select("id")
      .single();
    if (error) {
      console.warn(`[platform-audit] insert failed: ${error.message}`);
      return null;
    }
    return (data as { id: string }).id;
  } catch (err) {
    console.warn(
      `[platform-audit] unexpected error: ${err instanceof Error ? err.message : err}`
    );
    return null;
  }
}
