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
  distDir: process.env.NEXT_DIST_DIR || ".next",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
    ],
  },
  webpack: (config) => {
    // Prevent motion/framer-motion relative sourceMappingURL comments from
    // leaking into chunks (DevTools then fetches HTML 404s → SyntaxError).
    config.module.rules.push({
      test: /\.m?js$/,
      include:
        /node_modules[\\/](\.pnpm[\\/])?(motion|framer-motion)([@\\/]|$)/,
      enforce: "pre",
      use: [
        path.resolve(
          __dirname,
          "webpack/strip-relative-source-mapping-url-loader.js",
        ),
      ],
    });
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
