import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { ApiError, withApiError } from "@/lib/api/errors";
import { ADMIN_OR_OWNER, requireRole } from "@/lib/org/require";
import { getStripe } from "@/lib/stripe";
import { getPriceId, isPaidPlan } from "@/lib/stripe-config";

export const dynamic = "force-dynamic";

function appUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${base.replace(/\/$/, "")}${path}`;
}

/**
 * POST /api/stripe/checkout
 *
 * Body: { plan: "starter" | "professional" | "enterprise" }
 *
 * Creates a Stripe Checkout Session for the current org's admin/owner and
 * returns `{ url }`. The caller navigates to that URL — the session carries
 * the org id forward in `client_reference_id` so the webhook can link
 * back to the org without trusting any client data.
 */
export const POST = withApiError(async (req: NextRequest) => {
  const membership = await requireRole(ADMIN_OR_OWNER);

  const body = (await req.json().catch(() => ({}))) as { plan?: string };
  const plan = String(body.plan ?? "");
  if (!isPaidPlan(plan)) {
    throw new ApiError("Invalid plan. Must be starter | professional | enterprise.", 400);
  }

  const priceId = getPriceId(plan);
  if (!priceId) {
    throw new ApiError(
      `Price ID for plan "${plan}" is not configured. Set STRIPE_PRICE_${plan.toUpperCase()} in .env.local.`,
      500
    );
  }

  const supabase = createServerClient();
  const { data: org, error: orgErr } = await supabase
    .from("organizations")
    .select("id, name, company_email, stripe_customer_id")
    .eq("id", membership.org_id)
    .single();
  if (orgErr || !org) {
    throw new ApiError("Could not load organization.", 500);
  }

  const { data: { user } } = await supabase.auth.getUser();
  const checkoutEmail = org.company_email || user?.email || undefined;

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    client_reference_id: org.id,
    // Reuse existing customer if we have one so Stripe doesn't create duplicates.
    ...(org.stripe_customer_id
      ? { customer: org.stripe_customer_id }
      : { customer_email: checkoutEmail }),
    // metadata survives on the subscription + customer so later webhook events
    // (which don't always include client_reference_id) can still resolve the org.
    subscription_data: {
      metadata: { org_id: org.id, plan_slug: plan },
    },
    metadata: { org_id: org.id, plan_slug: plan },
    allow_promotion_codes: true,
    success_url: appUrl(`/settings/billing?session_id={CHECKOUT_SESSION_ID}`),
    cancel_url: appUrl(`/pricing`),
  });

  if (!session.url) {
    throw new ApiError("Stripe did not return a checkout URL.", 502);
  }
  return NextResponse.json({ url: session.url });
});
