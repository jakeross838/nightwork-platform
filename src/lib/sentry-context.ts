import * as Sentry from "@sentry/nextjs";

/**
 * Attach tenant-context tags to the current Sentry scope. Call at the
 * top of every server component / API route that runs under an
 * authenticated session so errors are taggable per-org / per-user /
 * per-impersonation-state. No-op when DSN is not configured.
 *
 * We intentionally don't ship emails — they're PII. Use user_id /
 * org_id for correlation and join back to profiles in the Sentry UI
 * via links to /admin/platform/users/[id] etc.
 */
export function setSentryTenantContext(args: {
  user_id?: string | null;
  org_id?: string | null;
  impersonation_active?: boolean;
  platform_admin?: boolean;
}): void {
  const scope = Sentry.getCurrentScope?.();
  if (!scope) return;
  if (args.user_id) scope.setTag("user_id", args.user_id);
  if (args.org_id) scope.setTag("org_id", args.org_id);
  scope.setTag("impersonation_active", args.impersonation_active ? "1" : "0");
  scope.setTag("platform_admin", args.platform_admin ? "1" : "0");
}
