import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import SignupForm from "./SignupForm";

export const dynamic = "force-dynamic";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: { plan?: string };
}) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  const plan = searchParams.plan ?? null;

  return (
    <div className="min-h-screen flex bg-white-sand">
      {/* ── Left: form panel ── */}
      <div className="flex-1 flex flex-col justify-between px-8 py-10 sm:px-16 lg:px-24 min-h-screen">
        <div className="flex-1 flex flex-col justify-center max-w-[420px] w-full mx-auto">
          {/* Wordmark + beam */}
          <div className="flex items-center gap-3 mb-10">
            <Link href="/" className="inline-flex items-center gap-3" aria-label="Nightwork">
              <span
                className="font-display text-[22px] font-semibold tracking-[-0.03em] text-slate-deep select-none"
              >
                nightwork
              </span>
              <span
                className="block h-[3px] w-[70px]"
                style={{
                  background:
                    "linear-gradient(90deg, #5B8699, transparent)",
                }}
              />
            </Link>
          </div>

          {/* Eyebrow */}
          <p className="font-mono text-[10px] tracking-[0.16em] uppercase text-gulf-blue mb-3">
            Get Started &middot; Free Trial
          </p>

          {/* Headline */}
          <h1 className="font-display text-[40px] font-medium tracking-[-0.02em] text-slate-deep leading-[1.1] mb-2">
            Create your account.
          </h1>
          <p className="font-sans text-[14.5px] leading-relaxed mb-2" style={{ color: "rgba(59,88,100,0.75)" }}>
            14-day free trial. No credit card required.
          </p>

          {plan && (
            <p className="inline-block px-3 py-1 border border-[rgba(59,88,100,0.25)] font-mono text-[10px] tracking-[0.12em] uppercase text-gulf-blue mb-6">
              Selected plan: {plan}
            </p>
          )}
          {!plan && <div className="mb-6" />}

          <SignupForm plan={plan} />

          {/* OR divider */}
          <div className="flex items-center gap-4 my-6">
            <span className="flex-1 h-px bg-[rgba(59,88,100,0.15)]" />
            <span className="font-mono text-[10px] tracking-[0.12em] uppercase" style={{ color: "rgba(59,88,100,0.4)" }}>
              or
            </span>
            <span className="flex-1 h-px bg-[rgba(59,88,100,0.15)]" />
          </div>

          {/* Secondary CTA */}
          <Link
            href="/login"
            className="block w-full py-3 text-center font-mono text-[11px] tracking-[0.14em] uppercase border border-[rgba(59,88,100,0.3)] text-slate-deep bg-transparent hover:border-stone-blue hover:text-stone-blue transition-colors"
          >
            Sign In Instead
          </Link>
        </div>

        {/* Footer */}
        <p className="font-mono text-[10px] tracking-[0.12em] uppercase mt-8 max-w-[420px] mx-auto w-full" style={{ color: "rgba(59,88,100,0.4)" }}>
          &copy; {new Date().getFullYear()} Nightwork &middot; Built by
          builders
        </p>
      </div>

      {/* ── Right: testimonial panel (hidden below 900px) ── */}
      <div
        className="hidden min-[900px]:flex flex-col justify-between w-[48%] max-w-[640px] min-h-screen p-12 lg:p-16 relative overflow-hidden"
        style={{ background: "#1A2830" }}
      >
        {/* Radial overlays for depth */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at 30% 10%, rgba(91,134,153,0.15) 0%, transparent 55%)",
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at 70% 90%, rgba(78,122,140,0.10) 0%, transparent 50%)",
          }}
        />

        <div className="relative z-10 flex flex-col justify-center flex-1">
          {/* Quote */}
          <blockquote className="mb-10">
            <p className="font-display text-[26px] font-medium leading-[1.35] text-white-sand tracking-[-0.01em]">
              &ldquo;Setup took less than a day. We uploaded our cost codes,
              invited the PMs, and invoices started flowing through the same
              afternoon.&rdquo;
            </p>
          </blockquote>

          {/* Attribution */}
          <div className="flex items-center gap-4 mb-12">
            <div
              className="w-11 h-11 flex items-center justify-center font-mono text-[11px] tracking-[0.08em] text-white-sand"
              style={{
                background:
                  "linear-gradient(135deg, #5B8699 0%, #3B5864 100%)",
              }}
            >
              AR
            </div>
            <div>
              <p className="font-display text-[14px] font-medium text-white-sand">
                Andrew Ross
              </p>
              <p className="font-mono text-[10px] tracking-[0.12em] uppercase text-[rgba(203,216,219,0.6)]">
                Director of Pre-Construction
              </p>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-6 pt-8 border-t border-[rgba(203,216,219,0.15)]">
            <div>
              <p className="font-display text-[28px] font-medium text-white-sand tracking-tight">
                3x
              </p>
              <p className="font-mono text-[9px] tracking-[0.14em] uppercase text-[rgba(203,216,219,0.5)] mt-1">
                Faster Approvals
              </p>
            </div>
            <div>
              <p className="font-display text-[28px] font-medium text-white-sand tracking-tight">
                0
              </p>
              <p className="font-mono text-[9px] tracking-[0.14em] uppercase text-[rgba(203,216,219,0.5)] mt-1">
                Paper Invoices
              </p>
            </div>
            <div>
              <p className="font-display text-[28px] font-medium text-white-sand tracking-tight">
                1
              </p>
              <p className="font-mono text-[9px] tracking-[0.14em] uppercase text-[rgba(203,216,219,0.5)] mt-1">
                Data Entry Point
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
