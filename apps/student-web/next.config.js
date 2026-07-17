const path = require("path");
const { withSentryConfig } = require("@sentry/nextjs");

const isSentrySourceMapUploadConfigured = Boolean(
  process.env.SENTRY_AUTH_TOKEN &&
    process.env.SENTRY_ORG &&
    process.env.SENTRY_PROJECT,
);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  distDir: process.env.NEXT_DIST_DIR || ".next",
  transpilePackages: ["@altitutor/shared", "@altitutor/ui"],
  redirects: async () => {
    return [
      {
        source: "/new-student-registration",
        destination: "/booking/trial-session",
        permanent: true, // 308 redirect - permanent, better for SEO
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "img.youtube.com",
        pathname: "/vi/**",
      },
    ],
  },
  webpack: (config, { isServer }) => {
    // Replace @supabase/realtime-js with a stub module ONLY for server-side builds
    // The realtime package uses Node.js APIs (process.versions) that aren't available in Edge Runtime
    // During SSR/build, realtime subscriptions aren't needed, so we use a stub
    // BUT: We must NOT stub it in the browser bundle, as real-time subscriptions need the real client
    if (isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        "@supabase/realtime-js": path.resolve(
          __dirname,
          "src/shared/lib/supabase/realtime-stub.ts",
        ),
      };
    }
    return config;
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
