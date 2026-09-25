import type { Metadata } from "next";
import { SiteFrame } from "@/features/marketing/components/site-frame";
import { OnlineCoursesPage } from "@/features/marketing/pages/online-courses-page";

const title = "Online SACE, IB & UCAT Courses | Altitutor";
const description =
  "Explore Altitutor online SACE and IB study resources and personalised UCAT preparation. Learn with notes, video lessons, practice questions and mock exams.";
const canonical = "https://altitutor.com/online-courses/";
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
      <OnlineCoursesPage />
    </SiteFrame>
  );
}
