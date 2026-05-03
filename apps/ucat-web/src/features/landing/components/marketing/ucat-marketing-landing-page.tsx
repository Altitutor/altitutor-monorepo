"use client";

import { NoiseOverlay } from "./noise-overlay";
import { UcatLandingFeatures } from "./ucat-landing-features";
import { UcatLandingFooter } from "./ucat-landing-footer";
import { UcatLandingHero } from "./ucat-landing-hero";
import { UcatLandingNavbar } from "./ucat-landing-navbar";
import { UcatLandingPhilosophy } from "./ucat-landing-philosophy";
import { UcatLandingPricing } from "./ucat-landing-pricing";
import { UcatLandingProtocol } from "./ucat-landing-protocol";

export function UcatMarketingLandingPage() {
  return (
    <main className="relative min-h-dvh bg-marketing-cream text-marketing-charcoal antialiased selection:bg-marketing-accent selection:text-marketing-charcoal">
      <NoiseOverlay />
      <UcatLandingNavbar />
      <UcatLandingHero />
      <UcatLandingFeatures />
      <UcatLandingPhilosophy />
      <UcatLandingProtocol />
      <UcatLandingPricing />
      <UcatLandingFooter />
    </main>
  );
}
