"use client";

import { useEffect, useRef } from "react";
import { MARKETING_TOKENS } from "@altitutor/shared";
import { Check } from "lucide-react";
import { UCAT_FEATURES } from "./ucat-feature-data";
import { UcatFeatureDetailDialog } from "./ucat-feature-detail-dialog";
import { UcatFeatureCardPreview } from "./ucat-feature-micro-ui";

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
      className="bg-white px-4 py-24 sm:px-8 sm:py-32"
    >
      <div className="mx-auto max-w-7xl">
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
            className={`mt-24 text-xs font-semibold uppercase tracking-[0.18em] text-marketing-primary/60 ${typo.dataMono}`}
          >
            Features
          </p>
          <h2
            className={`mt-4 text-4xl font-semibold tracking-[-0.04em] text-marketing-charcoal sm:text-6xl ${typo.headingSans}`}
          >
            Everything you need to prepare. Connected by a clearer direction.
          </h2>
          <p
            className={`mx-auto mt-6 max-w-2xl text-base leading-relaxed text-marketing-charcoal/58 sm:text-lg ${typo.secondarySans}`}
          >
            Practice in the UCAT interface, understand every attempt, learn the
            method, and let your progress shape what you work on next.
          </p>
        </div>

        <div className="mt-16 grid gap-5 sm:mt-20 lg:grid-cols-2">
          {UCAT_FEATURES.map((feature) => {
            const Icon = feature.icon;

            return (
              <article
                key={feature.slug}
                data-feature-card
                className="flex flex-col rounded-[2rem] bg-[#f4f5f7] p-6 sm:p-8"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={`flex size-8 shrink-0 items-center justify-center rounded-full ${feature.theme.iconBg}`}
                  >
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <p
                    className={`text-sm font-semibold ${typo.secondarySans}`}
                    style={{ color: feature.theme.accent }}
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
                  className={`mt-5 space-y-2.5 text-sm text-marketing-charcoal/66 ${typo.secondarySans}`}
                >
                  {feature.points.map((point) => (
                    <li key={point} className="flex items-start gap-3">
                      <span
                        className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full"
                        style={{
                          backgroundColor: `${feature.theme.accent}18`,
                          color: feature.theme.accent,
                        }}
                      >
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
                      ? "mt-6 -mx-6 -mb-6 flex-1 overflow-hidden rounded-b-[2rem] sm:-mx-8 sm:-mb-8"
                      : "mt-6 flex-1"
                  }
                >
                  <UcatFeatureCardPreview id={feature.cardPreviewId} />
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
