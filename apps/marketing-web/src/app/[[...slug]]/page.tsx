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
        <a href="https://www.facebook.com/altitutoreducation/" aria-label="Facebook"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 8h3V4h-3c-3.3 0-5 2-5 5v2H6v4h3v5h4v-5h3.3l.7-4h-4V9c0-.7.3-1 1-1Z" /></svg></a>
        <a href="https://twitter.com/Altitutor" aria-label="Twitter"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.9 7.1v.6c0 6.2-4.7 13.3-13.3 13.3-2.6 0-5.1-.8-7.1-2.1h1.1c2.2 0 4.2-.7 5.8-2-2 0-3.7-1.4-4.3-3.2.3 0 .6.1.9.1.4 0 .8-.1 1.2-.2-2.1-.4-3.7-2.3-3.7-4.5V9c.6.3 1.3.5 2.1.6A4.7 4.7 0 0 1 2.1 3.4a13.2 13.2 0 0 0 9.6 4.9 4.6 4.6 0 0 1-.1-1.1 4.7 4.7 0 0 1 8.1-3.2 9.2 9.2 0 0 0 3-1.1 4.7 4.7 0 0 1-2.1 2.6 9.4 9.4 0 0 0 2.7-.7 10 10 0 0 1-2.4 2.3Z" /></svg></a>
        <a href="https://www.youtube.com/channel/UCtHb57z0bE-caSB76YguEMA" aria-label="YouTube"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M23 7.4a3 3 0 0 0-2.1-2.1C19 4.8 12 4.8 12 4.8s-7 0-8.9.5A3 3 0 0 0 1 7.4 31.4 31.4 0 0 0 .5 12 31.4 31.4 0 0 0 1 16.6a3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1 31.4 31.4 0 0 0 .5-4.6 31.4 31.4 0 0 0-.5-4.6ZM9.8 15.2V8.8l5.8 3.2-5.8 3.2Z" /></svg></a>
        <a href="https://www.tiktok.com/@altitutor" aria-label="TikTok"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16.7 3c.4 2.5 1.8 4 4.3 4.2v3.6a7.7 7.7 0 0 1-4.2-1.3v6.1A5.4 5.4 0 1 1 11.4 10h.8v3.8a2 2 0 1 0 1.2 1.8V3h3.3Z" /></svg></a>
        <a href="https://www.linkedin.com/company/altitutor/" aria-label="LinkedIn"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9.5h4v11H3v-11Zm6 0h3.8V11h.1c.5-1 1.8-1.9 3.7-1.9 4 0 4.7 2.6 4.7 6v5.4h-4v-4.8c0-1.2 0-2.7-1.6-2.7s-1.9 1.3-1.9 2.6v4.9H9v-11Z" /></svg></a>
        <a href="https://www.instagram.com/altitutor/" aria-label="Instagram"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Zm0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7Zm5 3.8a4.2 4.2 0 1 1 0 8.4 4.2 4.2 0 0 1 0-8.4Zm0 2a2.2 2.2 0 1 0 0 4.4 2.2 2.2 0 0 0 0-4.4Zm5.2-2.4a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z" /></svg></a>
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
