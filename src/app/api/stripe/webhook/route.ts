import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { priceIdToPlanSlug, type PaidPlanSlug } from "@/lib/stripe-config";

export const dynamic = "force-dynamic";
// Webhooks need the raw body for signature verification. Node runtime is
// required (Edge runtime's Request body handling differs).
export const runtime = "nodejs";

/**
 * The CHECK constraint on organizations.subscription_status predates the
 * American spelling Stripe uses (`canceled`) — keep using `cancelled` in our
 * column so we don't have to rewrite the constraint + every existing row.
 */
function mapStripeStatusToOrg(
  status: Stripe.Subscription.Status
): "trialing" | "active" | "past_due" | "cancelled" {
  switch (status) {
    case "active":
    case "trialing":
      return status;
    case "past_due":
    case "unpaid":
    case "incomplete":
    case "incomplete_expired":
    case "paused":
      return "past_due";
    case "canceled":
      return "cancelled";
  }
}

async function resolveOrgId(
  subscription: Stripe.Subscription,
  stripe: Stripe
): Promise<string | null> {
  // Prefer the metadata we set in the checkout session.
  const metaOrg = subscription.metadata?.org_id;
  if (metaOrg) return metaOrg;

  // Fall back to customer metadata, then (last resort) look up the
  // organization by stripe_customer_id. Subscriptions created outside of
  // our checkout flow won't have metadata, but the customer should.
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;
  try {
    const customer = await stripe.customers.retrieve(customerId);
    if (!customer.deleted) {
      const customerMeta = customer.metadata?.org_id;
      if (customerMeta) return customerMeta;
    }
  } catch {
    /* fall through to DB lookup */
  }

  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("organizations")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  return data?.id ?? null;
}

function priceIdFromSubscription(sub: Stripe.Subscription): string | null {
  return sub.items.data[0]?.price?.id ?? null;
}

function secondsToIso(sec: number | null | undefined): string | null {
  if (!sec) return null;
  return new Date(sec * 1000).toISOString();
}

function periodStart(sub: Stripe.Subscription): number | null {
  const raw = sub as unknown as Record<string, unknown>;
  const top = typeof raw["current_period_start"] === "number" ? (raw["current_period_start"] as number) : null;
  if (top) return top;
  const itemStart = sub.items.data[0] as unknown as Record<string, unknown> | undefined;
  if (itemStart && typeof itemStart["current_period_start"] === "number") return itemStart["current_period_start"] as number;
  return null;
}

function periodEnd(sub: Stripe.Subscription): number | null {
  const raw = sub as unknown as Record<string, unknown>;
  const top = typeof raw["current_period_end"] === "number" ? (raw["current_period_end"] as number) : null;
  if (top) return top;
  const itemEnd = sub.items.data[0] as unknown as Record<string, unknown> | undefined;
  if (itemEnd && typeof itemEnd["current_period_end"] === "number") return itemEnd["current_period_end"] as number;
  return null;
}

async function upsertSubscriptionAndOrg(
  subscription: Stripe.Subscription,
  stripe: Stripe
): Promise<void> {
  const supabase = createServiceRoleClient();
  const orgId = await resolveOrgId(subscription, stripe);
  if (!orgId) {
    console.warn("[stripe webhook] no org_id for subscription", subscription.id);
    return;
  }

  const priceId = priceIdFromSubscription(subscription);
  const planSlug: PaidPlanSlug | null = priceIdToPlanSlug(priceId);

  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  // Write the subscriptions row. plan_slug has a CHECK constraint so we
  // skip the upsert entirely if we can't identify the plan.
  if (planSlug) {
    const { error: subErr } = await supabase
      .from("subscriptions")
      .upsert(
        {
          org_id: orgId,
          stripe_subscription_id: subscription.id,
          stripe_customer_id: customerId,
          plan_slug: planSlug,
          status: subscription.status,
          current_period_start: secondsToIso(periodStart(subscription)),
          current_period_end: secondsToIso(periodEnd(subscription)),
          cancel_at_period_end: subscription.cancel_at_period_end,
        },
        { onConflict: "stripe_subscription_id" }
      );
    if (subErr) {
      console.error("[stripe webhook] subscription upsert failed", subErr);
    }
  } else {
    console.warn(
      "[stripe webhook] unknown price id",
      priceId,
      "for subscription",
      subscription.id
    );
  }

  // Mirror the relevant fields onto organizations.
  const orgUpdate: Record<string, unknown> = {
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
    subscription_status: mapStripeStatusToOrg(subscription.status),
  };
  if (planSlug) orgUpdate["subscription_plan"] = planSlug;
  if (subscription.status !== "trialing") {
    // Once they're paying, trial_ends_at is no longer the gate; clear it so
    // the trial banner / enforcement middleware stops showing.
    orgUpdate["trial_ends_at"] = null;
  }

  const { error: orgErr } = await supabase
    .from("organizations")
    .update(orgUpdate)
    .eq("id", orgId);
  if (orgErr) {
    console.error("[stripe webhook] org update failed", orgErr);
  }
}

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
  stripe: Stripe
): Promise<void> {
  // Subscriptions made via Checkout always have a subscription id on the
  // completed session. Fetch it fresh so we get up-to-date status + prices.
  const subId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id;
  if (!subId) {
    console.warn("[stripe webhook] checkout.session.completed with no subscription", session.id);
    return;
  }
  const subscription = await stripe.subscriptions.retrieve(subId);

  // Carry the client_reference_id (org id) onto the subscription + customer
  // metadata so later lifecycle events can resolve the org even if the
  // subscription object Stripe sends us doesn't have it.
  const orgId = session.client_reference_id || subscription.metadata?.org_id;
  if (orgId && !subscription.metadata?.org_id) {
    await stripe.subscriptions.update(subscription.id, {
      metadata: { ...subscription.metadata, org_id: orgId },
    });
    subscription.metadata = { ...subscription.metadata, org_id: orgId };
  }
  if (orgId && typeof subscription.customer === "string") {
    try {
      await stripe.customers.update(subscription.customer, {
        metadata: { org_id: orgId },
      });
    } catch {
      /* best-effort */
    }
  }

  await upsertSubscriptionAndOrg(subscription, stripe);
}

async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription
): Promise<void> {
  const supabase = createServiceRoleClient();
  const orgId = subscription.metadata?.org_id;
  if (!orgId) {
    // Fall back to customer_id lookup.
    const customerId =
      typeof subscription.customer === "string"
        ? subscription.customer
        : subscription.customer.id;
    const { data } = await supabase
      .from("organizations")
      .select("id")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();
    if (!data?.id) return;
    await applyCanceled(data.id, subscription.id);
    return;
  }
  await applyCanceled(orgId, subscription.id);
}

async function applyCanceled(orgId: string, stripeSubId: string): Promise<void> {
  const supabase = createServiceRoleClient();
  await supabase
    .from("subscriptions")
    .update({ status: "canceled", cancel_at_period_end: false })
    .eq("stripe_subscription_id", stripeSubId);
  await supabase
    .from("organizations")
    .update({
      subscription_status: "cancelled",
      subscription_plan: "free_trial",
      // Give them a short grace period so they don't immediately lose access
      // mid-session; the billing UI will show "trial expired" after this.
      trial_ends_at: new Date().toISOString(),
    })
    .eq("id", orgId);
}

async function handleInvoicePaymentFailed(
  invoice: Stripe.Invoice
): Promise<void> {
  // Stripe's generated Invoice type doesn't surface `subscription` directly
  // even though it's always present on subscription invoices at runtime.
  const subId = (invoice as unknown as { subscription?: string | null }).subscription;
  if (!subId) return;
  const supabase = createServiceRoleClient();
  await supabase
    .from("subscriptions")
    .update({ status: "past_due" })
    .eq("stripe_subscription_id", subId);

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("org_id")
    .eq("stripe_subscription_id", subId)
    .maybeSingle();
  if (sub?.org_id) {
    await supabase
      .from("organizations")
      .update({ subscription_status: "past_due" })
      .eq("id", sub.org_id);
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const sig = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret || webhookSecret === "whsec_placeholder") {
    // Don't 500 — a missing secret is a deploy-config problem, not a
    // payload problem. Accept and ignore so Stripe doesn't retry forever
    // during early local setup. We log so it's visible in dev.
    console.warn("[stripe webhook] STRIPE_WEBHOOK_SECRET is not configured — ignoring event.");
    return NextResponse.json({ ignored: true });
  }
  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  const body = await req.text();
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "bad signature";
    console.error("[stripe webhook] signature verification failed:", message);
    return NextResponse.json({ error: `Webhook Error: ${message}` }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session, stripe);
        break;
      case "customer.subscription.updated":
      case "customer.subscription.created":
        await upsertSubscriptionAndOrg(event.data.object as Stripe.Subscription, stripe);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      default:
        // Ignore events we don't care about — Stripe sends a lot.
        break;
    }
  } catch (err) {
    // Don't 500 on downstream errors or Stripe will retry the webhook
    // indefinitely, re-running whatever partially succeeded. Log and return
    // 200 so we can investigate, then replay from the dashboard if needed.
    console.error(`[stripe webhook] error handling ${event.type}:`, err);
  }

  return NextResponse.json({ received: true });
}
