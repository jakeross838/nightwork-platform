"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";

type TrialInfo = {
  status: string;
  trial_ends_at: string | null;
};

/**
 * Thin orange/teal top banner rendered on any authenticated page. Shows
 * trial countdown when the org is in `trialing`, or a past_due warning
 * when payment failed. Renders nothing otherwise.
 */
export default function TrialBanner() {
  const [info, setInfo] = useState<TrialInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: member } = await supabase
        .from("org_members")
        .select("org_id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (!member?.org_id) return;
      const { data: org } = await supabase
        .from("organizations")
        .select("subscription_status, trial_ends_at")
        .eq("id", member.org_id)
        .maybeSingle();
      if (cancelled || !org) return;
      setInfo({
        status: org.subscription_status as string,
        trial_ends_at: (org.trial_ends_at as string | null) ?? null,
      });
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!info) return null;

  if (info.status === "trialing") {
    const daysLeft = daysUntil(info.trial_ends_at);
    if (daysLeft == null || daysLeft < 0) return null;
    return (
      <div className="bg-[rgba(91,134,153,0.12)] border-b border-[rgba(91,134,153,0.35)] px-6 py-2 text-sm text-[color:var(--text-primary)]">
        <div className="max-w-[1240px] mx-auto flex items-center justify-between gap-3 flex-wrap">
          <span>
            You&apos;re on a free trial — <strong>{daysLeft} day{daysLeft === 1 ? "" : "s"}</strong> remaining.
          </span>
          <Link
            href="/settings/billing"
            className="px-3 py-1 bg-[var(--nw-stone-blue)] text-white text-[11px] tracking-[0.08em] uppercase hover:bg-[var(--nw-gulf-blue)] transition-colors"
          >
            Upgrade
          </Link>
        </div>
      </div>
    );
  }

  if (info.status === "past_due") {
    return (
      <div className="bg-[rgba(201,138,59,0.12)] border-b border-[rgba(201,138,59,0.35)] px-6 py-2 text-sm text-[color:var(--nw-warn)]">
        <div className="max-w-[1240px] mx-auto flex items-center justify-between gap-3 flex-wrap">
          <span>Payment failed. Update your payment method to keep your account active.</span>
          <Link
            href="/settings/billing"
            className="px-3 py-1 border border-[rgba(201,138,59,0.5)] text-[11px] tracking-[0.08em] uppercase hover:bg-[var(--nw-warn)] hover:text-white transition-colors"
          >
            Fix Billing
          </Link>
        </div>
      </div>
    );
  }

  if (info.status === "cancelled") {
    return (
      <div className="bg-[rgba(176,85,78,0.12)] border-b border-[rgba(176,85,78,0.35)] px-6 py-2 text-sm text-[color:var(--nw-danger)]">
        <div className="max-w-[1240px] mx-auto flex items-center justify-between gap-3 flex-wrap">
          <span>Your subscription is cancelled. You have read-only access.</span>
          <Link
            href="/settings/billing"
            className="px-3 py-1 border border-[rgba(176,85,78,0.5)] text-[11px] tracking-[0.08em] uppercase hover:bg-[var(--nw-danger)] hover:text-white transition-colors"
          >
            Reactivate
          </Link>
        </div>
      </div>
    );
  }

  return null;
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const diffMs = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(diffMs)) return null;
  return Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
}
