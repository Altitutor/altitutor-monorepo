import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { HomeExperience } from "../HomeExperience";
import { MarketingNav } from "../MarketingNav";
import { MarketingMotion } from "../MarketingMotion";
import { MarketingButton, MarketingCard, MarketingHeading } from "../MarketingUI";
import { marketingPages, type MarketingPage, type MarketingPageSection } from "@/content/marketing-pages";
import {
  getMarketingStaffProfiles,
  getStaffProfileImageUrl,
  type MarketingStaffProfile,
} from "@/lib/staff-profiles";
import { COURSE_LINKS, PRODUCT_LINKS, SITE_NAME, SITE_URL } from "@/lib/site";

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

function normalizePath(path: string) {
  if (!path || path === "/") return "/";
  const withLeadingSlash = path.startsWith("/") ? path : `/${path}`;
  return withLeadingSlash.endsWith("/") ? withLeadingSlash : `${withLeadingSlash}/`;
}

function pathFromSlug(slug?: string[]) {
  if (!slug || slug.length === 0) return "/";
  return normalizePath(slug.join("/"));
}

function getMarketingPage(path: string) {
  const normalizedPath = normalizePath(path);
  return marketingPages.find((page) => page.path === normalizedPath);
}

export function generateStaticParams() {
  return marketingPages.map((page) => ({
    slug: page.path === "/" ? [] : page.path.replace(/^\/|\/$/g, "").split("/"),
  }));
}

export const dynamicParams = false;

export function generateMetadata({ params }: PageProps): Metadata {
  const page = getMarketingPage(pathFromSlug(params.slug));

  if (!page) {
    return {
      title: `Page not found | ${SITE_NAME}`,
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const shouldIndex = page.seo.index !== false;

  return {
    title: {
      absolute: page.seo.title,
    },
    description: page.seo.description,
    keywords: page.seo.keywords,
    alternates: {
      canonical: `${SITE_URL}${page.path}`,
    },
    openGraph: {
      type: "website",
      locale: "en_AU",
      siteName: SITE_NAME,
      title: page.seo.title,
      description: page.seo.description,
      url: `${SITE_URL}${page.path}`,
      images: page.hero.image
        ? [
            {
              url: `${SITE_URL}${page.hero.image}`,
              alt: page.title,
            },
          ]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: page.seo.title,
      description: page.seo.description,
      images: page.hero.image ? [`${SITE_URL}${page.hero.image}`] : undefined,
    },
    robots: {
      index: shouldIndex,
      follow: true,
      googleBot: {
        index: shouldIndex,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
  };
}

export default async function MarketingRoute({ params }: PageProps) {
  const page = getMarketingPage(pathFromSlug(params.slug));

  if (!page) {
    notFound();
  }

  const structuredData = getStructuredData(page);
  const isHome = page.path === "/";
  const staffProfiles = page.path === "/about/" ? await getMarketingStaffProfiles() : [];

  return (
    <MarketingMotion>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <div className="marketing-noise" aria-hidden>
        <svg xmlns="http://www.w3.org/2000/svg">
          <filter id="marketingNoiseFilter">
            <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
          </filter>
          <rect width="100%" height="100%" filter="url(#marketingNoiseFilter)" />
        </svg>
      </div>
      <main className="marketing-site">
        <MarketingNav />

        <section id={isHome ? "alti-home" : undefined} className={`marketing-hero ${isHome ? "marketing-hero--text-only" : ""}`}>
          {isHome ? (
            <Image
              className="marketing-hero__background"
              src="/images/landing/background-alt-scaled.jpg"
              alt="Altitutor online learning dashboard and study resources"
              fill
              priority
              sizes="100vw"
            />
          ) : null}
          <div className="marketing-hero__copy">
            <p className="marketing-kicker" data-hero-reveal>
              Adelaide tutoring for students and parents
            </p>
            <h1 data-hero-reveal aria-label={`${page.hero.noun} ${page.hero.power}.`}>
              <span className="marketing-hero__sans">{page.hero.noun}</span>
              {" "}
              <span className="marketing-hero__drama">{page.hero.power}.</span>
            </h1>
            <p className="marketing-hero__lead" data-hero-reveal>
              {page.description}
            </p>
            <div className="marketing-hero__actions" data-hero-reveal>
              <MarketingButton href={PRODUCT_LINKS.trialBooking}>
                Book a trial session
              </MarketingButton>
              <MarketingButton variant="outline" href="/classes/">
                View courses
              </MarketingButton>
            </div>
          </div>
          {!isHome ? (
            <div className="marketing-hero__media" aria-hidden={!page.hero.image} data-hero-reveal>
              {page.hero.image ? (
                <Image src={page.hero.image} alt="" fill sizes="(min-width: 1024px) 42vw, 100vw" />
              ) : (
                <div className="marketing-hero__mark">A</div>
              )}
            </div>
          ) : null}
        </section>

        {isHome ? (
          <HomeExperience />
        ) : (
          <div className={`marketing-page-shell marketing-page-shell--${page.kind}`}>
            <MarketingPageContent page={page} />

            {staffProfiles.length > 0 ? <StaffProfilesSection profiles={staffProfiles} /> : null}

            <section className="marketing-cta" data-reveal>
              <p className="marketing-kicker">Start with a real lesson</p>
              <MarketingHeading variant="display">Book a free 1 hour trial session in Adelaide.</MarketingHeading>
              <p>
                Meet a tutor, discuss availability and logistics, and decide whether Altitutor is the right fit.
              </p>
              <MarketingButton href={PRODUCT_LINKS.trialBooking}>
                Book a trial session
              </MarketingButton>
            </section>
          </div>
        )}
      </main>

      <footer className="marketing-footer">
        <div>
          <MarketingHeading variant="footer">Altitutor.</MarketingHeading>
          <p className="marketing-footer__tagline">Adelaide tutoring for students who want schoolwork to become easier.</p>
          <p className="marketing-footer__status"><span /> System Operational</p>
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
          <MarketingHeading as="h3" variant="footer">Education</MarketingHeading>
          {COURSE_LINKS.map(([href, label]) => (
            <Link key={href} href={href}>
              {label}
            </Link>
          ))}
        </nav>
        <nav aria-label="Company links">
          <MarketingHeading as="h3" variant="footer">Company</MarketingHeading>
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

function MarketingPageContent({ page }: { page: MarketingPage }) {
  return (
    <article className={`marketing-content marketing-content--${page.kind}`} data-page-path={page.path} data-reveal>
      {page.sections.map((section) => (
        <MarketingContentSection key={section.heading} section={section} />
      ))}
    </article>
  );
}

function MarketingContentSection({ section }: { section: MarketingPageSection }) {
  return (
    <MarketingCard as="section" className="marketing-rich-section">
      {section.eyebrow ? <p className="marketing-kicker">{section.eyebrow}</p> : null}
      <MarketingHeading>{section.heading}</MarketingHeading>
      {section.body?.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
      {section.list ? (
        <ul>
          {section.list.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
      {section.cards ? (
        <div className="marketing-rich-grid">
          {section.cards.map((card) => (
            <MarketingCard className="marketing-rich-card" key={card.title}>
              <MarketingHeading as="h3" variant="card">{card.title}</MarketingHeading>
              <p>{card.description}</p>
              {card.href ? (
                <MarketingButton href={card.href}>
                  Learn more
                </MarketingButton>
              ) : null}
            </MarketingCard>
          ))}
        </div>
      ) : null}
    </MarketingCard>
  );
}

function StaffProfilesSection({ profiles }: { profiles: MarketingStaffProfile[] }) {
  return (
    <section className="marketing-staff" data-reveal>
      <div className="marketing-staff__intro">
        <p className="marketing-kicker">Our team</p>
        <MarketingHeading variant="display">Meet the people behind Altitutor.</MarketingHeading>
      </div>
      <div className="marketing-staff__grid">
        {profiles.map((profile) => {
          const imageUrl = getStaffProfileImageUrl(profile);
          const name = [profile.first_name, profile.last_name].filter(Boolean).join(" ");
          const paragraphs = (profile.profile_bio ?? "")
            .split(/\n{2,}/)
            .map((paragraph) => paragraph.trim())
            .filter(Boolean);

          return (
            <MarketingCard className="marketing-staff__profile" key={profile.staff_id}>
              {imageUrl ? (
                <Image src={imageUrl} alt={name} width={360} height={360} sizes="(min-width: 900px) 18rem, 100vw" />
              ) : (
                <div className="marketing-staff__placeholder" aria-hidden>
                  {name.slice(0, 1)}
                </div>
              )}
              <div>
                <MarketingHeading as="h3" variant="card">{name}</MarketingHeading>
                {paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </MarketingCard>
          );
        })}
      </div>
    </section>
  );
}

function getStructuredData(page: MarketingPage) {
  const organization = {
    "@context": "https://schema.org",
    "@type": "EducationalOrganization",
    name: SITE_NAME,
    url: SITE_URL,
    description: marketingPages[0].description,
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

  const webPage = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: page.title,
    url: `${SITE_URL}${page.path}`,
    description: page.description,
    isPartOf: {
      "@type": "WebSite",
      name: SITE_NAME,
      url: SITE_URL,
    },
  };

  if (page.kind === "course-detail") {
    return [
      organization,
      webPage,
      {
        "@context": "https://schema.org",
        "@type": "Course",
        name: page.title,
        description: page.description,
        provider: {
          "@type": "EducationalOrganization",
          name: SITE_NAME,
          sameAs: SITE_URL,
        },
      },
    ];
  }

  return [organization, webPage];
}
