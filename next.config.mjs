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

export default nextConfig;
