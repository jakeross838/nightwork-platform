"use client";

import { loadStripe, type Stripe } from "@stripe/stripe-js";

/**
 * Browser Stripe.js promise. Cached so repeat callers share a single loader.
 * Only used for future Stripe Elements / Payment Element embeds — for the
 * current redirect-to-Checkout flow the server returns a session URL and we
 * just `window.location.href = url`, no Stripe.js required.
 */
let cached: Promise<Stripe | null> | null = null;

export function getStripeClient(): Promise<Stripe | null> {
  if (cached) return cached;
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (!key) {
    throw new Error(
      "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set. Add it to .env.local (see .env.example)."
    );
  }
  cached = loadStripe(key);
  return cached;
}
