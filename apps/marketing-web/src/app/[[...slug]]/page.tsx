import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import {
  createMetadata,
  getAllMarketingPages,
  getMarketingPage,
  getPageSchema,
  pathFromSlug,
} from "@/lib/pages";
import { SiteFrame } from "@/features/marketing/components/site-frame";
import { HomePage } from "@/features/marketing/pages/home-page";
import { AboutPage } from "@/features/marketing/pages/about-page";
import { ContactPage } from "@/features/marketing/pages/contact-page";
import { CoursesPage } from "@/features/marketing/pages/courses-page";
import { CoursePage } from "@/features/marketing/pages/course-page";
import { ResourcesPage } from "@/features/marketing/pages/resources-page";
import { SubsidyPage } from "@/features/marketing/pages/subsidy-page";
import { CareersPage } from "@/features/marketing/pages/careers-page";
import { TestimonialsPage } from "@/features/marketing/pages/testimonials-page";
import { InformationPage } from "@/features/marketing/pages/information-page";
import legacyRedirects from "@/lib/legacy-redirects.json";
import { coursePaths } from "@/features/marketing/content";

type PageProps = { params: { slug?: string[] } };

export function generateStaticParams() {
  return getAllMarketingPages().map((page) => ({
    slug: page.path === "/" ? [] : page.path.split("/").filter(Boolean),
  }));
}

export const dynamicParams = false;

export function generateMetadata({ params }: PageProps): Metadata {
  const metadata = createMetadata(getMarketingPage(pathFromSlug(params.slug)));
  return {
    ...metadata,
    title: { absolute: String(metadata.title ?? "Altitutor") },
  };
}

function PageContent({ path, title }: { path: string; title: string }) {
  switch (path) {
    case "/":
      return <HomePage />;
    case "/about/":
      return <AboutPage />;
    case "/about/contact/":
      return <ContactPage />;
    case "/classes/":
      return <CoursesPage />;
    case "/resources/":
      return <ResourcesPage />;
    case "/about/subsidy/":
      return <SubsidyPage />;
    case "/about/apply/":
      return <CareersPage />;
    case "/about/testimonials/":
      return <TestimonialsPage />;
    default:
      if (coursePaths.some((course) => course === path))
        return <CoursePage path={path} />;
      return <InformationPage path={path} title={title} />;
  }
}

export default function MarketingRoute({ params }: PageProps) {
  const path = pathFromSlug(params.slug);
  const redirects: Record<string, string> = legacyRedirects.pageRedirects;
  if (redirects[path]) permanentRedirect(redirects[path]);
  const page = getMarketingPage(path);
  if (!page) notFound();
  const schema = getPageSchema(page);
  return (
    <SiteFrame>
      {schema ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(schema).replace(/</g, "\\u003c"),
          }}
        />
      ) : null}
      <PageContent path={page.path} title={page.title} />
    </SiteFrame>
  );
}
