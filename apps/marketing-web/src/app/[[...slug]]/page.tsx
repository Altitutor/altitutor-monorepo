import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { LegacyWordPressInteractions } from "../LegacyWordPressInteractions";
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

const LEGACY_SITE_FOOTER_HTML = `
  <div class="legacy-site-footer__content">
    <div class="legacy-site-footer__brand">
      <h2>Altitutor.</h2>
      <address>Level 1, 17A Solomon St<br />Adelaide SA 5000</address>
      <p>Copyright © 2021 Altitutor Pty Ltd</p>
      <p>ACN: 639 197 167</p>
      <nav class="legacy-site-footer__socials" aria-label="Social links">
        <a href="https://www.facebook.com/altitutoreducation/">Facebook</a>
        <a href="https://twitter.com/Altitutor">Twitter</a>
        <a href="https://www.youtube.com/channel/UCtHb57z0bE-caSB76YguEMA">YouTube</a>
        <a href="https://www.tiktok.com/@altitutor">TikTok</a>
        <a href="https://www.linkedin.com/company/altitutor/">LinkedIn</a>
        <a href="https://www.instagram.com/altitutor/">Instagram</a>
      </nav>
    </div>
    <nav class="legacy-site-footer__nav" aria-label="Education links">
      <h3>Education</h3>
      <a href="/classes/">All classes</a>
      <a href="/classes/weekly-classes/">Weekly subject tutoring</a>
      <a href="/classes/english-assignment-drafting/">English assignment drafting</a>
      <a href="/classes/examprep/">Exam preparation courses</a>
      <a href="/classes/ucatprep/">UCAT preparation</a>
      <a href="/classes/medical-interview-preparation/">Medical Interview Preparation</a>
    </nav>
    <nav class="legacy-site-footer__nav" aria-label="Company links">
      <h3>Company</h3>
      <a href="/">Home</a>
      <a href="/about/">About us</a>
      <a href="/about/testimonials/">Testimonials</a>
      <a href="/about/subsidy/">Tuition subsidy</a>
      <a href="/about/apply/">Work with us</a>
      <a href="/about/contact/">Contact us</a>
    </nav>
  </div>
`;

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
      <LegacyWordPressInteractions />
      <footer
        className="legacy-site-footer"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: LEGACY_SITE_FOOTER_HTML }}
      />
    </>
  );
}
