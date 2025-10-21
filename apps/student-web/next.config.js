/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  transpilePackages: ["@altitutor/shared", "@altitutor/ui"],
}

module.exports = nextConfig 