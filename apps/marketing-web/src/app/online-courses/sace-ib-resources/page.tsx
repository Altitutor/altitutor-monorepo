import type { Metadata } from "next";
import { JsonLd } from "@/features/marketing/components/json-ld";
import { SiteFrame } from "@/features/marketing/components/site-frame";
import { ResourcesPage } from "@/features/marketing/pages/resources-page";
import { buildRouteSchema } from "@/lib/pages";

const title =
  "Online SACE & IB Study Resources, Notes & Practice Exams | Altitutor";
const description =
  "Study SACE and IB with Altitutor's online notes, video lessons, practice questions and exams. Explore resources for maths, science and English, plus tutor support.";
const canonicalPath = "/online-courses/sace-ib-resources/";
const canonical = `https://altitutor.com${canonicalPath}`;
export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical },
  openGraph: { title, description, url: canonical },
  twitter: { card: "summary_large_image", title, description },
};
export default function ResourcesRoute() {
  return (
    <SiteFrame>
      <JsonLd data={buildRouteSchema(canonicalPath, title, description)} />
      <ResourcesPage />
    </SiteFrame>
  );
}
