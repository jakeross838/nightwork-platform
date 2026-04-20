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

      <style dangerouslySetInnerHTML={{ __html: `
        .nw-panel { background: var(--bg-card); border-color: var(--border-default); }
      ` }} />
      {/* Hero */}
      <section className="px-6 pt-20 pb-24" style={{ background: "var(--bg-page)" }}>
        <div className="max-w-[1100px] mx-auto text-center">
          <span
            className="inline-block px-3 py-1 border text-[10px] uppercase mb-6"
            style={{
              fontFamily: "var(--font-jetbrains-mono)",
              letterSpacing: "0.14em",
              borderColor: "var(--border-default)",
              color: "var(--text-tertiary)",
            }}
          >
            Built for Custom Home Builders
          </span>
          <h1
            className="m-0 text-5xl md:text-6xl tracking-tight leading-[1.05] max-w-4xl mx-auto"
            style={{
              fontFamily: "var(--font-space-grotesk)",
              fontWeight: 500,
              letterSpacing: "-0.02em",
              color: "var(--text-primary)",
            }}
          >
            You build homes. Nightwork runs your business.
          </h1>
          <p className="mt-6 text-lg md:text-xl max-w-2xl mx-auto" style={{ color: "var(--text-secondary)" }}>
            Nightwork makes building lightwork.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4 flex-wrap">
            <Link
              href="/signup"
              className="px-6 py-3 text-[11px] uppercase transition-colors"
              style={{
                fontFamily: "var(--font-jetbrains-mono)",
                letterSpacing: "0.12em",
                fontWeight: 500,
                background: "var(--nw-stone-blue)",
                color: "var(--nw-white-sand)",
                border: "1px solid var(--nw-stone-blue)",
              }}
            >
              Start Free Trial
            </Link>
            <Link
              href="/pricing"
              className="px-6 py-3 border text-[11px] uppercase transition-colors"
              style={{
                fontFamily: "var(--font-jetbrains-mono)",
                letterSpacing: "0.12em",
                fontWeight: 500,
                borderColor: "var(--border-strong)",
                color: "var(--text-primary)",
              }}
            >
              See Pricing
            </Link>
          </div>
          <p className="mt-4 text-xs" style={{ color: "var(--text-tertiary)" }}>
            No credit card required · 14-day free trial
          </p>
        </div>
      </section>

      {/* Features */}
      <section
        className="px-6 py-20 border-y"
        style={{ background: "var(--bg-card)", borderColor: "var(--border-default)" }}
      >
        <div className="max-w-[1100px] mx-auto">
          <div className="text-center mb-16">
            <span className="text-[10px] tracking-[0.12em] uppercase text-[color:var(--text-secondary)]">Capabilities</span>
            <h2 className="mt-2 font-display text-3xl md:text-4xl text-[color:var(--text-primary)] tracking-tight">
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
            <span className="text-[10px] tracking-[0.12em] uppercase text-[color:var(--text-secondary)]">Workflow</span>
            <h2 className="mt-2 font-display text-3xl md:text-4xl text-[color:var(--text-primary)] tracking-tight">
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
      <section
        className="px-6 py-20 border-t"
        style={{ background: "var(--bg-subtle)", borderColor: "var(--border-default)" }}
      >
        <div className="max-w-[1100px] mx-auto">
          <div className="text-center mb-12">
            <span className="text-[10px] tracking-[0.12em] uppercase text-[color:var(--text-secondary)]">Pricing</span>
            <h2 className="mt-2 font-display text-3xl md:text-4xl text-[color:var(--text-primary)] tracking-tight">
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
              className="text-[13px] tracking-[0.08em] uppercase text-[color:var(--text-primary)] hover:text-[color:var(--nw-stone-blue)] border-b border-cream/40 hover:border-[var(--nw-stone-blue)] pb-0.5"
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
    <div className="p-6 border nw-panel">
      <h3 className="font-display text-lg text-[color:var(--text-primary)]">{title}</h3>
      <p className="mt-3 text-sm text-[color:var(--text-muted)] leading-relaxed">{body}</p>
    </div>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <li className="relative pl-0">
      <div className="flex items-baseline gap-3 mb-2">
        <span className="font-display text-3xl text-[color:var(--nw-stone-blue)]">0{n}</span>
        <h3 className="font-display text-lg text-[color:var(--text-primary)]">{title}</h3>
      </div>
      <p className="text-sm text-[color:var(--text-muted)] leading-relaxed">{body}</p>
    </li>
  );
}

function PricePreview({ name, price, tagline, highlight }: { name: string; price: string; tagline: string; highlight?: boolean }) {
  return (
    <div className={`p-6 border bg-[var(--bg-card)] ${highlight ? "border-[var(--nw-stone-blue)] shadow-[0_8px_24px_-12px_rgba(63,88,98,0.25)]" : "border-[var(--border-default)]"}`}>
      {highlight && (
        <span className="inline-block px-2 py-0.5 bg-[var(--nw-stone-blue)] text-white text-[10px] tracking-[0.12em] uppercase mb-3">
          Most Popular
        </span>
      )}
      <h3 className="font-display text-xl text-[color:var(--text-primary)]">{name}</h3>
      <p className="mt-4 font-display text-4xl text-[color:var(--text-primary)]">
        {price}
        <span className="text-sm text-[color:var(--text-secondary)] font-body">/mo</span>
      </p>
      <p className="mt-3 text-sm text-[color:var(--text-muted)]">{tagline}</p>
    </div>
  );
}
