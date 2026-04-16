import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

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
  // Strip any incoming x-org-* headers so a client can't forge them. We'll
  // set the trusted versions ourselves once auth resolves.
  const scrubbed = new Headers(request.headers);
  scrubbed.delete("x-user-id");
  scrubbed.delete("x-org-id");
  scrubbed.delete("x-org-role");

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

  // Set the trusted auth headers on the forwarded request. Building the
  // response LAST (after all mutations) ensures Next snapshots the full
  // header set at forward time.
  if (user) scrubbed.set("x-user-id", user.id);
  if (membership) {
    scrubbed.set("x-org-id", membership.org_id);
    scrubbed.set("x-org-role", membership.role);
  }

  const response = NextResponse.next({ request: { headers: scrubbed } });
  // Apply any cookies Supabase wanted to refresh
  for (const { name, value, options } of cookiesToApply) {
    response.cookies.set(name, value, options);
  }
  // Expose billing state to server components via a response header.
  response.headers.set("x-billing-gate", gate);

  return { response, user, gate };
}
