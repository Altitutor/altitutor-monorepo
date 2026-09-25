import type { Metadata } from "next";
import { SiteFrame } from "@/features/marketing/components/site-frame";
import { ResourcesPage } from "@/features/marketing/pages/resources-page";

const title =
  "Online SACE & IB Study Resources, Notes & Practice Exams | Altitutor";
const description =
  "Study SACE and IB with Altitutor's online notes, video lessons, practice questions and exams. Explore resources for maths, science and English, plus tutor support.";
const canonical = "https://altitutor.com/online-courses/sace-ib-resources/";
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
      <ResourcesPage />
    </SiteFrame>
  );
}
