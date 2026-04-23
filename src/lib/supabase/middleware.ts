import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import * as Sentry from "@sentry/nextjs";

/**
 * Billing gate evaluation returned alongside the user.
 *
 * - `expired`: trial ran out and there's no active paid subscription, or the
 *   sub was cancelled → bounce the user to /settings/billing for any
 *   non-billing page.
 * - `read_only`: active sub but past_due for more than 7 days → they can
 *   still browse, but writes should be blocked by API routes. The middleware
 *   only enforces redirects; API routes enforce writes via `requireBillingOk`.
 * - `ok`: everything fine.
 */
export type BillingGate = "ok" | "expired" | "read_only";

/**
 * Read-only API routes that benefit from skipping the billing gate query
 * in middleware. These routes don't mutate data, so there's no write to
 * block when the sub is past due. Keep the list tight — don't add mutating
 * routes here.
 */
const HOT_API_PATHS = new Set(["/api/dashboard", "/api/jobs/health"]);

function isHotApiPath(pathname: string): boolean {
  return HOT_API_PATHS.has(pathname);
}

/**
 * Refresh the Supabase session cookie on every request and expose
 * the resolved user + billing gate to the caller (middleware.ts).
 *
 * Perf optimization (Phase 10): we ALSO resolve membership (org_id + role)
 * here and stash it on the forwarded request headers. Route handlers in
 * hot paths (dashboard, jobs/health) read these headers via
 * `getMembershipFromRequest` and skip their own auth.getUser() + org_members
 * query, saving ~250-300ms per request.
 */
export async function updateSession(request: NextRequest) {
  // Strip any incoming x-org-* / x-platform-admin* headers so a client
  // can't forge them. We'll set the trusted versions ourselves once auth
  // resolves.
  const scrubbed = new Headers(request.headers);
  scrubbed.delete("x-user-id");
  scrubbed.delete("x-org-id");
  scrubbed.delete("x-org-role");
  scrubbed.delete("x-platform-admin");
  scrubbed.delete("x-platform-admin-role");
  scrubbed.delete("x-impersonation-active");
  scrubbed.delete("x-impersonation-target-org");
  scrubbed.delete("x-impersonation-admin-user-id");

  // Track any cookies Supabase wants to set during token refresh. We apply
  // them to the final response at the very end.
  const cookiesToApply: Array<{ name: string; value: string; options?: Record<string, unknown> }> = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          for (const c of cookiesToSet) cookiesToApply.push(c);
        },
      },
    }
  );

  // Hot-path perf: for /api/ routes, skip the auth.getUser() round-trip to
  // GoTrue and rely on getSession() (JWT decode, ~1ms). The JWT is signed
  // and tamper-proof; the only thing getUser() adds is server-side
  // revocation checks, which Supabase's RLS will still enforce on the DB
  // queries the route actually makes. For pages/navigations we keep
  // getUser() since redirect decisions here need the stronger guarantee.
  const isHotApi = isHotApiPath(request.nextUrl.pathname);
  let user: { id: string } | null = null;
  if (isHotApi) {
    const { data: { session } } = await supabase.auth.getSession();
    user = session?.user ? { id: session.user.id } : null;
  } else {
    const { data: { user: u } } = await supabase.auth.getUser();
    user = u;
  }

  // Resolve membership (always) + billing gate (skip for hot-path API
  // routes — those routes don't gate on billing). One query either way.
  let gate: BillingGate = "ok";
  let membership: { org_id: string; role: string } | null = null;
  if (user) {
    if (isHotApi) {
      const { data: member } = await supabase
        .from("org_members")
        .select("org_id, role")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (member) {
        membership = { org_id: member.org_id as string, role: member.role as string };
      }
    } else {
      const { data: member } = await supabase
        .from("org_members")
        .select(
          "org_id, role, organizations:org_id (subscription_status, trial_ends_at, updated_at)"
        )
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (member) {
        membership = { org_id: member.org_id as string, role: member.role as string };
        const orgRaw = (member as unknown as { organizations: unknown }).organizations;
        const org = (Array.isArray(orgRaw) ? orgRaw[0] : orgRaw) as
          | { subscription_status?: string; trial_ends_at?: string | null; updated_at?: string | null }
          | null;
        if (org) {
          const status = org.subscription_status ?? "";
          const trialEnds = org.trial_ends_at ? new Date(org.trial_ends_at) : null;
          const now = new Date();
          if (status === "cancelled") gate = "expired";
          else if (status === "trialing" && trialEnds && trialEnds.getTime() < now.getTime()) {
            gate = "expired";
          } else if (status === "past_due") {
            const updatedAt = org.updated_at ? new Date(org.updated_at) : null;
            if (updatedAt) {
              const ageMs = now.getTime() - updatedAt.getTime();
              if (ageMs > 7 * 24 * 60 * 60 * 1000) gate = "read_only";
            }
          }
        }
      }
    }
  }

  // Platform admin lookup — cheap single-row read. We do this for
  // every authenticated request (skipping hot API paths) so impersonation
  // and /admin/platform route guards can check without extra queries.
  let platformAdmin: { role: string } | null = null;
  if (user && !isHotApi) {
    const { data: pa } = await supabase
      .from("platform_admins")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();
    if (pa) platformAdmin = { role: pa.role as string };
  }

  // Impersonation: if the cookie is present and the user is actually a
  // platform admin, override the org context headers so downstream
  // handlers see the target org as "current". Cookie value is JSON.
  let impersonationActive = false;
  let impersonationTargetOrg: string | null = null;
  if (user && platformAdmin) {
    const cookie = request.cookies.get("nw_impersonate")?.value;
    if (cookie) {
      try {
        const parsed = JSON.parse(cookie) as {
          admin_user_id?: string;
          target_org_id?: string;
          started_at?: string;
        };
        const startedAt = parsed.started_at ? new Date(parsed.started_at) : null;
        const ageMs = startedAt ? Date.now() - startedAt.getTime() : Infinity;
        const ONE_HOUR = 60 * 60 * 1000;
        if (
          parsed.admin_user_id === user.id &&
          parsed.target_org_id &&
          ageMs < ONE_HOUR
        ) {
          impersonationActive = true;
          impersonationTargetOrg = parsed.target_org_id;
        }
      } catch {
        // Malformed cookie — ignore. The end-impersonation endpoint
        // will clear it on the next hit.
      }
    }
  }

  // Set the trusted auth headers on the forwarded request. Building the
  // response LAST (after all mutations) ensures Next snapshots the full
  // header set at forward time.
  if (user) scrubbed.set("x-user-id", user.id);
  if (impersonationActive && impersonationTargetOrg) {
    // Override org context to target org so standard handlers see
    // membership as if the admin were a member of that org.
    scrubbed.set("x-org-id", impersonationTargetOrg);
    // Role defaults to "owner" so impersonation sees the most
    // permissive app-level UI. The DB still rejects write attempts
    // because app_private.user_org_id() returns the admin's real
    // profile org, not the impersonated one.
    scrubbed.set("x-org-role", "owner");
    scrubbed.set("x-impersonation-active", "1");
    scrubbed.set("x-impersonation-target-org", impersonationTargetOrg);
    // Admin user id is the real signed-in user (we never swap auth
    // identity — only the org context). Expose it explicitly so
    // write handlers don't have to re-look it up from the session.
    scrubbed.set("x-impersonation-admin-user-id", user!.id);
  } else if (membership) {
    scrubbed.set("x-org-id", membership.org_id);
    scrubbed.set("x-org-role", membership.role);
  }
  if (platformAdmin) {
    scrubbed.set("x-platform-admin", "1");
    scrubbed.set("x-platform-admin-role", platformAdmin.role);
  }

  // Tag the current Sentry scope so any captured error carries tenant
  // context. No-op when DSN isn't configured. Tags are scoped
  // per-request via Sentry's AsyncLocalStorage integration, so this is
  // safe to set from middleware.
  try {
    if (user) Sentry.setTag("user_id", user.id);
    if (membership) Sentry.setTag("org_id", membership.org_id);
    Sentry.setTag("impersonation_active", impersonationActive ? "1" : "0");
    Sentry.setTag("platform_admin", platformAdmin ? "1" : "0");
  } catch {
    // Sentry not initialized — fine.
  }

  const response = NextResponse.next({ request: { headers: scrubbed } });
  // Apply any cookies Supabase wanted to refresh
  for (const { name, value, options } of cookiesToApply) {
    response.cookies.set(name, value, options);
  }
  // Expose billing state to server components via a response header.
  response.headers.set("x-billing-gate", gate);
  if (impersonationActive) {
    response.headers.set("x-impersonation-active", "1");
  }

  return {
    response,
    user,
    gate,
    isPlatformAdmin: !!platformAdmin,
    impersonationActive,
    impersonationTargetOrg,
  };
}
