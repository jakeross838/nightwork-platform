"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";

export default function Home() {
  const [status, setStatus] = useState<"loading" | "connected" | "error">("loading");
  const [queueCount, setQueueCount] = useState(0);

  useEffect(() => {
    async function check() {
      try {
        const { error } = await supabase.from("cost_codes").select("id").limit(1);
        setStatus(error ? "error" : "connected");
        const { count } = await supabase
          .from("invoices")
          .select("id", { count: "exact", head: true })
          .in("status", ["pm_review", "ai_processed"])
          .is("deleted_at", null);
        setQueueCount(count ?? 0);
      } catch {
        setStatus("error");
      }
    }
    check();
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute top-1/4 -left-1/4 w-[600px] h-[600px] bg-teal/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 -right-1/4 w-[500px] h-[500px] bg-brass/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative z-10 text-center px-6 max-w-xl">
        {/* Brand mark */}
        <div className="opacity-0 animate-fade-up">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-brand-border bg-brand-surface/50 mb-8">
            <span
              className={`h-2 w-2 rounded-full ${
                status === "loading"
                  ? "bg-brass animate-pulse"
                  : status === "connected"
                    ? "bg-status-success"
                    : "bg-status-danger"
              }`}
            />
            <span className="text-xs font-body text-cream-dim tracking-wide uppercase">
              {status === "loading" ? "Connecting..." : status === "connected" ? "Systems Online" : "Connection Failed"}
            </span>
          </div>
        </div>

        <h1 className="opacity-0 animate-fade-up stagger-1 font-display text-5xl md:text-6xl text-cream tracking-tight leading-[1.1]">
          Ross Command Center
        </h1>

        <p className="opacity-0 animate-fade-up stagger-2 mt-4 font-body text-cream-muted text-lg">
          Ross Built Custom Homes
        </p>

        <div className="opacity-0 animate-fade-up stagger-3 mt-2 flex items-center justify-center gap-3 text-cream-dim text-sm">
          <span>Bradenton</span>
          <span className="text-brass">&#x2022;</span>
          <span>Anna Maria Island</span>
        </div>

        {/* Navigation cards */}
        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-4 opacity-0 animate-fade-up stagger-4">
          <Link
            href="/invoices/upload"
            className="group relative flex flex-col items-start p-6 rounded-xl border border-brand-border bg-brand-surface/80 hover:bg-brand-elevated hover:border-teal/30 transition-all duration-300 text-left"
          >
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-teal-muted mb-4">
              <svg className="w-5 h-5 text-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
            </div>
            <h2 className="font-display text-xl text-cream">Upload Invoices</h2>
            <p className="mt-1 text-sm text-cream-dim">Drag and drop — AI parses instantly</p>
            <svg className="absolute top-6 right-6 w-4 h-4 text-cream-dim group-hover:text-teal group-hover:translate-x-0.5 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>

          <Link
            href="/invoices/queue"
            className="group relative flex flex-col items-start p-6 rounded-xl border border-brand-border bg-brand-surface/80 hover:bg-brand-elevated hover:border-brass/30 transition-all duration-300 text-left"
          >
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-brass-muted mb-4 relative">
              <svg className="w-5 h-5 text-brass" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
              </svg>
              {queueCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-brass text-brand-bg text-[11px] font-bold">
                  {queueCount}
                </span>
              )}
            </div>
            <h2 className="font-display text-xl text-cream">Invoice Queue</h2>
            <p className="mt-1 text-sm text-cream-dim">
              {queueCount > 0 ? `${queueCount} pending review` : "No invoices waiting"}
            </p>
            <svg className="absolute top-6 right-6 w-4 h-4 text-cream-dim group-hover:text-brass group-hover:translate-x-0.5 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-6 text-center opacity-0 animate-fade-up stagger-6">
        <p className="text-xs text-cream-dim/50 tracking-wider uppercase font-body">
          Est. 2006 &middot; Luxury Coastal Custom Homes
        </p>
      </div>
    </div>
  );
}
