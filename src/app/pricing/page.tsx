import Link from "next/link";
import PublicHeader from "@/components/public-header";
import PublicFooter from "@/components/public-footer";
import NavBar from "@/components/nav-bar";
import { createServerClient } from "@/lib/supabase/server";
import PricingCheckoutButton from "./PricingCheckoutButton";

export const dynamic = "force-dynamic";

type Plan = {
  key: "free_trial" | "starter" | "professional" | "enterprise";
  name: string;
  price: string | null;
  blurb: string;
  users: string;
  aiCalls: string;
  storage: string;
  jobs: string;
  features: string[];
  cta: string;
  ctaHref: string;
  highlight?: boolean;
};

const PLANS: Plan[] = [
  {
    key: "free_trial",
    name: "Free Trial",
    price: "$0",
    blurb: "14 days, full access. No card required.",
    users: "Up to 3",
    aiCalls: "100 / month",
    storage: "2 GB",
    jobs: "3 active",
    features: [
      "Full AI invoice parsing",
      "G702 / G703 draw generation",
      "Real-time budget dashboards",
      "PM mobile approval",
    ],
    cta: "Start Free Trial",
    ctaHref: "/signup",
  },
  {
    key: "starter",
    name: "Starter",
    price: "$249",
    blurb: "For single-office builders running a handful of jobs.",
    users: "Up to 5",
    aiCalls: "500 / month",
    storage: "25 GB",
    jobs: "Up to 5 active",
    features: [
      "Everything in Free Trial",
      "Change order workflow",
      "CSV cost code imports",
      "Email support",
    ],
    cta: "Get Started",
    ctaHref: "/signup?plan=starter",
  },
  {
    key: "professional",
    name: "Pro",
    price: "$499",
    blurb: "For active custom home builders with multiple PMs.",
    users: "Up to 15",
    aiCalls: "2,500 / month",
    storage: "100 GB",
    jobs: "Up to 25 active",
    features: [
      "Everything in Starter",
      "Partial invoice approvals",
      "Vendor lien release tracking",
      "Priority support",
      "Onboarding session included",
    ],
    cta: "Get Started",
    ctaHref: "/signup?plan=professional",
    highlight: true,
  },
  {
    key: "enterprise",
    name: "Enterprise",
    price: "$799",
    blurb: "Multi-office, high-volume, or custom integrations.",
    users: "Unlimited",
    aiCalls: "Unlimited",
    storage: "500 GB",
    jobs: "Unlimited",
    features: [
      "Everything in Pro",
      "QuickBooks two-way sync",
      "Buildertrend integration",
      "Custom cost code consulting",
      "Dedicated account manager",
    ],
    cta: "Contact Us",
    ctaHref: "mailto:jake@nightwork.build?subject=Enterprise%20Plan%20Inquiry",
  },
];

const FAQ: Array<{ q: string; a: string }> = [
  {
    q: "Can I change plans?",
    a: "Yes. Upgrade anytime from Settings → Billing. Downgrades apply at the end of the current billing period.",
  },
  {
    q: "What happens after my trial?",
    a: "Your data is preserved. Pick a plan before day 14 to keep using the product without interruption — no automatic billing.",
  },
  {
    q: "Do I need a credit card to start?",
    a: "No. Free trials require only an email and a password. Add billing details when you're ready to upgrade.",
  },
  {
    q: "What counts as an AI call?",
    a: "Every time an invoice, proposal, or document is parsed by Claude. Re-parsing the same file counts again. Low-confidence retries are free.",
  },
];

export default async function PricingPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isAuthed = Boolean(user);

  return (
    <div className="min-h-screen flex flex-col">
      {isAuthed ? <NavBar /> : <PublicHeader />}

      <section className="px-6 pt-16 pb-8">
        <div className="max-w-[1200px] mx-auto text-center">
          <span className="text-[10px] tracking-[0.12em] uppercase text-cream-dim">Plans</span>
          <h1 className="mt-2 font-display text-4xl md:text-5xl text-cream tracking-tight">
            Pricing that scales with your jobs
          </h1>
          <p className="mt-4 text-cream-muted max-w-2xl mx-auto">
            Start free. Upgrade when your portfolio grows. Every plan includes unlimited draws and cost codes — you only pay for users and AI volume.
          </p>
        </div>
      </section>

      <section className="px-6 pb-20">
        <div className="max-w-[1240px] mx-auto grid md:grid-cols-2 xl:grid-cols-4 gap-4">
          {PLANS.map((p) => (
            <PlanCard key={p.key} plan={p} isAuthed={isAuthed} />
          ))}
        </div>
      </section>

      <section className="px-6 py-16 bg-brand-surface border-y border-brand-border">
        <div className="max-w-[820px] mx-auto">
          <h2 className="font-display text-2xl text-cream mb-6">Frequently asked</h2>
          <div className="divide-y divide-brand-border border-y border-brand-border">
            {FAQ.map((f) => (
              <div key={f.q} className="py-5">
                <p className="font-medium text-cream text-[15px]">{f.q}</p>
                <p className="mt-2 text-sm text-cream-muted leading-relaxed">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {!isAuthed && <PublicFooter />}
    </div>
  );
}

function PlanCard({ plan, isAuthed }: { plan: Plan; isAuthed: boolean }) {
  const isContact = plan.ctaHref.startsWith("mailto:");
  // For a logged-in admin/owner, paid plans should hit Stripe checkout
  // directly rather than punt back through /signup. Logged-out users go to
  // /signup like always — they have to have an org before they can subscribe.
  const goesToCheckout = isAuthed && !isContact && plan.key !== "free_trial";

  const buttonClass =
    plan.highlight
      ? "bg-teal text-white hover:bg-teal-hover"
      : "border border-brand-border text-cream hover:bg-brand-surface";

  return (
    <div
      className={`flex flex-col p-6 border bg-white ${
        plan.highlight ? "border-teal shadow-[0_12px_32px_-16px_rgba(63,88,98,0.35)]" : "border-brand-border"
      }`}
    >
      {plan.highlight && (
        <span className="self-start px-2 py-0.5 bg-teal text-white text-[10px] tracking-[0.12em] uppercase mb-3">
          Most Popular
        </span>
      )}
      <h2 className="font-display text-xl text-cream">{plan.name}</h2>
      <p className="mt-3 text-sm text-cream-muted h-10">{plan.blurb}</p>
      <div className="mt-5">
        <span className="font-display text-4xl text-cream">{plan.price}</span>
        {plan.key !== "enterprise" && plan.price !== "$0" && (
          <span className="text-cream-dim text-sm font-sans"> /mo</span>
        )}
      </div>
      <dl className="mt-6 space-y-2 text-sm">
        <SpecRow label="Users" value={plan.users} />
        <SpecRow label="AI calls" value={plan.aiCalls} />
        <SpecRow label="Storage" value={plan.storage} />
        <SpecRow label="Jobs" value={plan.jobs} />
      </dl>
      <ul className="mt-6 space-y-2 text-sm text-cream-muted flex-1">
        {plan.features.map((f) => (
          <li key={f} className="flex gap-2">
            <span className="text-teal mt-0.5">✓</span>
            <span>{f}</span>
          </li>
        ))}
      </ul>
      {isContact ? (
        <a
          href={plan.ctaHref}
          className="mt-8 block text-center px-4 py-3 border border-brand-border text-[13px] tracking-[0.08em] uppercase hover:bg-brand-surface"
        >
          {plan.cta}
        </a>
      ) : goesToCheckout ? (
        <PricingCheckoutButton
          plan={plan.key as "starter" | "professional" | "enterprise"}
          label={plan.cta}
          className={`mt-8 block text-center px-4 py-3 text-[13px] tracking-[0.08em] uppercase transition-colors ${buttonClass}`}
        />
      ) : (
        <Link
          href={plan.ctaHref}
          className={`mt-8 block text-center px-4 py-3 text-[13px] tracking-[0.08em] uppercase transition-colors ${buttonClass}`}
        >
          {plan.cta}
        </Link>
      )}
    </div>
  );
}

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-brand-border/70 pb-1.5">
      <dt className="text-[11px] tracking-[0.08em] uppercase text-cream-dim">{label}</dt>
      <dd className="text-cream text-sm">{value}</dd>
    </div>
  );
}
