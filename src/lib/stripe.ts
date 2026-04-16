import Stripe from "stripe";

/**
 * Server-only Stripe client. Never import this from a "use client" module.
 *
 * We pin the API version so behavioural changes in Stripe's API don't silently
 * break billing. Bump deliberately and re-test when upgrading.
 */
let cached: Stripe | null = null;

export function getStripe(): Stripe {
  if (cached) return cached;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set. Add it to .env.local (see .env.example)."
    );
  }
  cached = new Stripe(key, {
    apiVersion: "2026-03-25.dahlia",
    typescript: true,
    appInfo: {
      name: "Nightwork",
      version: "0.1.0",
    },
  });
  return cached;
}
