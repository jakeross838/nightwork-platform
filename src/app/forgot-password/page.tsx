"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
    } catch {
      // Don't reveal errors — always show the same message
    }
    setSubmitted(true);
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12 bg-white-sand">
      <div className="w-full max-w-[420px]">
        {/* Wordmark + beam */}
        <div className="flex items-center gap-3 mb-10">
          <Link href="/" className="inline-flex items-center gap-3" aria-label="Nightwork">
            <span className="font-display text-[22px] font-semibold tracking-[-0.03em] text-slate-deep select-none">
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
          Account Recovery
        </p>

        {/* Headline */}
        <h1 className="font-display text-[40px] font-medium tracking-[-0.02em] text-slate-deep leading-[1.1] mb-2">
          Reset password.
        </h1>
        <p className="font-sans text-[14.5px] leading-relaxed mb-8" style={{ color: "rgba(59,88,100,0.75)" }}>
          Enter your email and we&apos;ll send you a link to reset your
          password.
        </p>

        {submitted ? (
          <div className="border border-[rgba(59,88,100,0.15)] bg-white p-8 text-center">
            <div
              className="w-12 h-12 mx-auto mb-4 flex items-center justify-center border-2 border-nw-success text-nw-success"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="square"
                strokeLinejoin="miter"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <p className="font-sans text-[14.5px] text-slate-deep mb-1">
              Check your email for a reset link.
            </p>
            <p className="font-mono text-[10px] tracking-[0.08em]" style={{ color: "rgba(59,88,100,0.55)" }}>
              If an account exists for that email, you&apos;ll receive
              instructions shortly.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="reset-email"
                className="font-mono text-[10px] tracking-[0.12em] uppercase"
                style={{ color: "rgba(59,88,100,0.7)" }}
              >
                Email Address
              </label>
              <input
                id="reset-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="px-[13px] py-[13px] border bg-white font-sans text-[14.5px] text-slate-deep focus:outline-none transition-all"
                style={{
                  borderColor: "rgba(59,88,100,0.25)",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "#5B8699";
                  e.currentTarget.style.boxShadow =
                    "0 0 0 3px rgba(91,134,153,0.1)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "rgba(59,88,100,0.25)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-slate-deep text-white-sand font-mono text-[11px] tracking-[0.14em] uppercase hover:bg-slate-deeper disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Sending\u2026" : "Send Reset Link"}
            </button>
          </form>
        )}

        {/* Back to login */}
        <div className="mt-6">
          <div className="flex items-center gap-4 mb-6">
            <span className="flex-1 h-px bg-[rgba(59,88,100,0.15)]" />
            <span className="font-mono text-[10px] tracking-[0.12em] uppercase" style={{ color: "rgba(59,88,100,0.4)" }}>
              or
            </span>
            <span className="flex-1 h-px bg-[rgba(59,88,100,0.15)]" />
          </div>
          <Link
            href="/login"
            className="block w-full py-3 text-center font-mono text-[11px] tracking-[0.14em] uppercase border border-[rgba(59,88,100,0.3)] text-slate-deep bg-transparent hover:border-stone-blue hover:text-stone-blue transition-colors"
          >
            Back to Sign In
          </Link>
        </div>

        {/* Footer */}
        <p className="font-mono text-[10px] tracking-[0.12em] uppercase mt-12" style={{ color: "rgba(59,88,100,0.4)" }}>
          &copy; {new Date().getFullYear()} Nightwork &middot; Built by
          builders
        </p>
      </div>
    </div>
  );
}
