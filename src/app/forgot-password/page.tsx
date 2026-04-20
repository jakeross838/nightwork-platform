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
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-md animate-fade-up">
        <div className="text-center mb-8">
          <h1
            className="m-0"
            style={{
              fontFamily: "var(--font-space-grotesk)",
              fontWeight: 500,
              fontSize: "28px",
              letterSpacing: "-0.02em",
              color: "var(--text-primary)",
            }}
          >
            Reset Password
          </h1>
          <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
            Enter your email and we&apos;ll send you a reset link.
          </p>
        </div>

        <div
          className="p-6 border"
          style={{
            background: "var(--bg-card)",
            borderColor: "var(--border-default)",
          }}
        >
          {submitted ? (
            <div className="text-center py-4">
              <div
                className="w-12 h-12 mx-auto mb-4 flex items-center justify-center border-2 text-xl"
                style={{
                  borderColor: "var(--nw-success)",
                  color: "var(--nw-success)",
                }}
              >
                ✓
              </div>
              <p className="text-sm mb-1" style={{ color: "var(--text-primary)" }}>Check your email for a reset link.</p>
              <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                If an account exists for that email, you&apos;ll receive instructions shortly.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="reset-email"
                  className="text-[10px] uppercase"
                  style={{
                    fontFamily: "var(--font-jetbrains-mono)",
                    letterSpacing: "0.14em",
                    color: "var(--text-tertiary)",
                  }}
                >
                  Email
                </label>
                <input
                  id="reset-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="px-3 py-2.5 border text-[14px] focus:outline-none rounded-none"
                  style={{
                    background: "var(--bg-subtle)",
                    borderColor: "var(--border-default)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 text-[11px] uppercase disabled:opacity-60 transition-colors rounded-none"
                style={{
                  fontFamily: "var(--font-jetbrains-mono)",
                  letterSpacing: "0.12em",
                  fontWeight: 500,
                  background: "var(--nw-stone-blue)",
                  color: "var(--nw-white-sand)",
                  border: "1px solid var(--nw-stone-blue)",
                }}
              >
                {loading ? "Sending…" : "Send Reset Link"}
              </button>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-sm" style={{ color: "var(--text-tertiary)" }}>
          <Link
            href="/login"
            className="hover:underline underline-offset-4"
            style={{ color: "var(--nw-gulf-blue)" }}
          >
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
