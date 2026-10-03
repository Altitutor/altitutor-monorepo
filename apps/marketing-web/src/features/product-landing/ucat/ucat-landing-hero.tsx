import { ArrowDown, ArrowRight, HeartHandshake } from "lucide-react";
import { AnalyticsLink } from "../analytics-link";
import { PRODUCT_LINKS } from "@/lib/site";
import { MagneticButton } from "@/features/marketing/components/magnetic-button";
import {
  MARKETING_SECTION_EYEBROW_CLASS,
  MARKETING_SECTION_DESCRIPTION_CLASS,
  MARKETING_SUPPORTING_TEXT_CLASS,
} from "@/features/marketing/section-styles";

import { MARKETING_TYPOGRAPHY as typo } from "@/features/marketing/theme";

export function UcatLandingHero() {
  return (
    <section
      id="altitutor-ucat"
      className="relative overflow-hidden bg-marketing-cream px-4 py-32 pt-36 sm:px-8 sm:py-40 sm:pt-44"
    >
      <div className="absolute left-1/2 top-0 h-80 w-[46rem] -translate-x-1/2 rounded-full bg-marketing-accent/14 blur-[110px]" />
      <div className="relative mx-auto w-full max-w-[92rem] text-center">
        <p
          data-hero-eyebrow
          className={`${MARKETING_SECTION_EYEBROW_CLASS} ${typo.dataMono}`}
        >
          UCAT preparation from Altitutor
        </p>
        <h1
          className={`mx-auto mt-7 text-5xl font-semibold leading-[0.95] tracking-[-0.052em] text-marketing-charcoal sm:text-7xl lg:text-[clamp(4.7rem,7.1vw,7rem)] ${typo.headingSans}`}
        >
          <span data-hero-line className="block lg:whitespace-nowrap">
            UCAT Prep?
          </span>
          <span
            data-hero-line
            className={`mt-2 block font-normal italic text-marketing-primary lg:whitespace-nowrap ${typo.dramaSerif}`}
          >
            Planned for you.
          </span>
        </h1>
        <p
          data-hero-support
          className={`mx-auto mt-8 max-w-2xl ${MARKETING_SECTION_DESCRIPTION_CLASS} ${typo.secondarySans}`}
        >
          Altitutor UCAT intelligently plans practice around your strengths and
          weaknesses, keeping you on track to hit your target score.
        </p>

        <div
          data-hero-support
          className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
        >
          <AnalyticsLink
            href={PRODUCT_LINKS.ucatSignup}
            analytics={{
              product: "ucat",
              placement: "hero",
              action: "start_free",
            }}
            className="w-full sm:w-auto"
          >
            <MagneticButton className="w-full bg-marketing-primary px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-marketing-primary/15 sm:w-auto">
              Start preparing free{" "}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </MagneticButton>
          </AnalyticsLink>
          <a href="#product" className="w-full sm:w-auto">
            <MagneticButton
              className={`w-full border border-marketing-charcoal/15 bg-white/55 px-7 py-3.5 text-base font-medium text-marketing-charcoal sm:w-auto ${typo.secondarySans}`}
            >
              Explore Altitutor UCAT{" "}
              <ArrowDown className="h-4 w-4" aria-hidden />
            </MagneticButton>
          </a>
        </div>

        <div
          data-hero-support
          className={`mt-9 flex flex-col items-center justify-center gap-2 ${MARKETING_SUPPORTING_TEXT_CLASS} sm:flex-row sm:gap-5 ${typo.secondarySans}`}
        >
          <p className="flex items-center gap-2">
            <HeartHandshake
              className="h-4 w-4 text-marketing-primary"
              aria-hidden
            />
            A not-for-profit initiative by Altitutor.
          </p>
        </div>
      </div>
    </section>
  );
}
