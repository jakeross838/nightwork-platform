import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentOrg, getCurrentMembership } from "@/lib/org/session";
import { createServerClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
import { PLAN_DISPLAY_NAMES, PLAN_MONTHLY_PRICE, isStripeConfigured, type PlanSlug } from "@/lib/stripe-config";
import BillingActions from "./BillingActions";
import Stripe from "stripe";

export const dynamic = "force-dynamic";

type Sub = {
  stripe_subscription_id: string;
  plan_slug: "starter" | "professional" | "enterprise";
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
};

type CardInfo = { brand: string; last4: string };

async function fetchCardOnFile(customerId: string): Promise<CardInfo | null> {
  try {
    const stripe = getStripe();
    const customer = await stripe.customers.retrieve(customerId, {
      expand: ["invoice_settings.default_payment_method"],
    });
    if (customer.deleted) return null;
    const dpm = customer.invoice_settings?.default_payment_method;
    if (dpm && typeof dpm !== "string" && dpm.card) {
      return { brand: dpm.card.brand, last4: dpm.card.last4 };
    }
    // Fall back to the most recently attached card payment method.
    const methods = await stripe.paymentMethods.list({ customer: customerId, type: "card", limit: 1 });
    const pm = methods.data[0];
    if (pm?.card) return { brand: pm.card.brand, last4: pm.card.last4 };
  } catch (err) {
    console.error("[billing] fetch card on file failed", err);
  }
  return null;
}

async function verifyCheckoutSession(sessionId: string): Promise<void> {
  // Called when Stripe redirects back with ?session_id=…. We verify the
  // session is ours and mark the org as active even if the webhook hasn't
  // fired yet — gives the user instant feedback instead of a stale UI.
  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription"],
    });
    const subscription = session.subscription as Stripe.Subscription | null;
    if (!subscription || session.payment_status === "unpaid") return;

    const supabase = createServerClient();
    const customerId =
      typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;

    const orgUpdate: Record<string, unknown> = {};
    if (customerId) orgUpdate["stripe_customer_id"] = customerId;
    orgUpdate["stripe_subscription_id"] = subscription.id;
    // Webhook will apply the canonical status — this is just optimistic UI.
    orgUpdate["subscription_status"] = subscription.status === "trialing" ? "trialing" : "active";

    if (session.client_reference_id) {
      await supabase.from("organizations").update(orgUpdate).eq("id", session.client_reference_id);
    }
  } catch (err) {
    console.error("[billing] verify session failed", err);
  }
}

export default async function BillingSettingsPage({
  searchParams,
}: {
  searchParams: { session_id?: string; trial_expired?: string };
}) {
  if (searchParams.session_id) {
    await verifyCheckoutSession(searchParams.session_id);
  }

  const membership = await getCurrentMembership();
  if (!membership) redirect("/login");
  if (membership.role !== "admin" && membership.role !== "owner") {
    redirect("/settings/company");
  }

  const org = await getCurrentOrg();
  if (!org) redirect("/login");

  const supabase = createServerClient();
  const { data: subs } = await supabase
    .from("subscriptions")
    .select("stripe_subscription_id, plan_slug, status, current_period_end, cancel_at_period_end")
    .eq("org_id", org.id)
    .in("status", ["trialing", "active", "past_due"])
    .order("created_at", { ascending: false });
  const currentSub: Sub | null = (subs?.[0] as Sub | undefined) ?? null;

  const card = org.stripe_customer_id ? await fetchCardOnFile(org.stripe_customer_id) : null;

  const planSlug: PlanSlug = (currentSub?.plan_slug as PlanSlug) ?? org.subscription_plan;
  const planName = PLAN_DISPLAY_NAMES[planSlug];
  const isPastDue = org.subscription_status === "past_due";
  const trialDaysLeft = daysUntil(org.trial_ends_at);
  const onTrial =
    org.subscription_status === "trialing" || (planSlug === "free_trial" && trialDaysLeft !== null);
  const isCancelled = org.subscription_status === "cancelled";

  return (
    <div className="space-y-6">
      {searchParams.session_id && (
        <Banner kind="success">
          Subscription activated. Welcome to {planName}!
        </Banner>
      )}
      {searchParams.trial_expired && !searchParams.session_id && (
        <Banner kind="danger">
          Your free trial has ended. Pick a plan below to keep working.
        </Banner>
      )}
      {isPastDue && (
        <Banner kind="warning">
          <span>
            Your payment failed. Update your payment method to keep your account active.
          </span>
          <PortalLink className="ml-2 underline underline-offset-4">Update Payment Method</PortalLink>
        </Banner>
      )}
      {isCancelled && (
        <Banner kind="danger">
          Your subscription is cancelled. You have read-only access.
        </Banner>
      )}

      <section className="bg-white border border-brand-border p-6">
        <div className="flex items-baseline justify-between flex-wrap gap-3">
          <div>
            <p className="text-[11px] tracking-[0.08em] uppercase text-cream-dim">Current Plan</p>
            <h2 className="mt-1 font-display text-3xl text-cream">{planName}</h2>
            <p className="mt-1 text-sm text-cream-muted">
              {PLAN_MONTHLY_PRICE[planSlug]}
              {planSlug !== "free_trial" && <span className="text-cream-dim">/mo</span>}
            </p>
          </div>
          <StatusBadge status={org.subscription_status} />
        </div>

        <dl className="mt-6 grid sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <Row label="Status" value={formatStatus(org.subscription_status)} />
          {onTrial && (
            <Row
              label="Trial ends"
              value={
                trialDaysLeft !== null
                  ? `${formatDate(org.trial_ends_at)} (${trialDaysLeft} day${trialDaysLeft === 1 ? "" : "s"} left)`
                  : "—"
              }
            />
          )}
          {currentSub && !onTrial && (
            <Row
              label={currentSub.cancel_at_period_end ? "Ends" : "Next billing date"}
              value={formatDate(currentSub.current_period_end)}
            />
          )}
          <Row
            label="Card on file"
            value={card ? `${capitalize(card.brand)} •••• ${card.last4}` : "None"}
          />
          <Row label="Stripe customer" value={org.stripe_customer_id ?? "—"} />
        </dl>

        <div className="mt-6 pt-6 border-t border-brand-border">
          <BillingActions
            hasCustomer={Boolean(org.stripe_customer_id)}
            hasActiveSub={Boolean(currentSub)}
            onTrial={Boolean(onTrial)}
            billingConfigured={isStripeConfigured()}
          />
        </div>
      </section>

      {onTrial && !currentSub && (
        <section className="bg-teal-muted border border-teal p-6">
          <h3 className="font-display text-lg text-cream">Upgrade when you&apos;re ready</h3>
          <p className="mt-2 text-sm text-cream-muted">
            {trialDaysLeft !== null
              ? `You have ${trialDaysLeft} day${trialDaysLeft === 1 ? "" : "s"} left on your trial.`
              : "Your trial is active."}{" "}
            Pick a paid plan to lock in your team, jobs, and data.
          </p>
          <Link
            href="/pricing"
            className="mt-4 inline-block px-5 py-2.5 bg-teal text-white text-[13px] tracking-[0.08em] uppercase hover:bg-teal-hover transition-colors"
          >
            Compare Plans
          </Link>
        </section>
      )}
    </div>
  );
}

function PortalLink({ children, className }: { children: React.ReactNode; className?: string }) {
  // Tiny wrapper: a POST-button rendered as a link. Stripe Portal session must
  // be created server-side (needs the secret key) so we can't just use Link.
  return <BillingActions inline inlineLabel={children} inlineClassName={className} />;
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const diffMs = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(diffMs)) return null;
  return Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatStatus(status: string): string {
  switch (status) {
    case "trialing":
      return "Free Trial";
    case "active":
      return "Active";
    case "past_due":
      return "Past Due";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-[11px] tracking-[0.08em] uppercase text-cream-dim">{label}</dt>
      <dd className="text-cream break-all">{value}</dd>
    </>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles = {
    trialing: "bg-teal-muted text-teal border-teal",
    active: "bg-status-success-muted text-status-success border-status-success",
    past_due: "bg-status-warning-muted text-status-warning border-status-warning",
    cancelled: "bg-status-danger-muted text-status-danger border-status-danger",
  } as const;
  const cls = (styles as Record<string, string>)[status] ?? "bg-brand-surface text-cream-muted border-brand-border";
  return (
    <span className={`px-2.5 py-1 border text-[11px] tracking-[0.08em] uppercase ${cls}`}>
      {formatStatus(status)}
    </span>
  );
}

function Banner({
  kind,
  children,
}: {
  kind: "success" | "warning" | "danger";
  children: React.ReactNode;
}) {
  const cls = {
    success: "bg-status-success-muted border-status-success/40 text-status-success",
    warning: "bg-status-warning-muted border-status-warning/40 text-status-warning",
    danger: "bg-status-danger-muted border-status-danger/40 text-status-danger",
  }[kind];
  return <div className={`px-4 py-3 border ${cls} text-sm`}>{children}</div>;
}
