import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { hostname: "images.pexels.com" }],
  },
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
