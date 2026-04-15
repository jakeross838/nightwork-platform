import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { ApiError, withApiError } from "@/lib/api/errors";
import { ADMIN_OR_OWNER, requireRole } from "@/lib/org/require";
import { getStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

function appUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${base.replace(/\/$/, "")}${path}`;
}

/**
 * POST /api/stripe/portal
 *
 * Creates a Stripe Customer Portal session so the org admin can change plan
 * / cancel / update payment method in Stripe's hosted UI. Returns `{ url }`.
 */
export const POST = withApiError(async () => {
  const membership = await requireRole(ADMIN_OR_OWNER);

  const supabase = createServerClient();
  const { data: org, error } = await supabase
    .from("organizations")
    .select("stripe_customer_id")
    .eq("id", membership.org_id)
    .single();
  if (error || !org) {
    throw new ApiError("Could not load organization.", 500);
  }
  if (!org.stripe_customer_id) {
    throw new ApiError(
      "This organization does not have a Stripe customer yet. Subscribe to a paid plan first.",
      400
    );
  }

  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: org.stripe_customer_id,
    return_url: appUrl("/settings/billing"),
  });
  return NextResponse.json({ url: session.url });
});
