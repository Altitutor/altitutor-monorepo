import type { Metadata } from "next";
import { JsonLd } from "@/features/marketing/components/json-ld";
import { SiteFrame } from "@/features/marketing/components/site-frame";
import { OnlineCoursesPage } from "@/features/marketing/pages/online-courses-page";
import { buildRouteSchema } from "@/lib/pages";

const title = "Online SACE, IB & UCAT Courses | Altitutor";
const description =
  "Explore Altitutor online SACE and IB study resources and personalised UCAT preparation. Learn with notes, video lessons, practice questions and mock exams.";
const canonicalPath = "/online-courses/";
const canonical = `https://altitutor.com${canonicalPath}`;
export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical },
  openGraph: { title, description, url: canonical },
  twitter: { card: "summary_large_image", title, description },
};
export default function OnlineCoursesRoute() {
  return (
    <SiteFrame>
      <JsonLd data={buildRouteSchema(canonicalPath, title, description)} />
      <OnlineCoursesPage />
    </SiteFrame>
  );
}
