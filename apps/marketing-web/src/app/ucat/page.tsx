import type { Metadata } from "next";
import { UcatMarketingLandingPage } from "@/features/product-landing/ucat/ucat-marketing-landing-page";

const canonical = "https://altitutor.com/ucat/";

export const metadata: Metadata = {
  title: "Online UCAT preparation and practice | Altitutor",
  description:
    "Prepare for the UCAT with adaptive practice, full-length mocks, skill training, progress analytics and a study plan that responds to your performance.",
  alternates: { canonical },
  openGraph: {
    title: "Alti UCAT Prep",
    description:
      "A science-backed UCAT practice system built around adaptive data, deliberate practice and measurable progress.",
    url: canonical,
    siteName: "Altitutor",
    locale: "en_AU",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export default function UcatLandingPage() {
  return <UcatMarketingLandingPage />;
}
