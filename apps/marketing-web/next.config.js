/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  trailingSlash: true,
  transpilePackages: ["@altitutor/shared", "@altitutor/ui"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "altitutor.com",
        pathname: "/wp-content/uploads/**",
      },
      {
        protocol: "https",
        hostname: "student.altitutor.com",
        pathname: "/**",
      },
    ],
  },
  async redirects() {
    return [
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
      {
        source: "/shop/",
        destination: "https://student.altitutor.com/booking/trial-session",
        permanent: true,
      },
      {
        source: "/session/:slug*/",
        destination: "https://student.altitutor.com/booking/trial-session",
        permanent: true,
      },
      {
        source: "/product-category/:slug*/",
        destination: "/classes/",
        permanent: true,
      },
      {
        source: "/new-student-registration/",
        destination: "https://student.altitutor.com/booking/trial-session",
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
      {
        source: "/contact-us/",
        destination: "/about/contact/",
        permanent: true,
      }
    ];
  },
};

module.exports = nextConfig;
