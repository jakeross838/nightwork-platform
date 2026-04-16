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
          <h1 className="font-display text-3xl text-cream tracking-tight">
            Reset Password
          </h1>
          <p className="mt-2 text-sm text-cream-dim">
            Enter your email and we&apos;ll send you a reset link.
          </p>
        </div>

        <div className="p-6 border border-brand-border bg-white">
          {submitted ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 mx-auto mb-4 flex items-center justify-center border-2 border-teal text-teal text-xl">
                ✓
              </div>
              <p className="text-sm text-cream mb-1">Check your email for a reset link.</p>
              <p className="text-xs text-cream-dim">
                If an account exists for that email, you&apos;ll receive instructions shortly.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="reset-email"
                  className="text-[11px] tracking-[0.08em] uppercase text-cream-dim"
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
                  className="px-3 py-2.5 border border-brand-border bg-white text-cream text-[14px] focus:outline-none focus:border-teal rounded-none"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-teal text-white font-display text-[13px] tracking-[0.1em] uppercase hover:bg-teal/90 disabled:opacity-60 transition-colors rounded-none"
              >
                {loading ? "Sending…" : "Send Reset Link"}
              </button>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-sm text-cream-muted">
          <Link href="/login" className="text-teal hover:underline underline-offset-4">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
