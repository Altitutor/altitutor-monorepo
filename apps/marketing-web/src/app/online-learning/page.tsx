import type { Metadata } from "next";
import {
  NavbarV2,
  HeroSectionV2,
  PhilosophySectionV2,
  ResourcesSectionV2,
  UCATSectionV2,
  CommunitySectionV2,
  GetStartedSectionV2,
  FooterV2,
  ScrollIndicatorV2,
  NoiseOverlay,
} from "@/features/product-landing/student/components/v2";

const canonical = "https://altitutor.com/online-learning/";

export const metadata: Metadata = {
  title: "Online learning resources and student support | Altitutor",
  description:
    "Access Altitutor learning modules, study resources, homework support, flashcards and question boards for science, mathematics and English.",
  alternates: { canonical },
  openGraph: {
    title: "Altitutor Online Learning",
    description:
      "Personalised learning, expert support and practical online resources for Altitutor students.",
    url: canonical,
    siteName: "Altitutor",
    locale: "en_AU",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export default function OnlineLearningLandingPage() {
  return (
    <main className="min-h-dvh bg-marketing-cream font-sans text-marketing-charcoal antialiased selection:bg-marketing-accent selection:text-marketing-charcoal">
      <NoiseOverlay />
      <ScrollIndicatorV2 />
      <NavbarV2 />
      <HeroSectionV2 />
      <PhilosophySectionV2 />
      <ResourcesSectionV2 />
      <UCATSectionV2 />
      <CommunitySectionV2 />
      <GetStartedSectionV2 />
      <FooterV2 />
    </main>
  );
}
