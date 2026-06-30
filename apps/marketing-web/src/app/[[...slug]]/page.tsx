import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import clsx from "clsx";
import { notFound } from "next/navigation";
import { Facebook, Instagram, Linkedin, Twitter, Youtube, type LucideIcon } from "lucide-react";
import { HomeExperience } from "../HomeExperience";
import { MarketingNav } from "../MarketingNav";
import { MarketingMotion } from "../MarketingMotion";
import { MarketingButton, MarketingCard, MarketingHeading } from "../MarketingUI";
import styles from "../MarketingRoute.module.css";
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

type SocialIcon = LucideIcon | typeof TikTokIcon;

const SOCIAL_LINKS: Array<[string, SocialIcon, string]> = [
  ["Instagram", Instagram, "https://www.instagram.com/altitutor/"],
  ["Facebook", Facebook, "https://www.facebook.com/altitutoreducation/"],
  ["Twitter", Twitter, "https://twitter.com/Altitutor"],
  ["YouTube", Youtube, "https://www.youtube.com/@altitutor"],
  ["TikTok", TikTokIcon, "https://www.tiktok.com/@altitutor"],
  ["LinkedIn", Linkedin, "https://www.linkedin.com/company/altitutor/"],
];

function TikTokIcon({ size = 18, ...props }: { size?: number; "aria-hidden"?: boolean }) {
  return (
    <svg
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M15.2 3c.28 2.38 1.62 3.8 3.92 3.96v3.07a6.82 6.82 0 0 1-3.84-1.18v5.76c0 2.92-1.76 5.39-4.57 6.06-1.83.44-3.6.05-5.08-1.18-2.82-2.36-2.1-6.8 1.34-8.19a6.5 6.5 0 0 1 3.07-.37v3.18c-.28-.08-.55-.13-.83-.13-1.39-.02-2.45.84-2.56 2.08-.12 1.36.78 2.43 2.16 2.55 1.52.13 2.6-.83 2.63-2.45.03-2.8 0-5.58 0-8.37V3h3.76Z"
        fill="currentColor"
      />
    </svg>
  );
}

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
  const currentYear = new Date().getFullYear();

  return (
    <MarketingMotion>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <div className={styles.noise} aria-hidden>
        <svg xmlns="http://www.w3.org/2000/svg">
          <filter id="marketingNoiseFilter">
            <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
          </filter>
          <rect width="100%" height="100%" filter="url(#marketingNoiseFilter)" />
        </svg>
      </div>
      <main className={styles.site}>
        <MarketingNav />

        <section
          id={isHome ? "alti-home" : undefined}
          className={clsx(styles.hero, isHome && styles.heroTextOnly, !isHome && !page.hero.image && styles.heroNoMedia)}
        >
          {isHome ? (
            <Image
              className={styles.heroBackground}
              src="/images/landing/background-alt-scaled.jpg"
              alt="Altitutor online learning dashboard and study resources"
              fill
              priority
              sizes="100vw"
            />
          ) : null}
          <div className={styles.heroCopy}>
            <p className="marketing-kicker" data-hero-reveal>
              Adelaide tutoring for students and parents
            </p>
            <h1 data-hero-reveal aria-label={`${page.hero.noun} ${page.hero.power}.`}>
              <span className={styles.heroSans}>{page.hero.noun}</span>
              {" "}
              <span className={styles.heroDrama}>{page.hero.power}.</span>
            </h1>
            <p className={styles.heroLead} data-hero-reveal>
              {page.description}
            </p>
            <div className={styles.heroActions} data-hero-reveal>
              <MarketingButton href={PRODUCT_LINKS.trialBooking}>
                Book a trial session
              </MarketingButton>
              <MarketingButton variant="outline" href="/classes/">
                View courses
              </MarketingButton>
            </div>
          </div>
          {!isHome && page.hero.image ? (
            <div className={styles.heroMedia} aria-hidden data-hero-reveal>
              <Image src={page.hero.image} alt="" fill sizes="(min-width: 1024px) 42vw, 100vw" />
            </div>
          ) : null}
        </section>

        {isHome ? (
          <HomeExperience />
        ) : (
          <div className={styles.pageShell}>
            {page.path === "/about/" ? (
              <AboutPageContent profiles={staffProfiles} />
            ) : (
              <MarketingPageContent page={page} />
            )}

            <section className={styles.cta} data-reveal>
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

      <footer className={styles.footer}>
        <div className={styles.footerMain}>
          <div>
            <MarketingHeading variant="footer">Altitutor.</MarketingHeading>
            <p className={styles.footerTagline}>A mission-driven non-profit providing accessible education for all students.</p>
            <address>
              Level 1, 17A Solomon St
              <br />
              Adelaide SA 5000
            </address>
            <div className={styles.footerSocials} aria-label="Altitutor social links">
              {SOCIAL_LINKS.map(([label, Icon, href]) => (
                <a key={href} href={href} aria-label={label} target="_blank" rel="noreferrer">
                  <Icon aria-hidden size={18} strokeWidth={2} />
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
        </div>
        <div className={styles.footerMeta}>
          <p>ACN: 639 197 167</p>
          <p>Copyright © {currentYear} Altitutor Pty Ltd</p>
        </div>
      </footer>
    </MarketingMotion>
  );
}

function MarketingPageContent({ page }: { page: MarketingPage }) {
  return (
    <article className={styles.content} data-page-path={page.path}>
      {page.sections.map((section, index) => (
        <MarketingContentSection key={section.heading} section={section} index={index} />
      ))}
    </article>
  );
}

const aboutValues = [
  {
    label: "01",
    title: "Fairness and equality",
    description:
      "Altitutor is not-for-profit, with revenue directed back into teaching and a subsidy program for students who need free or reduced-cost support.",
    href: "/about/subsidy/",
  },
  {
    label: "02",
    title: "Transparency",
    description:
      "Parents can organise a meeting with their child's tutor during the week, so questions, progress and concerns do not wait for the next invoice cycle.",
  },
  {
    label: "03",
    title: "Student enjoyment",
    description:
      "Lessons are designed so students want to come to tutoring, with confident teaching programs, optional extension resources and a more human learning environment.",
  },
  {
    label: "04",
    title: "Community",
    description:
      "Students learn with peers, help each other, join end-of-year events and often return as tutors after graduating.",
    href: "/about/testimonials/",
  },
];

const teachingMethods = [
  "1.5 hour sessions that give students enough time to learn deeply without losing focus.",
  "Small classes grouped by level and learning ability, so students can learn from each other.",
  "Study methods used by tutors and past students to achieve excellent results.",
  "Two-tutor sessions that preserve individual help inside a collaborative class.",
  "Comprehensive notes, practice questions, tests and exams ready for students to use.",
];

const inClassSteps = [
  {
    title: "Revision and consolidation",
    description:
      "Students begin each lesson with revision sheets or flashcards so content stays active long before exams arrive.",
  },
  {
    title: "Learning ahead",
    description:
      "Tutors teach course content ahead of school using notes and practice questions, making school lessons easier to absorb.",
  },
  {
    title: "Assessment preparation",
    description:
      "After each topic, students work through topic tests and assessment strategies until they feel ready to move forward.",
  },
];

const outOfClassSupport = [
  {
    title: "Homework help session",
    description:
      "Weekly students can attend a free 3-hour homework help class for assessment preparation, assignment drafting and catch-up support.",
  },
  {
    title: "24/7 guidance",
    description:
      "Students have unlimited access to the question helpline, where they can ask tutors questions during the week.",
  },
  {
    title: "Online resources",
    description:
      "Enrolled students receive access to notes, video lessons, flashcards, practice questions, tests and exams for their courses.",
  },
];

const charities = [
  "The Salvation Army Red Shield Appeal",
  "Alongsiders International",
  "Cancer Council",
  "CBM Australia",
  "Cambodian Harvest",
  "Soddo Christian Hospital",
];

function AboutPageContent({ profiles }: { profiles: MarketingStaffProfile[] }) {
  return (
    <>
      <section className={styles.aboutIntro} data-reveal>
        <div>
          <p className="marketing-kicker">Founded by tutors</p>
          <MarketingHeading>
            A complete education,
            <span> without losing the student.</span>
          </MarketingHeading>
        </div>
        <div className={styles.aboutIntroCopy}>
          <p>
            Altitutor was founded by a group of tutors who wanted a better way to do tuition. Individual tutors can struggle to provide complete support, while larger companies can lose the personal learning relationship.
          </p>
          <p>
            We built a model that combines both: small classes, tailored guidance, strong resources and a not-for-profit structure that helps families access tutoring when money would otherwise get in the way.
          </p>
        </div>
      </section>

      <section className={styles.aboutManifesto} data-reveal>
        <div className={styles.aboutManifestoTexture} aria-hidden />
        <div className={styles.aboutManifestoInner}>
          <p>Most tutoring is built around expensive access and private advantage.</p>
          <MarketingHeading as="h2" variant="display">
            Altitutor exists to make excellent teaching more accessible.
          </MarketingHeading>
          <p>
            Tutoring is lucrative. We know. Altitutor does not want to be another tutoring company chasing profit; revenue goes back into teaching students who cannot afford support.
          </p>
        </div>
      </section>

      <section className={styles.aboutSection} data-reveal>
        <div className={styles.aboutSectionHeader}>
          <p className="marketing-kicker">Our values</p>
          <MarketingHeading>
            High standards,
            <span> wider access.</span>
          </MarketingHeading>
        </div>
        <div className={styles.aboutValueGrid}>
          {aboutValues.map((value) => (
            <MarketingCard className={styles.aboutValueCard} key={value.title}>
              <span>{value.label}</span>
              <MarketingHeading as="h3" variant="card">{value.title}</MarketingHeading>
              <p>{value.description}</p>
              {value.href ? (
                <MarketingButton href={value.href} variant="outline">
                  Learn more
                </MarketingButton>
              ) : null}
            </MarketingCard>
          ))}
        </div>
      </section>

      <section className={styles.aboutMethod} data-reveal>
        <div className={styles.aboutMethodCopy}>
          <p className="marketing-kicker">Our teaching method</p>
          <MarketingHeading>
            The best way to judge us is to try a lesson.
          </MarketingHeading>
          <p>
            A free trial session gives students and parents a direct sample of how we teach. These are the principles behind the model.
          </p>
          <MarketingButton href={PRODUCT_LINKS.trialBooking}>
            Book a trial session
          </MarketingButton>
        </div>
        <ol className={styles.aboutMethodList}>
          {teachingMethods.map((method) => (
            <li key={method}>{method}</li>
          ))}
        </ol>
      </section>

      <section className={styles.aboutLearningGrid} data-reveal>
        <div className={styles.aboutLearningPanel}>
          <p className="marketing-kicker">In class</p>
          <MarketingHeading as="h2" variant="display">Students learn ahead of school.</MarketingHeading>
          {inClassSteps.map((step, index) => (
            <div className={styles.aboutLearningStep} key={step.title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <MarketingHeading as="h3" variant="card">{step.title}</MarketingHeading>
                <p>{step.description}</p>
              </div>
            </div>
          ))}
        </div>
        <div className={styles.aboutLearningPanel}>
          <p className="marketing-kicker">Out of class</p>
          <MarketingHeading as="h2" variant="display">Support continues through the week.</MarketingHeading>
          {outOfClassSupport.map((item) => (
            <MarketingCard className={styles.aboutSupportCard} key={item.title}>
              <MarketingHeading as="h3" variant="card">{item.title}</MarketingHeading>
              <p>{item.description}</p>
            </MarketingCard>
          ))}
        </div>
      </section>

      <section className={styles.teamLead} data-reveal>
        <div>
          <p className="marketing-kicker">Our team</p>
          <MarketingHeading>
            Students taught by people who care where they end up.
          </MarketingHeading>
        </div>
        <div>
          <p>
            Our team is made up of passionate, driven people who want students to improve their scores and join a community of young learners.
          </p>
          <MarketingButton href="/about/apply/" variant="outline">
            Work with us
          </MarketingButton>
        </div>
      </section>

      {profiles.length > 0 ? <StaffProfilesSection profiles={profiles} /> : null}

      <section className={styles.aboutCharities} data-reveal>
        <div>
          <p className="marketing-kicker">Charities we support</p>
          <MarketingHeading>
            Students help decide where giving goes.
          </MarketingHeading>
          <p>
            A significant portion of revenue each term is donated to a charity that students vote for from causes we believe in.
          </p>
        </div>
        <div className={styles.aboutCharityGrid}>
          {charities.map((charity) => (
            <span key={charity}>{charity}</span>
          ))}
        </div>
      </section>
    </>
  );
}

function MarketingContentSection({ section, index }: { section: MarketingPageSection; index: number }) {
  const hasCards = Boolean(section.cards?.length);
  const hasList = Boolean(section.list?.length);

  return (
    <section
      className={clsx(
        styles.richSection,
        index === 0 && styles.richSectionIntro,
        hasCards && styles.richSectionWithCards,
        hasList && styles.richSectionWithList,
        index % 3 === 1 && styles.richSectionTint,
      )}
      data-reveal
    >
      <div className={styles.richCopy}>
        {section.eyebrow ? <p className="marketing-kicker">{section.eyebrow}</p> : null}
        <MarketingHeading>{section.heading}</MarketingHeading>
        {section.body?.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>
      {section.list ? (
        <ol className={styles.richList}>
          {section.list.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      ) : null}
      {section.cards ? (
        <div className={styles.richGrid}>
          {section.cards.map((card) => (
            <MarketingCard className={styles.richCard} key={card.title}>
              <MarketingHeading as="h3" variant="card">{card.title}</MarketingHeading>
              <p>{card.description}</p>
              {card.href ? (
                <MarketingButton href={card.href}>
                  {card.actionLabel ?? "Learn more"}
                </MarketingButton>
              ) : null}
            </MarketingCard>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function StaffProfilesSection({ profiles }: { profiles: MarketingStaffProfile[] }) {
  return (
    <section className={styles.staff} data-reveal>
      <div className={styles.staffIntro}>
        <p className="marketing-kicker">Our team</p>
        <MarketingHeading variant="display">Meet the people behind Altitutor.</MarketingHeading>
      </div>
      <div className={styles.staffGrid}>
        {profiles.map((profile) => {
          const imageUrl = getStaffProfileImageUrl(profile);
          const name = [profile.first_name, profile.last_name].filter(Boolean).join(" ");
          const paragraphs = (profile.profile_bio ?? "")
            .split(/\n{2,}/)
            .map((paragraph) => paragraph.trim())
            .filter(Boolean);

          return (
            <MarketingCard className={styles.staffProfile} key={profile.staff_id}>
              {imageUrl ? (
                <Image src={imageUrl} alt={name} width={360} height={360} sizes="(min-width: 900px) 18rem, 100vw" />
              ) : (
                <div className={styles.staffPlaceholder} aria-hidden>
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
