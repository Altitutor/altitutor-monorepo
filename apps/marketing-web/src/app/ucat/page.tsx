import type { Metadata } from "next";
import { UcatMarketingLandingPage } from "@/features/product-landing/ucat/ucat-marketing-landing-page";

const canonical = "https://altitutor.com/ucat/";

export const metadata: Metadata = {
  title: "UCAT preparation Australia & New Zealand | Altitutor UCAT",
  description:
    "Know where you stand and what to do next with 10,000+ UCAT questions, 30+ full mocks, score estimation, adaptive study planning, and a Free plan that keeps resetting.",
  alternates: { canonical },
  openGraph: {
    title: "Altitutor UCAT — know where you stand and what to do next",
    description:
      "Start preparing free with 10,000+ questions, 30+ full mocks, score tracking, and a plan built around your target.",
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
