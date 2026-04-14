"use client";

import { useEffect } from "react";

// Root-level error boundary. Catches errors inside the root layout
// (where `error.tsx` cannot reach). Must render its own <html>/<body>.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[global error]", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
          fontFamily: "'Century Gothic', 'AppleGothic', sans-serif",
          color: "#3F5862",
          background: "#F7F5ED",
          margin: 0,
        }}
      >
        <div
          style={{
            maxWidth: "480px",
            textAlign: "center",
            border: "1px solid #E8E8E8",
            background: "#FFFFFF",
            padding: "2rem",
          }}
        >
          <p
            style={{
              fontSize: 11,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#c0392b",
              margin: 0,
            }}
          >
            Something went wrong
          </p>
          <h1 style={{ fontSize: 24, margin: "0.5rem 0 0" }}>
            The application hit a fatal error
          </h1>
          <p style={{ fontSize: 14, color: "#878787", marginTop: "0.75rem" }}>
            Please refresh the page. If this keeps happening, screenshot the error
            and contact support.
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 24 }}>
            <button
              type="button"
              onClick={() => reset()}
              style={{
                padding: "0.5rem 1rem",
                background: "#3F5862",
                color: "#FFFFFF",
                border: "none",
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            <a
              href="/"
              style={{
                padding: "0.5rem 1rem",
                border: "1px solid #E8E8E8",
                color: "#3F5862",
                fontSize: 14,
                textDecoration: "none",
              }}
            >
              Refresh home
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
