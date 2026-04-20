import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      // Action-page-to-modal redirects (Tier 1).
      // Old standalone routes → parent page with ?action= that auto-opens the modal.
      { source: "/invoices/upload", destination: "/invoices?action=upload", permanent: true },
      { source: "/invoices/import", destination: "/invoices?action=import", permanent: true },
      { source: "/vendors/import", destination: "/vendors?action=import", permanent: true },
      { source: "/settings/cost-codes/import", destination: "/settings/cost-codes?action=import", permanent: true },
      { source: "/jobs/:id/purchase-orders/import", destination: "/jobs/:id/purchase-orders?action=import", permanent: true },
    ];
  },
  webpack: (config) => {
    // pdfjs-dist has an optional "canvas" import used only for Node-side
    // rendering. We run PDF.js in the browser only, so tell webpack to
    // treat the missing module as an empty module.
    config.resolve.alias = {
      ...config.resolve.alias,
      canvas: false,
    };
    return config;
  },
};

// Wrap with Sentry so @sentry/nextjs can tree-shake the client SDK and
// (later) upload source maps. Source-map upload requires SENTRY_AUTH_TOKEN
// + project config — we intentionally leave that un-set here so local
// builds never try to upload.
export default withSentryConfig(nextConfig, {
  silent: true,
  // Don't attempt source-map upload until the auth token + project slug
  // are set in deploy-time env. Until then, just link error stack
  // traces via the in-browser SDK.
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
  // Keep the automatic instrumentation on; it wraps server actions /
  // route handlers / etc. so no per-file boilerplate is needed.
  autoInstrumentServerFunctions: true,
  hideSourceMaps: true,
  disableLogger: true,
});
