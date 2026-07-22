"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { MARKETING_TOKENS } from "@altitutor/shared";
import { ArrowRight, Check } from "lucide-react";
import { UCAT_FEATURES } from "./ucat-feature-data";
import { UcatFeaturePreview } from "./ucat-feature-preview";

const { typography: typo } = MARKETING_TOKENS;

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
          gsap.utils.toArray<HTMLElement>("[data-feature-row]").forEach((row) => {
            gsap.from(row, {
              opacity: 0,
              y: 70,
              duration: 0.85,
              ease: "power3.out",
              scrollTrigger: { trigger: row, start: "top 82%", once: true },
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
        <div className="grid overflow-hidden rounded-[2rem] border border-marketing-charcoal/10 bg-marketing-cream shadow-sm sm:grid-cols-3">
          {[
            ["10,000+", "practice questions"],
            ["30+", "full UCAT mocks"],
            ["Free forever", "with allowances that reset"],
          ].map(([value, label], index) => (
            <div
              key={value}
              className={`px-6 py-7 text-center ${index > 0 ? "border-t border-marketing-charcoal/10 sm:border-l sm:border-t-0" : ""}`}
            >
              <p className={`text-2xl font-bold text-marketing-primary sm:text-3xl ${typo.headingSans}`}>{value}</p>
              <p className={`mt-1 text-sm text-marketing-charcoal/55 ${typo.secondarySans}`}>{label}</p>
            </div>
          ))}
        </div>

        <div className="mx-auto max-w-3xl text-center">
          <p className={`mt-24 text-xs font-semibold uppercase tracking-[0.18em] text-marketing-primary/60 ${typo.dataMono}`}>
            Features
          </p>
          <h2 className={`mt-4 text-4xl font-semibold tracking-[-0.04em] text-marketing-charcoal sm:text-6xl ${typo.headingSans}`}>
            Everything you need to prepare. Connected by a clearer direction.
          </h2>
          <p className={`mx-auto mt-6 max-w-2xl text-base leading-relaxed text-marketing-charcoal/58 sm:text-lg ${typo.secondarySans}`}>
            Practise in the UCAT interface, understand every attempt, learn the
            method, and let your progress shape what you work on next.
          </p>
        </div>

        <div className="mt-24 space-y-28 sm:space-y-36">
          {UCAT_FEATURES.map((feature, index) => (
            <article
              key={feature.slug}
              data-feature-row
              className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16"
            >
              <div className={index % 2 ? "lg:order-2" : ""}>
                <p className={`text-xs font-semibold uppercase tracking-[0.17em] text-marketing-primary/55 ${typo.dataMono}`}>
                  {feature.number} · {feature.eyebrow}
                </p>
                <h3 className={`mt-4 text-3xl font-semibold tracking-[-0.035em] text-marketing-charcoal sm:text-4xl ${typo.headingSans}`}>
                  {feature.title}
                </h3>
                <p className={`mt-5 text-base leading-relaxed text-marketing-charcoal/61 ${typo.secondarySans}`}>
                  {feature.body}
                </p>
                <ul className={`mt-6 space-y-3 text-sm text-marketing-charcoal/66 ${typo.secondarySans}`}>
                  {feature.points.map((point) => (
                    <li key={point} className="flex items-start gap-3">
                      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-marketing-accent/28 text-marketing-primary">
                        <Check className="size-3" aria-hidden />
                      </span>
                      {point}
                    </li>
                  ))}
                </ul>
                <Link
                  href={`/ucat/features/${feature.slug}/`}
                  className={`mt-7 inline-flex items-center gap-2 text-sm font-semibold text-marketing-primary hover:underline ${typo.secondarySans}`}
                >
                  Learn more <ArrowRight className="size-4" aria-hidden />
                </Link>
              </div>
              <div className={index % 2 ? "lg:order-1" : ""}>
                <UcatFeaturePreview slug={feature.slug} />
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
