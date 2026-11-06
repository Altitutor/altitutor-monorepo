const fs = require("fs");
const path = require("path");
const { withSentryConfig } = require("@sentry/nextjs/config");
const { getLocalDevOrigins } = require("../../scripts/next-dev-origins.cjs");
const pdfjsPackage = require.resolve("pdfjs-dist/package.json");
const pdfjsVersion = require(pdfjsPackage).version;

/**
 * Next's webpack cannot load pdfjs-dist 5 ESM (`Object.defineProperty` on a
 * non-object). Serve the minified builds as static files and import them with
 * a native `import()` instead of bundling them.
 */
function copyPdfjsAssets() {
  const pkgDir = path.dirname(pdfjsPackage);
  const destDir = path.join(__dirname, "public", "pdfjs");
  const versionDir = path.join(destDir, pdfjsVersion);
  fs.mkdirSync(versionDir, { recursive: true });
  // Use the publisher's polyfilled bundle for Safari; API and worker must match.
  for (const file of ["pdf.min.mjs", "pdf.worker.min.mjs"]) {
    const source = path.join(pkgDir, "legacy", "build", file);
    fs.copyFileSync(source, path.join(versionDir, file));
    // Keep the existing URLs available to tabs opened before versioned URLs shipped.
    fs.copyFileSync(source, path.join(destDir, file));
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
  allowedDevOrigins: getLocalDevOrigins(),
  // Expose Flight headers so the session boundary can handle legacy router state.
  skipProxyUrlNormalize: true,
  env: {
    NEXT_PUBLIC_PDFJS_ASSET_PATH: `/pdfjs/${pdfjsVersion}`,
    NEXT_PUBLIC_SENTRY_DEPLOYMENT_ENVIRONMENT:
      process.env.VERCEL_TARGET_ENV || process.env.VERCEL_ENV || "local",
  },
  typescript: { ignoreBuildErrors: process.env.ALTITUTOR_CI_BUILD === "true" },
  serverExternalPackages: ["@open-spaced-repetition/binding"],
  reactStrictMode: true,
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
