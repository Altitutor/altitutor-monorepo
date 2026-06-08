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
  async headers() {
    return [
      {
        source: "/wp-content/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=3600, s-maxage=31536000, stale-while-revalidate=86400",
          },
        ],
      },
    ];
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
        source: "/weekly-classes/",
        destination: "/classes/weekly-classes/",
        permanent: true,
      },
      {
        source: "/english-assignment-drafting/",
        destination: "/classes/english-assignment-drafting/",
        permanent: true,
      },
      {
        source: "/subsidy/",
        destination: "/about/subsidy/",
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
      },
      {
        source: "/testimonials/",
        destination: "/about/testimonials/",
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;
