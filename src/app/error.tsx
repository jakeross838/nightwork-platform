"use client";

import { useEffect } from "react";
import Link from "next/link";

// Route-segment error boundary. Catches render / data-fetch errors in any
// page under /app (except /app/global-error.tsx which catches root-layout crashes).
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[route error]", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-md text-center border border-[var(--border-default)] bg-[var(--bg-card)] p-8">
        <p className="text-[11px] tracking-[0.08em] uppercase text-[color:var(--nw-danger)]">
          Something went wrong
        </p>
        <h1 className="font-display text-2xl text-[color:var(--text-primary)] mt-2">
          We hit an unexpected error
        </h1>
        <p className="text-sm text-[color:var(--text-secondary)] mt-3">
          Refresh the page, or return to the home screen. If this keeps happening,
          report it with a screenshot so we can fix it.
        </p>
        {process.env.NODE_ENV !== "production" && error?.message && (
          <pre className="mt-4 text-left text-[11px] text-[color:var(--nw-danger)] bg-[rgba(176,85,78,0.08)] border border-[rgba(176,85,78,0.25)] p-3 overflow-auto max-h-40">
            {error.message}
            {error.digest ? `\n\ndigest: ${error.digest}` : ""}
          </pre>
        )}
        <div className="flex items-center justify-center gap-3 mt-6">
          <button
            type="button"
            onClick={() => reset()}
            className="px-4 py-2 bg-[var(--nw-stone-blue)] hover:bg-[var(--nw-gulf-blue)] text-white text-sm font-medium transition-colors"
          >
            Try again
          </button>
          <Link
            href="/"
            className="px-4 py-2 border border-[var(--border-default)] text-[color:var(--text-primary)] hover:border-[var(--nw-stone-blue)] text-sm font-medium transition-colors"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
