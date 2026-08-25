import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { hostname: "images.pexels.com" }],
  },
  // @react-pdf/renderer depends on pdfkit, which loads its standard font
  // files (and AFM metrics data) from disk at runtime rather than via a
  // static `require`. Next's output file tracing can't see those dynamic
  // reads, so on Vercel the serverless function for any route that calls
  // renderToBuffer() is missing pdfkit's font assets and crashes with
  // "Cannot find module '.../pdfkit/js/standard-fonts/Helvetica.cjs'".
  // Explicitly include them so they're bundled into the function.
  experimental: {
    outputFileTracingIncludes: {
      "/api/**/*": [
        "./node_modules/pdfkit/js/standard-fonts/**/*",
        "./node_modules/pdfkit/js/data/**/*",
      ],
    },
  },
};

export default withNextIntl(nextConfig);
