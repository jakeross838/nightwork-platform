import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/org/session";
import PublicHeader from "@/components/public-header";
import PublicFooter from "@/components/public-footer";

export const dynamic = "force-dynamic";

export default async function Root() {
  // Signed-in users skip the marketing page.
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const org = await getCurrentOrg();
    if (org && !org.onboarding_complete) redirect("/onboard");
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader />

      {/* Hero */}
      <section className="px-6 pt-20 pb-24 bg-brand-bg">
        <div className="max-w-[1100px] mx-auto text-center">
          <span className="inline-block px-3 py-1 border border-brand-border text-[10px] tracking-[0.12em] uppercase text-cream-dim mb-6">
            Built for Custom Home Builders
          </span>
          <h1 className="font-display text-5xl md:text-6xl text-cream tracking-tight leading-[1.05] max-w-4xl mx-auto">
            You build homes. Nightwork runs your business.
          </h1>
          <p className="mt-6 text-lg md:text-xl text-cream-muted max-w-2xl mx-auto">
            Nightwork makes building lightwork.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4 flex-wrap">
            <Link
              href="/signup"
              className="px-6 py-3 bg-teal text-white text-[13px] tracking-[0.12em] uppercase font-medium hover:bg-teal-hover transition-colors"
            >
              Start Free Trial
            </Link>
            <Link
              href="/pricing"
              className="px-6 py-3 border border-brand-border text-cream text-[13px] tracking-[0.12em] uppercase font-medium hover:bg-brand-surface transition-colors"
            >
              See Pricing
            </Link>
          </div>
          <p className="mt-4 text-xs text-cream-dim">No credit card required · 14-day free trial</p>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-20 bg-white border-y border-brand-border">
        <div className="max-w-[1100px] mx-auto">
          <div className="text-center mb-16">
            <span className="text-[10px] tracking-[0.12em] uppercase text-cream-dim">Capabilities</span>
            <h2 className="mt-2 font-display text-3xl md:text-4xl text-cream tracking-tight">
              Built around how builders actually work
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <FeatureCard
              title="AI Invoice Parsing"
              body="Upload any format — PDF, Word, photo, handwritten. Claude extracts vendor, amount, line items, and cost codes with confidence scoring. Low-confidence invoices route to accounting; high-confidence ones go straight to the PM."
            />
            <FeatureCard
              title="Automated Draws"
              body="AIA G702 and G703 draws generated from approved invoices. Change orders logged with PCCO numbers, running contract totals, and GC fees applied per line. Lock draws to preserve audit history."
            />
            <FeatureCard
              title="Real-Time Budgets"
              body="Live budget health across every job. Original estimates, revised with change orders, previous applications, this period, balance to finish — all computed on read. Over-budget lines turn red before the draw goes out."
            />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 py-20">
        <div className="max-w-[1100px] mx-auto">
          <div className="text-center mb-16">
            <span className="text-[10px] tracking-[0.12em] uppercase text-cream-dim">Workflow</span>
            <h2 className="mt-2 font-display text-3xl md:text-4xl text-cream tracking-tight">
              Four steps from invoice to draw
            </h2>
          </div>
          <ol className="grid md:grid-cols-4 gap-6">
            <Step n={1} title="Upload" body="Drag any invoice — PDF, Word, photo. Or email it in." />
            <Step n={2} title="AI Parses" body="Claude extracts every field with a confidence score." />
            <Step n={3} title="PM Approves" body="One-tap on mobile. Edits log as overrides — the AI learns." />
            <Step n={4} title="Draw Generated" body="G702 and G703 assembled from approved invoices." />
          </ol>
        </div>
      </section>

      {/* Pricing preview */}
      <section className="px-6 py-20 bg-brand-surface border-t border-brand-border">
        <div className="max-w-[1100px] mx-auto">
          <div className="text-center mb-12">
            <span className="text-[10px] tracking-[0.12em] uppercase text-cream-dim">Pricing</span>
            <h2 className="mt-2 font-display text-3xl md:text-4xl text-cream tracking-tight">
              Priced for every stage
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-4 max-w-[900px] mx-auto">
            <PricePreview name="Starter" price="$249" tagline="For builders running 1–5 active jobs" />
            <PricePreview name="Pro" price="$499" tagline="For active contractors, 6–15 jobs" highlight />
            <PricePreview name="Enterprise" price="$799" tagline="For multi-office builders and up" />
          </div>
          <div className="mt-10 text-center">
            <Link
              href="/pricing"
              className="text-[13px] tracking-[0.08em] uppercase text-cream hover:text-teal border-b border-cream/40 hover:border-teal pb-0.5"
            >
              See all plans &amp; features →
            </Link>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}

function FeatureCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="p-6 border border-brand-border bg-white">
      <h3 className="font-display text-lg text-cream">{title}</h3>
      <p className="mt-3 text-sm text-cream-muted leading-relaxed">{body}</p>
    </div>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <li className="relative pl-0">
      <div className="flex items-baseline gap-3 mb-2">
        <span className="font-display text-3xl text-teal">0{n}</span>
        <h3 className="font-display text-lg text-cream">{title}</h3>
      </div>
      <p className="text-sm text-cream-muted leading-relaxed">{body}</p>
    </li>
  );
}

function PricePreview({ name, price, tagline, highlight }: { name: string; price: string; tagline: string; highlight?: boolean }) {
  return (
    <div className={`p-6 border bg-white ${highlight ? "border-teal shadow-[0_8px_24px_-12px_rgba(63,88,98,0.25)]" : "border-brand-border"}`}>
      {highlight && (
        <span className="inline-block px-2 py-0.5 bg-teal text-white text-[10px] tracking-[0.12em] uppercase mb-3">
          Most Popular
        </span>
      )}
      <h3 className="font-display text-xl text-cream">{name}</h3>
      <p className="mt-4 font-display text-4xl text-cream">
        {price}
        <span className="text-sm text-cream-dim font-sans">/mo</span>
      </p>
      <p className="mt-3 text-sm text-cream-muted">{tagline}</p>
    </div>
  );
}
