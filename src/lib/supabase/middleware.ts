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

async function resolveBillingGate(
  supabase: ReturnType<typeof createServerClient>,
  userId: string
): Promise<BillingGate> {
  const { data: member } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  if (!member?.org_id) return "ok";

  const { data: org } = await supabase
    .from("organizations")
    .select("subscription_status, trial_ends_at, updated_at")
    .eq("id", member.org_id)
    .maybeSingle();
  if (!org) return "ok";

  const status = org.subscription_status as string;
  const trialEnds = org.trial_ends_at ? new Date(org.trial_ends_at as string) : null;
  const now = new Date();

  if (status === "cancelled") return "expired";
  if (status === "trialing" && trialEnds && trialEnds.getTime() < now.getTime()) {
    return "expired";
  }

  if (status === "past_due") {
    // Read-only after 7 days past_due. Use `updated_at` as a proxy for "how
    // long has this org been stuck in past_due" — the Stripe webhook updates
    // updated_at whenever it applies a status change, so updated_at is the
    // timestamp of the most recent status transition.
    const updatedAt = org.updated_at ? new Date(org.updated_at as string) : null;
    if (updatedAt) {
      const ageMs = now.getTime() - updatedAt.getTime();
      if (ageMs > 7 * 24 * 60 * 60 * 1000) return "read_only";
    }
  }
  return "ok";
}

/**
 * Refresh the Supabase session cookie on every request and expose
 * the resolved user + billing gate to the caller (middleware.ts).
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

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
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Must be awaited — refreshes the session token if needed.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const gate: BillingGate = user ? await resolveBillingGate(supabase, user.id) : "ok";
  // Expose billing state to server components via a request header so they
  // don't have to re-query on every render.
  response.headers.set("x-billing-gate", gate);

  return { response, user, gate };
}
