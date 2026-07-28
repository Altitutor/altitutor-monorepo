"use client";

import { useEffect, useRef } from "react";
import { MARKETING_TOKENS } from "@altitutor/shared";
import { Check } from "lucide-react";
import { UCAT_FEATURES } from "./ucat-feature-data";
import { UcatFeatureDetailDialog } from "./ucat-feature-detail-dialog";
import { UcatFeatureCardPreview } from "./ucat-feature-micro-ui";
import { UcatMobileAppPhonePreview } from "./ucat-mobile-app-phone-preview";
import { UcatPracticeDiscountPreview } from "./ucat-practice-discount-preview";
import { UCAT_SECTION_EYEBROW_CLASS, UCAT_SECTION_PADDING_CLASS } from "./ucat-landing-section-eyebrow";

const { typography: typo } = MARKETING_TOKENS;

type LandingStat =
  | { kind: "count"; end: number; suffix: string; label: string }
  | { kind: "text"; value: string; label: string };

const LANDING_STATS: LandingStat[] = [
  { kind: "count", end: 10000, suffix: "+", label: "practice questions" },
  { kind: "count", end: 30, suffix: "+", label: "full UCAT mocks" },
  { kind: "text", value: "Free forever", label: "with allowances that reset" },
];

function UcatLandingStat({ stat }: { stat: LandingStat }) {
  const valueRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const valueEl = valueRef.current;
    if (!valueEl) return;

    if (stat.kind === "text") {
      valueEl.textContent = stat.value;
      return;
    }

    let cancelled = false;
    let context: { revert: () => void } | undefined;
    void Promise.all([import("gsap"), import("gsap/ScrollTrigger")]).then(
      ([gsapModule, scrollTriggerModule]) => {
        const gsap = gsapModule.default;
        if (cancelled) return;
        gsap.registerPlugin(scrollTriggerModule.ScrollTrigger);
        if (!valueRef.current) return;

        const counter = { value: 0 };
        const reducedMotion = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches;

        if (reducedMotion) {
          valueEl.textContent = `${stat.end.toLocaleString("en-US")}${stat.suffix}`;
          return;
        }

        context = gsap.context(() => {
          gsap.to(counter, {
            value: stat.end,
            duration: 1.8,
            ease: "power2.out",
            scrollTrigger: {
              trigger: valueEl,
              start: "top 88%",
              once: true,
            },
            onUpdate: () => {
              valueEl.textContent = `${Math.round(counter.value).toLocaleString("en-US")}${stat.suffix}`;
            },
          });
        }, valueEl);
      },
    );

    return () => {
      cancelled = true;
      context?.revert();
    };
  }, [stat]);

  return (
    <div className="px-4 py-2 text-center">
      <p
        ref={valueRef}
        className={`text-2xl font-bold text-marketing-primary sm:text-3xl ${typo.headingSans}`}
      >
        {stat.kind === "text" ? stat.value : `0${stat.suffix}`}
      </p>
      <p className={`mt-1 text-sm text-marketing-charcoal/55 ${typo.secondarySans}`}>
        {stat.label}
      </p>
    </div>
  );
}

export function UcatLandingProtocol() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let cancelled = false;
    let context: { revert: () => void } | undefined;
    void Promise.all([import("gsap"), import("gsap/ScrollTrigger")]).then(
      ([gsapModule, scrollTriggerModule]) => {
        const gsap = gsapModule.default;
        if (cancelled) return;
        gsap.registerPlugin(scrollTriggerModule.ScrollTrigger);
        if (!sectionRef.current) return;
        context = gsap.context(() => {
          if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
          gsap.utils.toArray<HTMLElement>("[data-feature-card]").forEach((card) => {
            gsap.from(card, {
              opacity: 0,
              y: 48,
              duration: 0.75,
              ease: "power3.out",
              scrollTrigger: { trigger: card, start: "top 85%", once: true },
            });
          });
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
      id="features"
      className={`bg-white ${UCAT_SECTION_PADDING_CLASS}`}
    >
      <div className="mx-auto min-w-0 max-w-7xl">
        <div className="grid gap-8 sm:grid-cols-3 sm:gap-4">
          {LANDING_STATS.map((stat) => (
            <UcatLandingStat
              key={stat.kind === "text" ? stat.value : `${stat.end}${stat.suffix}`}
              stat={stat}
            />
          ))}
        </div>

        <div className="mx-auto max-w-3xl text-center">
          <p
            className={`mt-24 ${UCAT_SECTION_EYEBROW_CLASS} ${typo.dataMono}`}
          >
            Features
          </p>
          <h2
            className={`mt-4 text-4xl font-semibold tracking-[-0.04em] text-marketing-charcoal sm:text-6xl ${typo.headingSans}`}
          >
            Everything you need to prepare.
          </h2>
          <p
            className={`mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-marketing-charcoal/58 sm:text-xl ${typo.secondarySans}`}
          >
            From learning modules to full timed mock exams, get what you need at every stage of your preparation.
          </p>
        </div>

        <div className="mt-16 grid min-w-0 gap-5 sm:mt-20 lg:grid-cols-2">
          {UCAT_FEATURES.map((feature) => {
            const Icon = feature.icon;

            return (
              <article
                key={feature.slug}
                data-feature-card
                className="flex min-w-0 flex-col overflow-hidden rounded-[2rem] bg-[#f4f5f7] p-6 sm:p-8"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={`flex size-8 shrink-0 items-center justify-center rounded-full ${feature.theme.iconBg}`}
                  >
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <p
                    className={`text-base font-semibold text-marketing-primary ${typo.secondarySans}`}
                  >
                    {feature.eyebrow}
                  </p>
                </div>

                <h3
                  className={`mt-5 text-2xl font-semibold tracking-[-0.03em] text-marketing-charcoal sm:text-[1.65rem] ${typo.headingSans}`}
                >
                  {feature.cardHeadline}
                </h3>

                <ul
                  className={`mt-5 space-y-2.5 text-base text-marketing-charcoal/66 ${typo.secondarySans}`}
                >
                  {feature.points.map((point) => (
                    <li key={point} className="flex items-start gap-3">
                      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-marketing-primary/10 text-marketing-primary">
                        <Check className="size-3" aria-hidden />
                      </span>
                      {point}
                    </li>
                  ))}
                </ul>

                <div className="mt-6">
                  <UcatFeatureDetailDialog feature={feature} />
                </div>

                <div
                  className={
                    feature.cardPreviewBleed
                      ? "mt-6 -mx-6 -mb-6 min-w-0 flex-1 overflow-hidden rounded-b-[2rem] sm:-mx-8 sm:-mb-8"
                      : "mt-6 min-w-0 flex-1 overflow-hidden"
                  }
                >
                  <UcatFeatureCardPreview id={feature.cardPreviewId} />
                </div>
              </article>
            );
          })}
        </div>

        <div className="mt-5 grid min-w-0 gap-5 lg:grid-cols-2">
          <article
            data-feature-card
            className="flex min-w-0 flex-row items-center gap-4 rounded-[2rem] bg-[#f4f5f7] p-6 sm:gap-6 sm:p-8"
          >
            <div className="min-w-0 flex-1">
              <h3
                className={`text-xl font-semibold tracking-[-0.03em] text-marketing-charcoal sm:text-2xl ${typo.headingSans}`}
              >
                Practice day discounts
              </h3>
              <p
                className={`mt-3 text-base leading-relaxed text-marketing-charcoal/66 ${typo.secondarySans}`}
              >
                Earn a discount for every day you log in and practice.
              </p>
            </div>
            <div className="w-[9rem] shrink-0 sm:w-[11rem]">
              <UcatPracticeDiscountPreview />
            </div>
          </article>

          <article
            data-feature-card
            className="relative flex min-w-0 flex-row items-stretch gap-4 overflow-hidden rounded-[2rem] bg-[#f4f5f7] p-6 sm:gap-6 sm:p-8"
          >
            <div className="relative z-10 min-w-0 flex-1">
              <p
                className={`inline-flex rounded-full bg-marketing-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-marketing-primary ${typo.dataMono}`}
              >
                Coming soon
              </p>
              <h3
                className={`mt-2 text-xl font-semibold tracking-[-0.03em] text-marketing-charcoal sm:text-2xl ${typo.headingSans}`}
              >
                Practice on the go
              </h3>
              <p
                className={`mt-3 text-base leading-relaxed text-marketing-charcoal/66 ${typo.secondarySans}`}
              >
                Continue your plan, practice, and review from the Altitutor UCAT
                app. Coming soon.
              </p>
            </div>
            <div className="relative w-[9rem] shrink-0 self-stretch sm:w-[12rem]">
              <div className="pointer-events-none absolute inset-x-0 -bottom-6 top-0 overflow-hidden sm:-bottom-8">
                <UcatMobileAppPhonePreview compact bleed />
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
