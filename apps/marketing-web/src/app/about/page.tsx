import type { Metadata } from "next";
import { createMetadata, getMarketingPage, getPageSchema } from "@/lib/pages";
import { SiteFrame } from "@/features/marketing/components/site-frame";
import { AboutPage } from "@/features/marketing/pages/about-page";
import { JsonLd } from "@/features/marketing/components/json-ld";

// A concrete route lets the about page regenerate independently of the static
// catch-all, whose dynamicParams=false prevents regeneration after invalidation.
export const revalidate = 86400;

export function generateMetadata(): Metadata {
  const metadata = createMetadata(getMarketingPage("/about/"));
  return {
    ...metadata,
    title: { absolute: String(metadata.title ?? "Altitutor") },
  };
}

export default function AboutRoute() {
  const page = getMarketingPage("/about/");
  const schema = page ? getPageSchema(page) : null;
  return (
    <SiteFrame>
      {schema ? <JsonLd data={schema} /> : null}
      <AboutPage />
    </SiteFrame>
  );
}
