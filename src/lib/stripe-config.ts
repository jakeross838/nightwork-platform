/**
 * Plan slug → Stripe Price ID mapping.
 *
 * Price IDs live in env vars so we can swap them between test and prod without
 * a code change. A price ID returns `null` if the corresponding env var isn't
 * set — callers must handle that (e.g. surface a "Plan not configured" error
 * rather than creating a checkout session against an undefined price).
 */

export type PaidPlanSlug = "starter" | "professional" | "enterprise";
export type PlanSlug = "free_trial" | PaidPlanSlug;

export const PLAN_DISPLAY_NAMES: Record<PlanSlug, string> = {
  free_trial: "Free Trial",
  starter: "Starter",
  professional: "Pro",
  enterprise: "Enterprise",
};

export const PLAN_MONTHLY_PRICE: Record<PlanSlug, string> = {
  free_trial: "$0",
  starter: "$249",
  professional: "$499",
  enterprise: "$799",
};

export function getPriceId(slug: PaidPlanSlug): string | null {
  switch (slug) {
    case "starter":
      return process.env.STRIPE_PRICE_STARTER || null;
    case "professional":
      return process.env.STRIPE_PRICE_PROFESSIONAL || null;
    case "enterprise":
      return process.env.STRIPE_PRICE_ENTERPRISE || null;
  }
}

/**
 * Reverse lookup: given a Stripe Price ID (from a webhook payload), figure
 * out which plan slug it represents. Returns null for unknown prices so the
 * webhook can log and ignore them rather than crashing.
 */
export function priceIdToPlanSlug(priceId: string | null | undefined): PaidPlanSlug | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_STARTER) return "starter";
  if (priceId === process.env.STRIPE_PRICE_PROFESSIONAL) return "professional";
  if (priceId === process.env.STRIPE_PRICE_ENTERPRISE) return "enterprise";
  return null;
}

export function isPaidPlan(slug: string): slug is PaidPlanSlug {
  return slug === "starter" || slug === "professional" || slug === "enterprise";
}

/**
 * Whether billing is fully wired up for real checkout. All three bits must be
 * present to take a payment: the secret key (server-side Stripe client), the
 * publishable key (future client-side use), and at least one configured Price
 * ID. When this is false the UI should show "coming soon" rather than pushing
 * the user into a broken checkout flow.
 */
export function isStripeConfigured(): boolean {
  const secret = (process.env.STRIPE_SECRET_KEY ?? "").trim();
  const pub = (process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "").trim();
  const hasAnyPrice =
    !!(process.env.STRIPE_PRICE_STARTER ?? "").trim() ||
    !!(process.env.STRIPE_PRICE_PROFESSIONAL ?? "").trim() ||
    !!(process.env.STRIPE_PRICE_ENTERPRISE ?? "").trim();
  if (!secret || secret.startsWith("sk_placeholder")) return false;
  if (!pub || pub.startsWith("pk_placeholder")) return false;
  if (!hasAnyPrice) return false;
  return true;
}
