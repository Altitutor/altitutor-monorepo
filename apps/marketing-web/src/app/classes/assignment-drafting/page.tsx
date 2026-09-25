import type { Metadata } from "next";
import { JsonLd } from "@/features/marketing/components/json-ld";
import { SiteFrame } from "@/features/marketing/components/site-frame";
import { CoursePage } from "@/features/marketing/pages/course-page";
import { buildRouteSchema } from "@/lib/pages";

const title = "Assignment Drafting & Writing Feedback in Adelaide | Altitutor";
const description =
  "Strengthen your essays, reports and research assignments with one-on-one feedback from Altitutor tutors in Adelaide. Improve structure, clarity and analysis.";
const canonicalPath = "/classes/assignment-drafting/";
const canonical = `https://altitutor.com${canonicalPath}`;
export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical },
  openGraph: { title, description, url: canonical },
  twitter: { card: "summary_large_image", title, description },
};
export default function AssignmentDraftingRoute() {
  return (
    <SiteFrame>
      <JsonLd data={buildRouteSchema(canonicalPath, title, description)} />
      <CoursePage path="/classes/english-assignment-drafting/" />
    </SiteFrame>
  );
}
