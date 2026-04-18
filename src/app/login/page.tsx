import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/");

  return (
    <div className="min-h-screen grid grid-cols-1 min-[900px]:grid-cols-2">
      {/* ── Left: form panel ── */}
      <div className="bg-white-sand flex flex-col px-8 py-12 sm:px-14 lg:px-14 text-slate-tile">
        {/* Wordmark + beam */}
        <div className="flex items-center gap-3.5 mb-auto">
          <span className="font-display text-[22px] font-semibold tracking-[-0.03em] text-slate-tile select-none">
            nightwork
          </span>
          <span
            className="block h-[3px] w-[70px]"
            style={{
              background:
                "linear-gradient(90deg, #5B8699, transparent)",
            }}
          />
        </div>

        {/* Form wrapper — centered vertically */}
        <div className="max-w-[400px] w-full my-auto">
          {/* Eyebrow */}
          <p className="font-mono text-[10px] tracking-[0.16em] uppercase text-gulf-blue mb-3.5">
            Owner Portal &middot; Ross Built
          </p>

          {/* Headline */}
          <h1 className="font-display text-[40px] font-medium tracking-[-0.025em] text-slate-tile leading-[1.1] mb-2.5">
            Welcome back.
          </h1>

          {/* Subtitle */}
          <p
            className="font-sans text-[14.5px] leading-relaxed mb-8"
            style={{ color: "rgba(59,88,100,0.75)" }}
          >
            Sign in to review your project status, approve draws, and
            message your build team.
          </p>

          <LoginForm />

          {/* OR divider */}
          <div className="flex items-center gap-3.5 my-5">
            <span className="flex-1 h-px bg-[rgba(59,88,100,0.2)]" />
            <span
              className="font-mono text-[10px] tracking-[0.12em] uppercase"
              style={{ color: "rgba(59,88,100,0.45)" }}
            >
              OR
            </span>
            <span className="flex-1 h-px bg-[rgba(59,88,100,0.2)]" />
          </div>

          {/* Secondary CTA — ghost button */}
          <a
            href="/signup"
            className="block w-full py-3.5 text-center font-mono text-[11px] tracking-[0.12em] uppercase border border-[rgba(59,88,100,0.3)] text-slate-tile bg-transparent hover:border-stone-blue hover:text-stone-blue transition-all duration-150"
          >
            Create an Account
          </a>

          {/* Help section */}
          <div
            className="mt-7 pt-5 border-t border-[rgba(59,88,100,0.15)] text-[13px] leading-relaxed"
            style={{ color: "rgba(59,88,100,0.65)" }}
          >
            Trouble accessing your project?{" "}
            <a
              href="mailto:jake@rossbuilt.com"
              className="text-gulf-blue hover:underline"
            >
              Email Jake
            </a>{" "}
            or call{" "}
            <span className="text-slate-tile font-medium">
              (941) 555-0172
            </span>
            .
            <br />
            First time here? Your builder will send you an invite.
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex justify-between items-center mt-auto pt-10 font-mono text-[10px] tracking-[0.12em] uppercase"
          style={{ color: "rgba(59,88,100,0.5)" }}
        >
          <span>Nightwork &middot; Makes Building Lightwork</span>
          <span>SOC 2 &middot; Audit Logged</span>
        </div>
      </div>

      {/* ── Right: testimonial panel (hidden below 900px) ── */}
      <div
        className="hidden min-[900px]:flex flex-col relative overflow-hidden p-14 lg:p-14"
        style={{ background: "#1A2830" }}
      >
        {/* Radial overlays for depth */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 70% 20%, rgba(91,134,153,0.25), transparent 60%)",
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(circle at 80% 120%, rgba(201,138,59,0.08), transparent 65%)",
          }}
        />

        {/* Top bar — system status */}
        <div className="relative z-10 flex justify-between items-center font-mono text-[10px] tracking-[0.14em] text-[rgba(247,245,236,0.6)]">
          <span className="flex items-center">
            <span
              className="inline-block w-1.5 h-1.5 mr-1.5"
              style={{
                background: "#4A8A6F",
                borderRadius: "50%",
                boxShadow: "0 0 6px #4A8A6F",
              }}
            />
            SYSTEM OPERATIONAL
          </span>
          <span>POWERED BY NIGHTWORK</span>
        </div>

        {/* Quote — vertically centered */}
        <div className="relative z-10 my-auto max-w-[460px]">
          {/* Decorative quote mark */}
          <div
            className="font-display text-[96px] leading-[0.8] mb-3.5"
            style={{ color: "rgba(91,134,153,0.6)" }}
          >
            &ldquo;
          </div>

          <p className="font-display text-[26px] font-normal leading-[1.35] tracking-[-0.015em] text-white-sand mb-7">
            Before Nightwork, approving a draw meant three PDFs, two
            emails, and a phone call. Now I open my phone at the airport,
            see every invoice, and release $280k in two taps.
          </p>

          {/* Attribution */}
          <div className="flex items-center gap-3.5">
            <div
              className="w-11 h-11 flex items-center justify-center font-mono text-[12px] font-semibold text-slate-deep"
              style={{
                borderRadius: "50%",
                background:
                  "linear-gradient(135deg, #5B8699, #CBD8DB)",
              }}
            >
              MC
            </div>
            <div>
              <p className="text-[14px] font-medium text-white-sand">
                Marcus Crane
              </p>
              <p
                className="font-mono text-[10px] tracking-[0.12em] mt-0.5"
                style={{ color: "rgba(247,245,236,0.55)" }}
              >
                OWNER &middot; LONGBOAT KEY RESIDENCE &middot; $6.2M
                BUILD
              </p>
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="relative z-10 grid grid-cols-3 gap-6 pt-8 mt-12 border-t border-[rgba(247,245,236,0.12)]">
          <div>
            <p
              className="font-mono text-[9px] tracking-[0.14em] uppercase mb-1.5"
              style={{ color: "rgba(247,245,236,0.5)" }}
            >
              Active Builds
            </p>
            <p className="font-display text-[26px] font-medium tracking-[-0.02em] text-white-sand">
              34
            </p>
          </div>
          <div>
            <p
              className="font-mono text-[9px] tracking-[0.14em] uppercase mb-1.5"
              style={{ color: "rgba(247,245,236,0.5)" }}
            >
              Draws Approved
            </p>
            <p className="font-display text-[26px] font-medium tracking-[-0.02em] text-white-sand">
              $48M
            </p>
          </div>
          <div>
            <p
              className="font-mono text-[9px] tracking-[0.14em] uppercase mb-1.5"
              style={{ color: "rgba(247,245,236,0.5)" }}
            >
              Avg. Approval
            </p>
            <p className="font-display text-[26px] font-medium tracking-[-0.02em] text-white-sand">
              18min
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
