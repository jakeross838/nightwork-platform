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
  professional: "Professional",
  enterprise: "Enterprise",
};

export const PLAN_MONTHLY_PRICE: Record<PlanSlug, string> = {
  free_trial: "$0",
  starter: "$149",
  professional: "$349",
  enterprise: "$749",
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
