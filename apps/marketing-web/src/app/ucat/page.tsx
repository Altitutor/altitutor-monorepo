import type { Metadata } from "next";
import { UcatMarketingLandingPage } from "@/features/product-landing/ucat/ucat-marketing-landing-page";

const canonical = "https://altitutor.com/ucat/";

export const metadata: Metadata = {
  title: "UCAT preparation Australia and New Zealand | Altitutor UCAT",
  description:
    "Online UCAT preparation for students in Australia and New Zealand, with 10,000+ questions, 30+ full mocks, score estimation, adaptive study planning, and ongoing Free access.",
  alternates: { canonical },
  openGraph: {
    title: "Altitutor UCAT — know where you stand and what to do next",
    description:
      "Online UCAT preparation for Australia and New Zealand. Start free with 10,000+ questions, 30+ full mocks, score tracking, and a plan built around your target.",
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
