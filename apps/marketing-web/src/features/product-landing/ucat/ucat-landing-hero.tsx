"use client";

import { useEffect, useRef } from "react";
import { MARKETING_TOKENS } from "@altitutor/shared";
import { ArrowDown, ArrowRight, HeartHandshake } from "lucide-react";
import { AnalyticsLink } from "../analytics-link";
import { PRODUCT_LINKS } from "@/lib/site";
import { MagneticButton } from "./magnetic-button";

const { typography: typo } = MARKETING_TOKENS;

export function UcatLandingHero() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let cancelled = false;
    let context: { revert: () => void } | undefined;

    void Promise.all([import("gsap"), import("gsap/ScrollTrigger")]).then(
      ([gsapModule]) => {
        const gsap = gsapModule.default;
        if (cancelled) return;
        if (!sectionRef.current) return;
        context = gsap.context(() => {
          const reduceMotion = window.matchMedia(
            "(prefers-reduced-motion: reduce)",
          ).matches;
          if (reduceMotion) return;
          gsap
            .timeline({ defaults: { ease: "power3.out" } })
            .from("[data-hero-eyebrow]", { opacity: 0, y: 16, duration: 0.55 })
            .from(
              "[data-hero-line]",
              { opacity: 0, y: 44, duration: 0.85, stagger: 0.1 },
              "-=0.3",
            )
            .from(
              "[data-hero-support]",
              { opacity: 0, y: 24, duration: 0.65, stagger: 0.08 },
              "-=0.45",
            );
        }, sectionRef);
      },
    );

    return () => {
      cancelled = true;
      context?.revert();
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      id="altitutor-ucat"
      className="relative flex min-h-[92dvh] items-center overflow-hidden bg-marketing-cream px-4 pb-20 pt-32 sm:px-8 sm:pb-24 sm:pt-40"
    >
      <div className="absolute left-1/2 top-0 h-80 w-[46rem] -translate-x-1/2 rounded-full bg-marketing-accent/14 blur-[110px]" />
      <div className="relative mx-auto w-full max-w-[92rem] text-center">
        <p
          data-hero-eyebrow
          className={`text-xs font-semibold uppercase tracking-[0.2em] text-marketing-primary/60 sm:text-sm ${typo.dataMono}`}
        >
          UCAT preparation from Altitutor
        </p>
        <h1
          className={`mx-auto mt-7 text-5xl font-semibold leading-[0.95] tracking-[-0.052em] text-marketing-charcoal sm:text-7xl lg:text-[clamp(4.7rem,7.1vw,7rem)] ${typo.headingSans}`}
        >
          <span data-hero-line className="block lg:whitespace-nowrap">
            Know where you stand.
          </span>
          <span
            data-hero-line
            className={`mt-2 block font-normal italic text-marketing-primary lg:whitespace-nowrap ${typo.dramaSerif}`}
          >
            Know what to do next.
          </span>
        </h1>
        <p
          data-hero-support
          className={`mx-auto mt-8 max-w-2xl text-base leading-relaxed text-marketing-charcoal/62 sm:text-lg ${typo.secondarySans}`}
        >
          Altitutor UCAT turns your practice into a score estimate, shows the
          gaps that matter, and gives you a study plan built around your target.
        </p>

        <div
          data-hero-support
          className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
        >
          <AnalyticsLink
            href={PRODUCT_LINKS.ucatSignup}
            analytics={{ product: "ucat", placement: "hero", action: "start_free" }}
            className="w-full sm:w-auto"
          >
            <MagneticButton className="w-full bg-marketing-primary px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-marketing-primary/15 sm:w-auto">
              Start preparing free <ArrowRight className="h-4 w-4" aria-hidden />
            </MagneticButton>
          </AnalyticsLink>
          <a
            href="#product"
            className={`inline-flex w-full items-center justify-center gap-2 rounded-full border border-marketing-charcoal/15 bg-white/55 px-7 py-3.5 text-base font-medium text-marketing-charcoal transition-colors hover:bg-white sm:w-auto ${typo.secondarySans}`}
          >
            Explore Altitutor UCAT <ArrowDown className="h-4 w-4" aria-hidden />
          </a>
        </div>

        <div
          data-hero-support
          className={`mt-9 flex flex-col items-center justify-center gap-2 text-sm text-marketing-charcoal/56 sm:flex-row sm:gap-5 ${typo.secondarySans}`}
        >
          <p className="flex items-center gap-2">
            <HeartHandshake className="h-4 w-4 text-marketing-primary" aria-hidden />
            A not-for-profit initiative by Altitutor.
          </p>
        </div>
      </div>
    </section>
  );
}
