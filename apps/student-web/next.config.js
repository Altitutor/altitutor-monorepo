const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  transpilePackages: ["@altitutor/shared", "@altitutor/ui"],
  webpack: (config, { isServer }) => {
    // Replace @supabase/realtime-js with a stub module for Edge Runtime and SSR
    // The realtime package uses Node.js APIs (process.versions) that aren't available in Edge Runtime
    // During SSR/build, realtime subscriptions aren't needed, so we use a stub
    config.resolve.alias = {
      ...config.resolve.alias,
      '@supabase/realtime-js': path.resolve(__dirname, 'src/shared/lib/supabase/realtime-stub.ts'),
    };
    return config;
  },
}

module.exports = nextConfig 