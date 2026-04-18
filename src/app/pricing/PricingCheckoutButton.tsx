"use client";

import { useState } from "react";

type PaidPlan = "starter" | "professional" | "enterprise";

/**
 * Small client wrapper that calls /api/stripe/checkout and navigates to the
 * returned Stripe Checkout URL. Used on the pricing page when the visitor is
 * already signed in — at that point they have an org, so they should be able
 * to upgrade without another detour through /signup.
 */
export default function PricingCheckoutButton({
  plan,
  label,
  className,
}: {
  plan: PaidPlan;
  label: string;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Checkout failed");
      if (!body.url) throw new Error("No checkout URL returned");
      window.location.href = body.url as string;
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Checkout failed");
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" onClick={go} disabled={busy} className={`${className ?? ""} w-full disabled:opacity-60`}>
        {busy ? "Redirecting…" : label}
      </button>
      {err && (
        <p className="mt-2 text-xs text-status-danger border border-status-danger/40 bg-status-danger/5 px-2 py-1">
          {err}
        </p>
      )}
    </>
  );
}
