import type { Metadata } from "next";
import { UcatMarketingLandingPage } from "@/features/product-landing/ucat/ucat-marketing-landing-page";

const canonical = "https://altitutor.com/ucat/";

export const metadata: Metadata = {
  title: "UCAT preparation Australia and New Zealand | Altitutor UCAT",
  description:
    "Online UCAT preparation for students in Australia and New Zealand, with 10,000+ questions, 30+ full mocks, score estimation, adaptive study planning, and ongoing Free access.",
  alternates: { canonical },
  openGraph: {
    title: "UCAT prep, planned for you | Altitutor UCAT",
    description:
      "Altitutor intelligently plans UCAT practice around your strengths, weaknesses, target score, and test date. Start preparing free.",
    url: canonical,
    siteName: "Altitutor",
    locale: "en_AU",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "UCAT prep, planned for you | Altitutor UCAT",
    description:
      "An adaptive UCAT study plan built around your strengths, weaknesses, target score, and test date. Start preparing free.",
  },
  robots: { index: true, follow: true },
};

export default function UcatLandingPage() {
  return <UcatMarketingLandingPage />;
}
