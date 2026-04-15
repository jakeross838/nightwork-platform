/** @type {import('next').NextConfig} */
const nextConfig = {
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
