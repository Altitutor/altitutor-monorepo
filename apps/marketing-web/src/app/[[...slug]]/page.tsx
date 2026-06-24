import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MarketingMotion } from "../MarketingMotion";
import {
  createMetadata,
  getAllMarketingPages,
  getMarketingPage,
  getPageSchema,
  getRenderableHtml,
  pathFromSlug,
  type MarketingPage,
} from "@/lib/wordpress";
import { NAV_ITEMS, PRODUCT_LINKS, SITE_NAME, SITE_URL } from "@/lib/site";

type PageProps = {
  params: {
    slug?: string[];
  };
};

const SOCIAL_LINKS = [
  ["Facebook", "https://www.facebook.com/altitutoreducation/"],
  ["Instagram", "https://www.instagram.com/altitutor/"],
  ["TikTok", "https://www.tiktok.com/@altitutor"],
  ["LinkedIn", "https://www.linkedin.com/company/altitutor/"],
  ["YouTube", "https://www.youtube.com/channel/UCtHb57z0bE-caSB76YguEMA"],
] as const;

const COURSE_LINKS = [
  ["/classes/weekly-classes/", "Weekly subject tutoring"],
  ["/classes/english-assignment-drafting/", "English drafting"],
  ["/classes/examprep/", "Exam preparation"],
  ["/classes/ucatprep/", "UCAT preparation"],
  ["/classes/medical-interview-preparation/", "Medical interviews"],
] as const;

const HERO_IMAGES: Record<string, string> = {
  "/": "/wp-content/uploads/2021/12/website-resources-ipad-iphone.psd-600x443.png",
  "/classes/": "/wp-content/uploads/2021/12/Pre-course-prep-1-1075x1536.png",
  "/classes/weekly-classes/": "/wp-content/uploads/2021/11/SACE-Chemistry-notes-1-1080x1536.png",
  "/classes/english-assignment-drafting/": "/wp-content/uploads/2021/12/SACE-EngLit-draft-1-1024x1006.png",
  "/classes/examprep/": "/wp-content/uploads/2021/12/SACE-Chemistry-exam-1-1088x1536.png",
  "/classes/ucatprep/": "/wp-content/uploads/2021/12/UCAT-QR-online-13-inch-MBP.png",
  "/classes/medical-interview-preparation/": "/wp-content/uploads/2026/03/Josh.jpg",
  "/resources/": "/wp-content/uploads/2021/12/Anki-iphone-ipad-1024x763.png",
  "/about/": "/wp-content/uploads/2021/12/Profile-Picture-cropped-1024x1024.jpg",
  "/about/testimonials/": "/wp-content/uploads/2026/03/Darshil-1024x1024.jpg",
  "/about/apply/": "/wp-content/uploads/2026/03/square-image.jpg",
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
  const pageTitle = page.path === "/" ? "Adelaide tutoring that makes schoolwork easier." : page.title;
  const pageDescription = getPageDescription(page);
  const heroImage = getFirstImage(page);
  const mergedSchema = [schema, getLocalBusinessSchema(page)].filter(Boolean);

  return (
    <MarketingMotion>
      {mergedSchema.length > 0 ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(mergedSchema) }}
        />
      ) : null}
      <main className="marketing-site">
        <header className="marketing-nav" data-reveal>
          <Link className="marketing-nav__brand" href="/" aria-label="Altitutor home">
            <Image
              src="/wp-content/uploads/2021/01/Site-logo-large-1-300x55.png"
              alt="Altitutor"
              width={300}
              height={55}
              priority
            />
          </Link>
          <nav className="marketing-nav__links" aria-label="Primary navigation">
            {NAV_ITEMS.filter((item) =>
              ["/", "/classes/", "/classes/ucatprep/", "/resources/", "/about/", "/about/contact/"].includes(
                item.href,
              ),
            ).map((item) => (
              <Link key={item.href} href={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>
          <Link className="marketing-button marketing-button--dark" href={PRODUCT_LINKS.trialBooking}>
            Book trial
          </Link>
        </header>

        <section className="marketing-hero">
          <div className="marketing-hero__copy">
            <p className="marketing-kicker" data-hero-reveal>
              Adelaide tutoring for students and parents
            </p>
            <h1 data-hero-reveal>{pageTitle}</h1>
            <p className="marketing-hero__lead" data-hero-reveal>
              {pageDescription}
            </p>
            <div className="marketing-hero__actions" data-hero-reveal>
              <Link className="marketing-button marketing-button--accent" href={PRODUCT_LINKS.trialBooking}>
                Book a trial session
              </Link>
              <Link className="marketing-button marketing-button--ghost" href="/classes/">
                View courses
              </Link>
            </div>
          </div>
          <div className="marketing-hero__media" aria-hidden={!heroImage} data-hero-reveal>
            {heroImage ? (
              <Image src={heroImage} alt="" fill priority={page.path === "/"} sizes="(min-width: 1024px) 42vw, 100vw" />
            ) : (
              <div className="marketing-hero__mark">A</div>
            )}
          </div>
        </section>

        <section className="marketing-proof" aria-label="Altitutor details">
          <div>
            <strong>CBD learning centre</strong>
            <span>Level 1, 17A Solomon St, Adelaide SA 5000</span>
          </div>
          <div>
            <strong>Small group teaching</strong>
            <span>Classes sorted by level, goals and learning ability.</span>
          </div>
          <div>
            <strong>Not-for-profit model</strong>
            <span>Revenue supports subsidised tuition for students who need it.</span>
          </div>
        </section>

        <article
          className="marketing-content"
          data-reveal
          dangerouslySetInnerHTML={{ __html: getRenderableHtml(page) }}
        />

        <section className="marketing-cta" data-reveal>
          <p className="marketing-kicker">Start with a real lesson</p>
          <h2>Book a free 1 hour trial session in Adelaide.</h2>
          <p>
            Meet a tutor, discuss availability and logistics, and decide whether Altitutor is the right fit.
          </p>
          <Link className="marketing-button marketing-button--accent" href={PRODUCT_LINKS.trialBooking}>
            Book a trial session
          </Link>
        </section>
      </main>

      <footer className="marketing-footer">
        <div>
          <h2>Altitutor.</h2>
          <address>
            Level 1, 17A Solomon St
            <br />
            Adelaide SA 5000
          </address>
          <p>Copyright © 2021 Altitutor Pty Ltd</p>
          <p>ACN: 639 197 167</p>
          <div className="marketing-footer__socials">
            {SOCIAL_LINKS.map(([label, href]) => (
              <a key={href} href={href}>
                {label}
              </a>
            ))}
          </div>
        </div>
        <nav aria-label="Education links">
          <h3>Education</h3>
          {COURSE_LINKS.map(([href, label]) => (
            <Link key={href} href={href}>
              {label}
            </Link>
          ))}
        </nav>
        <nav aria-label="Company links">
          <h3>Company</h3>
          <Link href="/about/">About us</Link>
          <Link href="/about/testimonials/">Testimonials</Link>
          <Link href="/about/subsidy/">Tuition subsidy</Link>
          <Link href="/about/apply/">Work with us</Link>
          <Link href="/about/contact/">Contact us</Link>
        </nav>
      </footer>
    </MarketingMotion>
  );
}

function getPageDescription(page: MarketingPage) {
  const seoDescription = page.seo?.description?.trim();
  if (seoDescription) return seoDescription;
  const text = stripHtml(page.excerpt || page.html);
  if (text.length <= 220) return text;
  return `${text.slice(0, 217).trim()}...`;
}

function getFirstImage(page: MarketingPage) {
  if (HERO_IMAGES[page.path]) return HERO_IMAGES[page.path];
  const match = page.html.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i);
  if (!match?.[1]) return undefined;
  return match[1]
    .replace("https://altitutor.com/wp-content/", "/wp-content/")
    .replace("http://altitutor.com/wp-content/", "/wp-content/");
}

function getLocalBusinessSchema(page: MarketingPage) {
  return {
    "@context": "https://schema.org",
    "@type": "EducationalOrganization",
    name: SITE_NAME,
    url: `${SITE_URL}${page.path}`,
    description: getPageDescription(page),
    telephone: "+61483849842",
    email: "admin@altitutor.com",
    address: {
      "@type": "PostalAddress",
      streetAddress: "Level 1, 17A Solomon St",
      addressLocality: "Adelaide",
      addressRegion: "SA",
      postalCode: "5000",
      addressCountry: "AU",
    },
    areaServed: ["Adelaide", "South Australia"],
    knowsAbout: [
      "SACE tutoring",
      "UCAT preparation",
      "English drafting",
      "Mathematics tutoring",
      "Science tutoring",
      "Exam preparation",
    ],
  };
}

function stripHtml(html: string) {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&#8217;/g, "'")
    .replace(/&#8220;|&#8221;/g, '"')
    .replace(/&#8211;/g, "-")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}
