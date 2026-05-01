// Design-system playground — components/inputs/error.tsx (Stage 1.5a, T20g).
//
// Error boundary for the Inputs category page. Per SPEC B10 — every
// category page in /design-system/components/<category> has its own
// error.tsx boundary that falls back to a "preview failed" message.
//
// The pattern follows src/app/error.tsx — useEffect for console logging,
// reset() for "Try again". Sentry is NOT wired in this codebase yet —
// when it lands, add scope tags here mirroring the error.tsx in src/app/.
//
// Token discipline: no hex; CSS vars + nw-* utilities only. Square
// corners. Heroicons outline.

"use client";

import { useEffect } from "react";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";

import NwButton from "@/components/nw/Button";
import NwEyebrow from "@/components/nw/Eyebrow";
import NwCard from "@/components/nw/Card";

export default function ComponentsInputsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[design-system/components/inputs] preview render failed", error);
    // TODO: when Sentry is wired, add:
    //   Sentry.withScope((s) => { s.setTag('design-system-page', 'inputs'); Sentry.captureException(error); });
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
          Preview failed · Inputs
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
          One of the Inputs primitives threw during render. Check the browser
          console for details. This boundary catches preview errors so the
          rest of the playground stays browseable.
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
