import { UcatLandingComparison } from "./ucat-landing-comparison";
import { UcatLandingFooter } from "./ucat-landing-footer";
import { UcatLandingHero } from "./ucat-landing-hero";
import { UcatProductStage } from "./ucat-product-stage";
import { UcatLandingNavbar } from "./ucat-landing-navbar";
import { UcatLandingPricing } from "./ucat-landing-pricing";
import { UcatLandingProtocol } from "./ucat-landing-protocol";
import { UcatLandingScrollIndicator } from "./ucat-landing-scroll-indicator";
import { UcatLandingStories } from "./ucat-landing-stories";
import { UcatLandingFaq } from "./ucat-landing-faq";
import { UcatHowItWorks } from "./ucat-how-it-works";

export function UcatMarketingLandingPage() {
  return (
    <main className="relative min-h-dvh overflow-x-hidden bg-marketing-cream text-marketing-charcoal antialiased selection:bg-marketing-accent selection:text-marketing-charcoal">
      <UcatLandingScrollIndicator />
      <UcatLandingNavbar />
      <UcatLandingHero />
      <UcatProductStage />
      <UcatLandingProtocol />
      <UcatHowItWorks />
      <UcatLandingStories />
      <UcatLandingComparison />
      <UcatLandingPricing />
      <UcatLandingFaq />
      <UcatLandingFooter />
    </main>
  );
}
