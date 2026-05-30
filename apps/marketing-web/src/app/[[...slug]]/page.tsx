import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import {
  createMetadata,
  getAllMarketingPages,
  getMarketingPage,
  getPageSchema,
  getPageStylePath,
  getRenderableHtml,
  pathFromSlug,
} from "@/lib/wordpress";

type PageProps = {
  params: {
    slug?: string[];
  };
};

export function generateStaticParams() {
  return getAllMarketingPages()
    .filter((page) => page.path !== "/")
    .map((page) => ({
      slug: page.path.replace(/^\/|\/$/g, "").split("/"),
    }));
}

export function generateMetadata({ params }: PageProps): Metadata {
  const page = getMarketingPage(pathFromSlug(params.slug));
  return createMetadata(page);
}

export default function MarketingRoute({ params }: PageProps) {
  const page = getMarketingPage(pathFromSlug(params.slug));

  if (!page) {
    notFound();
  }

  const schema = getPageSchema(page);
  const pageStylePath = getPageStylePath(page);

  return (
    <>
      <link rel="stylesheet" href={pageStylePath} />
      {schema ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ) : null}
      <header className="legacy-site-header">
        <div className="legacy-site-header__top">
          <a className="legacy-site-header__brand" href="/">
            <Image
              src="/wp-content/uploads/2021/01/Site-logo-large-1-300x55.png"
              alt="Altitutor"
              width={300}
              height={55}
              priority
            />
          </a>
          <a
            className="legacy-site-header__book"
            href="https://student.altitutor.com/booking/trial-session"
          >
            Book now
          </a>
        </div>
        <nav className="legacy-site-header__nav" aria-label="Primary navigation">
          <a href="/about/">About us</a>
          <a href="/classes/">Courses</a>
          <a href="/resources/">Online resources</a>
          <a href="/about/contact/">Contact us</a>
        </nav>
      </header>
      <main
        className="legacy-wordpress-page"
        dangerouslySetInnerHTML={{ __html: getRenderableHtml(page) }}
      />
    </>
  );
}
