const path = require("path");

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
      include: /node_modules[\\/](\.pnpm[\\/])?(motion|framer-motion)([@\\/]|$)/,
      enforce: "pre",
      use: [path.resolve(__dirname, "webpack/strip-relative-source-mapping-url-loader.js")],
    });
    return config;
  },
};

module.exports = nextConfig;
