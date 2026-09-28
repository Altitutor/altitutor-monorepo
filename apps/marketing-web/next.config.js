const { withSentryConfig } = require("@sentry/nextjs");
const legacyRedirects = require("./src/lib/legacy-redirects.json");

const isSentrySourceMapUploadConfigured = Boolean(
  process.env.SENTRY_AUTH_TOKEN &&
    process.env.SENTRY_ORG &&
    process.env.SENTRY_PROJECT,
);

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: process.env.ALTITUTOR_CI_BUILD === "true" },
  typescript: { ignoreBuildErrors: process.env.ALTITUTOR_CI_BUILD === "true" },
  reactStrictMode: true,
  distDir: process.env.NEXT_DIST_DIR || ".next",
  trailingSlash: true,
  transpilePackages: ["@altitutor/shared", "@altitutor/ui"],
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "altitutor.com",
        pathname: "/images/content/**",
      },
      {
        protocol: "https",
        hostname: "student.altitutor.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        has: [
          {
            type: "host",
            value: ".*\\.vercel\\.app",
          },
        ],
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow",
          },
        ],
      },
      {
        source: "/images/:path*",
        headers: [
          {
            key: "Cache-Control",
            value:
              "public, max-age=3600, s-maxage=31536000, stale-while-revalidate=86400",
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      // Specific crop URLs must be listed before the uploads wildcard.
      ...(legacyRedirects.imageRedirects ?? []).map(
        ([source, destination]) => ({
          source,
          destination,
          permanent: true,
        }),
      ),
      {
        source: "/wp-content/uploads/:path*",
        destination: "/images/content/:path*",
        permanent: true,
      },
      ...["/cart/", "/checkout/"].map((source) => ({
        source,
        destination: legacyRedirects.trialBookingUrl,
        permanent: true,
      })),
      ...["/my-account/", "/activate/"].map((source) => ({
        source,
        destination: legacyRedirects.studentLoginUrl,
        permanent: true,
      })),
      {
        source: "/sitemap_index.xml",
        destination: "/sitemap.xml",
        permanent: true,
      },
      {
        source: "/wp-sitemap.xml",
        destination: "/sitemap.xml",
        permanent: true,
      },
      {
        source: "/page-sitemap.xml",
        destination: "/sitemap.xml",
        permanent: true,
      },
      {
        source: "/e-landing-page-sitemap.xml",
        destination: "/sitemap.xml",
        permanent: true,
      },
      {
        source: "/product-sitemap.xml",
        destination: "/sitemap.xml",
        permanent: true,
      },
      {
        source: "/product_cat-sitemap.xml",
        destination: "/sitemap.xml",
        permanent: true,
      },
      ...Object.entries(legacyRedirects.pageRedirects).map(
        ([source, destination]) => ({
          source,
          destination,
          permanent: true,
        }),
      ),
      ...legacyRedirects.trialBookingPaths.map((source) => ({
        source,
        destination: legacyRedirects.trialBookingUrl,
        permanent: true,
      })),
      {
        source: "/session/:slug*/",
        destination: legacyRedirects.trialBookingUrl,
        permanent: true,
      },
      {
        source: "/product-category/:slug*/",
        destination: "/classes/",
        permanent: true,
      },
      {
        source: "/new-tutor-registration/",
        destination: "/about/apply/",
        permanent: true,
      },
      {
        source: "/new-admin-registration/",
        destination: "/",
        permanent: true,
      },
    ];
  },
};

module.exports = withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  telemetry: false,
  sourcemaps: {
    disable: !isSentrySourceMapUploadConfigured,
    deleteSourcemapsAfterUpload: true,
  },
  webpack: {
    treeshake: {
      removeDebugLogging: true,
    },
  },
});
