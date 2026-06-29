function getSupabaseStorageRemotePatterns() {
  const urls = [
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_URL,
    process.env.SUPABASE_PROJECT_REF ? `https://${process.env.SUPABASE_PROJECT_REF}.supabase.co` : undefined,
    ...(process.env.NEXT_PUBLIC_SUPABASE_STORAGE_URLS ?? "").split(","),
  ];

  const patterns = new Map();

  for (const value of urls) {
    const trimmed = value?.trim();
    if (!trimmed) continue;

    try {
      const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);

      patterns.set(`${url.protocol}//${url.host}`, {
        protocol: url.protocol.replace(":", ""),
        hostname: url.hostname,
        port: url.port,
        pathname: "/storage/v1/object/public/**",
      });
    } catch {
      console.warn(`Ignoring invalid Supabase Storage URL in marketing-web next.config.js: ${trimmed}`);
    }
  }

  return Array.from(patterns.values());
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  trailingSlash: true,
  transpilePackages: ["@altitutor/shared", "@altitutor/ui"],
  images: {
    remotePatterns: [
      ...getSupabaseStorageRemotePatterns(),
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
        source: "/:path*",
        has: [
          {
            type: "host",
            value: ".*\\.vercel\\.app",
          },
        ],
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow",
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
