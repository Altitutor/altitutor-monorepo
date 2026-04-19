"use client";

import { MARKETING_TOKENS } from "@altitutor/shared";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useEffect, useRef } from "react";

gsap.registerPlugin(ScrollTrigger);

const { typography: typo } = MARKETING_TOKENS;

const ACCENT_CLASS = "stroke-marketing-accent";
const CREAM_CLASS = "stroke-marketing-cream";

export function UcatLandingProtocol() {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<(HTMLDivElement | null)[]>([]);

  const steps = [
    {
      title: "Benchmark",
      desc: "Take an initial full-length diagnostic. We map your starting capabilities across all 5 subtests and establish a baseline data profile.",
      num: "01",
      visual: (
        <div className="absolute right-10 top-1/2 hidden -translate-y-1/2 opacity-20 md:block">
          <svg
            width="300"
            height="300"
            viewBox="0 0 100 100"
            className="animate-[spin_20s_linear_infinite]"
          >
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke="currentColor"
              className={ACCENT_CLASS}
              strokeWidth="1"
              strokeDasharray="4 4"
            />
            <path
              d="M50 10 L50 90 M10 50 L90 50 M21.7 21.7 L78.3 78.3 M21.7 78.3 L78.3 21.7"
              stroke="currentColor"
              className={ACCENT_CLASS}
              strokeWidth="0.5"
            />
          </svg>
        </div>
      ),
    },
    {
      title: "Adapt",
      desc: "Our engine targets structural weaknesses, automatically feeding you high-yield practice modules where you have the highest ROI for score improvement.",
      num: "02",
      visual: (
        <div className="absolute right-10 top-1/2 hidden -translate-y-1/2 opacity-30 md:block">
          <svg width="300" height="300" viewBox="0 0 200 200">
            <circle
              cx="100"
              cy="100"
              r="80"
              fill="none"
              stroke="currentColor"
              className={`${CREAM_CLASS} animate-[spin_30s_linear_infinite_reverse]`}
              strokeWidth="2"
              strokeDasharray="10 10"
            />
            <circle
              cx="100"
              cy="100"
              r="40"
              fill="none"
              stroke="currentColor"
              className={`${ACCENT_CLASS} animate-ping`}
              strokeWidth="4"
              style={{ animationDuration: "3s" }}
            />
            <path
              d="M100 20 L100 180 M20 100 L180 100 M43 43 L157 157 M43 157 L157 43"
              stroke="currentColor"
              className={`${CREAM_CLASS} opacity-50`}
              strokeWidth="1"
            />
          </svg>
        </div>
      ),
    },
    {
      title: "Execute",
      desc: "Simulate test day with pixel-perfect mock exams. We replicate the exact interface, timing, and pressure of the official Pearson VUE system.",
      num: "03",
      visual: (
        <div className="absolute right-10 top-1/2 hidden -translate-y-1/2 opacity-20 md:block">
          <div className="grid h-[200px] w-[200px] grid-cols-5 gap-2">
            {[...Array(25)].map((_, i) => (
              <div
                key={i}
                className="animate-pulse rounded-sm bg-marketing-charcoal opacity-50"
                style={{ animationDelay: `${i * 0.1}s` }}
              />
            ))}
          </div>
        </div>
      ),
    },
  ];

  useEffect(() => {
    const ctx = gsap.context(() => {
      cardsRef.current.forEach((card, i) => {
        if (!card) return;
        if (i === cardsRef.current.length - 1) return;

        gsap.to(card, {
          scrollTrigger: {
            trigger: cardsRef.current[i + 1],
            start: "top 65%",
            end: "top top+=10%",
            scrub: true,
          },
          scale: 0.9,
          filter: "blur(20px)",
          opacity: 0.5,
          ease: "none",
        });
      });
    }, containerRef);
    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={containerRef}
      id="methodology"
      className="relative w-full bg-marketing-cream px-4 py-32 pb-[40vh] md:px-8"
    >
      <div className="relative z-20 mx-auto mb-32 max-w-5xl text-center text-marketing-charcoal">
        <h2
          className={`text-4xl font-bold tracking-tight md:text-6xl ${typo.headingSans}`}
        >
          The Protocol
        </h2>
        <p className={`mt-4 text-xl text-marketing-charcoal/60 ${typo.secondarySans}`}>
          A deterministic pathway to the 99th percentile.
        </p>
      </div>

      <div className="relative mx-auto w-full max-w-5xl">
        {steps.map((step, i) => (
          <div
            key={step.num}
            ref={(el) => {
              cardsRef.current[i] = el;
            }}
            className={`sticky top-[10vh] mb-[30vh] flex min-h-[500px] w-full origin-top flex-col justify-center rounded-[3rem] border border-black/5 p-10 shadow-xl md:p-16 ${
              i === 0
                ? "bg-white text-marketing-charcoal"
                : i === 1
                  ? "bg-marketing-primary text-marketing-cream"
                  : "bg-marketing-charcoal text-marketing-cream"
            }`}
          >
            <div className="relative z-10 w-full md:w-2/3">
              <span
                className={`mb-4 block text-2xl font-semibold opacity-50 ${typo.dataMono}`}
              >
                {step.num}
              </span>
              <h3
                className={`mb-8 text-5xl font-bold tracking-tighter md:text-7xl ${typo.headingSans}`}
              >
                {step.title}
              </h3>
              <p
                className={`text-xl leading-relaxed opacity-90 md:text-2xl ${typo.secondarySans}`}
              >
                {step.desc}
              </p>
            </div>
            {step.visual}
          </div>
        ))}
      </div>
    </section>
  );
}
