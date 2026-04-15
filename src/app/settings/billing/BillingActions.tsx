"use client";

import { useState } from "react";
import Link from "next/link";

type Props =
  | {
      // Primary action row rendered on the billing page.
      hasCustomer: boolean;
      hasActiveSub: boolean;
      onTrial: boolean;
      inline?: false;
      inlineLabel?: undefined;
      inlineClassName?: undefined;
    }
  | {
      // Inline mode — render as a single underlined link for use inside banners.
      inline: true;
      inlineLabel: React.ReactNode;
      inlineClassName?: string;
      hasCustomer?: boolean;
      hasActiveSub?: boolean;
      onTrial?: boolean;
    };

/**
 * Buttons that POST to our Stripe endpoints and redirect to the returned URL.
 *
 * - "Change Plan" and "Cancel Subscription" both hit the Stripe Customer Portal
 *   (only difference is that "Cancel" lives under that UI too). Rather than
 *   deep-linking, we hand the user off and let them pick.
 * - "Upgrade" hits /api/stripe/checkout with a default paid plan when the org
 *   is on a free trial and has no customer yet. We route through /pricing so
 *   they can pick the plan — the pricing page will POST to /checkout with
 *   their chosen plan.
 */
export default function BillingActions(props: Props) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function openPortal() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not open portal");
      window.location.href = body.url as string;
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not open portal");
      setBusy(false);
    }
  }

  if (props.inline) {
    return (
      <button
        type="button"
        onClick={openPortal}
        disabled={busy}
        className={props.inlineClassName ?? "underline underline-offset-4 text-teal hover:text-teal-hover disabled:opacity-60"}
      >
        {busy ? "Opening…" : props.inlineLabel}
      </button>
    );
  }

  const { hasCustomer, hasActiveSub, onTrial } = props;

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {hasCustomer && hasActiveSub ? (
        <>
          <button
            type="button"
            onClick={openPortal}
            disabled={busy}
            className="px-4 py-2.5 bg-teal text-white text-[13px] tracking-[0.08em] uppercase hover:bg-teal-hover disabled:opacity-60"
          >
            {busy ? "Opening…" : "Change Plan"}
          </button>
          <button
            type="button"
            onClick={openPortal}
            disabled={busy}
            className="px-4 py-2.5 border border-brand-border text-[13px] tracking-[0.08em] uppercase hover:bg-brand-surface disabled:opacity-60"
          >
            Cancel Subscription
          </button>
        </>
      ) : (
        <Link
          href="/pricing"
          className="px-4 py-2.5 bg-teal text-white text-[13px] tracking-[0.08em] uppercase hover:bg-teal-hover"
        >
          {onTrial ? "Upgrade Now" : "Pick a Plan"}
        </Link>
      )}
      {err && (
        <span className="text-xs text-status-danger">{err}</span>
      )}
    </div>
  );
}
