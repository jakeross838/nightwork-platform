// Next.js instrumentation hook — runs once per runtime before any request
// handlers load. Sentry pattern per @sentry/nextjs docs: dynamically
// require the runtime-specific config so Node code doesn't ship to edge
// and vice versa.

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}
