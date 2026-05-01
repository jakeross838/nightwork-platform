// Design-system playground — components/data-display/error.tsx (Stage 1.5a, T20g).
//
// Error boundary for the Data Display category page. Per SPEC B10. See
// sibling inputs/error.tsx for the pattern + Sentry follow-up note.

"use client";

import { useEffect } from "react";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";

import NwButton from "@/components/nw/Button";
import NwEyebrow from "@/components/nw/Eyebrow";
import NwCard from "@/components/nw/Card";

export default function ComponentsDataDisplayError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[design-system/components/data-display] preview render failed", error);
  }, [error]);

  return (
    <div className="max-w-[640px] mx-auto py-12">
      <NwCard variant="default" padding="lg" className="text-center">
        <span
          aria-hidden="true"
          className="inline-flex items-center justify-center w-12 h-12 mx-auto mb-3"
          style={{
            color: "var(--nw-danger)",
            background: "rgba(176,85,78,0.06)",
          }}
        >
          <ExclamationTriangleIcon className="w-7 h-7" strokeWidth={1.5} />
        </span>
        <NwEyebrow tone="danger" className="mb-2">
          Preview failed · Data display
        </NwEyebrow>
        <h1
          className="text-[20px] mb-2"
          style={{
            fontFamily: "var(--font-space-grotesk)",
            fontWeight: 500,
            letterSpacing: "-0.01em",
            color: "var(--text-primary)",
          }}
        >
          This component preview failed to render
        </h1>
        <p
          className="text-[13px] mb-5 leading-relaxed"
          style={{ color: "var(--text-secondary)" }}
        >
          One of the Data Display primitives threw during render — most
          likely the TanStack DataGrid or its column definitions. Check the
          browser console for details. This boundary catches preview errors
          so the rest of the playground stays browseable.
        </p>
        {process.env.NODE_ENV !== "production" && error?.message && (
          <pre
            className="text-left text-[11px] p-3 mb-5 overflow-auto max-h-40 border"
            style={{
              fontFamily: "var(--font-jetbrains-mono)",
              color: "var(--nw-danger)",
              background: "rgba(176,85,78,0.04)",
              borderColor: "rgba(176,85,78,0.25)",
            }}
          >
            {error.message}
            {error.digest ? `\n\ndigest: ${error.digest}` : ""}
          </pre>
        )}
        <NwButton variant="primary" onClick={() => reset()}>
          Try again
        </NwButton>
      </NwCard>
    </div>
  );
}
