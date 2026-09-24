const fs = require("fs");
const path = require("path");
const { withSentryConfig } = require("@sentry/nextjs");

const isSentrySourceMapUploadConfigured = Boolean(
  process.env.SENTRY_AUTH_TOKEN &&
    process.env.SENTRY_ORG &&
    process.env.SENTRY_PROJECT,
);

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

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  distDir: process.env.NEXT_DIST_DIR || ".next",
  transpilePackages: ["@altitutor/email", "@altitutor/shared", "@altitutor/ui"],
  webpack: (config) => {
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      canvas: false,
    };
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
