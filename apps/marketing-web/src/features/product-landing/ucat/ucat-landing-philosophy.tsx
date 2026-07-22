import { MARKETING_TOKENS } from "@altitutor/shared";
import { ArrowRight, RefreshCw } from "lucide-react";
import { AnalyticsLink } from "../analytics-link";
import { PRODUCT_LINKS } from "@/lib/site";
import { MagneticButton } from "./magnetic-button";

const { typography: typo } = MARKETING_TOKENS;

export function UcatLandingPhilosophy() {
  return (
    <section
      id="free-forever"
      className="bg-marketing-cream px-4 py-24 sm:px-8 sm:py-32"
    >
      <div className="mx-auto grid max-w-7xl overflow-hidden rounded-[2.5rem] bg-marketing-primary text-marketing-cream shadow-2xl lg:grid-cols-[1fr_0.82fr]">
        <div className="p-8 sm:p-12 lg:p-16">
          <p
            className={`text-xs font-semibold uppercase tracking-[0.18em] text-marketing-accent ${typo.dataMono}`}
          >
            Altitutor UCAT Free
          </p>
          <h2
            className={`mt-4 text-4xl font-semibold tracking-[-0.035em] sm:text-5xl ${typo.headingSans}`}
          >
            Start free. Stay free for as long as you need.
          </h2>
          <p
            className={`mt-6 max-w-2xl text-base leading-relaxed text-white/70 sm:text-lg ${typo.secondarySans}`}
          >
            This is not a short trial or a handful of questions that disappear
            once you have used them. Your free practice allowances reset, giving
            you an ongoing way to learn, practise, and measure your progress.
          </p>
          <AnalyticsLink
            href={PRODUCT_LINKS.ucatSignup}
            analytics={{
              product: "ucat",
              placement: "free_forever",
              action: "start_free",
            }}
            className="mt-8 inline-block"
          >
            <MagneticButton className="bg-marketing-accent px-7 py-3.5 text-base font-semibold text-marketing-charcoal">
              Start with Free <ArrowRight className="h-4 w-4" aria-hidden />
            </MagneticButton>
          </AnalyticsLink>
        </div>
        <div className="relative flex min-h-72 items-center justify-center overflow-hidden border-t border-white/10 bg-marketing-charcoal/35 p-8 lg:border-l lg:border-t-0">
          <div className="absolute h-60 w-60 rounded-full border border-marketing-accent/15" />
          <div className="absolute h-44 w-44 rounded-full border border-marketing-accent/25" />
          <div className="relative flex h-32 w-32 flex-col items-center justify-center rounded-full bg-marketing-accent text-center text-marketing-charcoal shadow-[0_24px_70px_rgba(0,0,0,0.25)]">
            <RefreshCw className="h-6 w-6" aria-hidden />
            <span className={`mt-2 text-sm font-bold ${typo.headingSans}`}>
              Allowances reset
            </span>
            <span
              className={`mt-1 text-[10px] uppercase tracking-wider opacity-60 ${typo.dataMono}`}
            >
              Keep going
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
