import { SiteFrame } from "@/features/marketing/components/site-frame";
import { UcatLandingComparison } from "./ucat-landing-comparison";
import { UcatLandingHero } from "./ucat-landing-hero";
import { UcatProductStage } from "./ucat-product-stage";
import { UcatLandingPricing } from "./ucat-landing-pricing";
import { UcatLandingProtocol } from "./ucat-landing-protocol";
import { UcatLandingStories } from "./ucat-landing-stories";
import { UcatLandingFaq } from "./ucat-landing-faq";
import { UcatHowItWorks } from "./ucat-how-it-works";

export function UcatMarketingLandingPage() {
  return (
    <SiteFrame>
      <UcatLandingHero />
      <UcatProductStage />
      <UcatLandingProtocol />
      <UcatHowItWorks />
      <UcatLandingStories />
      <UcatLandingComparison />
      <UcatLandingPricing />
      <UcatLandingFaq />
    </SiteFrame>
  );
}
