const fs = require("fs");
const path = require("path");
const { withSentryConfig } = require("@sentry/nextjs");

/**
 * Next's webpack cannot load pdfjs-dist 5 ESM (`Object.defineProperty` on a
 * non-object). Serve the minified builds as static files and import them with
 * a native `import()` instead of bundling them.
 */
function copyPdfjsAssets() {
  const pkgDir = path.dirname(require.resolve("pdfjs-dist/package.json", { paths: [__dirname] }));
  const destDir = path.join(__dirname, "public", "pdfjs");
  fs.mkdirSync(destDir, { recursive: true });
  for (const file of ["pdf.min.mjs", "pdf.worker.min.mjs"]) {
    fs.copyFileSync(path.join(pkgDir, "build", file), path.join(destDir, file));
  }
  for (const dir of ["wasm", "cmaps", "standard_fonts"]) {
    fs.cpSync(path.join(pkgDir, dir), path.join(destDir, dir), { recursive: true });
  }
}

copyPdfjsAssets();

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
  transpilePackages: ["@altitutor/email", "@altitutor/shared", "@altitutor/ui"],
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
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      canvas: false,
    };
    // Replace @supabase/realtime-js with a stub module ONLY for server-side builds
    // The realtime package uses Node.js APIs (process.versions) that aren't available in Edge Runtime
    // During SSR/build, realtime subscriptions aren't needed, so we use a stub
    // BUT: We must NOT stub it in the browser bundle, as real-time subscriptions need the real client
    if (isServer) {
      config.resolve.alias["@supabase/realtime-js"] = path.resolve(
        __dirname,
        "src/shared/lib/supabase/realtime-stub.ts",
      );
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
