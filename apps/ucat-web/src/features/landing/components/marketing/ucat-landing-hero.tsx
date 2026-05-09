"use client";

import { MARKETING_TOKENS } from "@altitutor/shared";
import { gsap } from "gsap";
import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { MagneticButton } from "./magnetic-button";
import { getTrialBookingUrl } from "../../lib/trial-booking-url";

const { typography: typo } = MARKETING_TOKENS;

export function UcatLandingHero() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(".hero-text", {
        y: 40,
        opacity: 0,
        duration: 1.2,
        stagger: 0.08,
        ease: "power3.out",
        delay: 0.2,
      });
    }, containerRef);
    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={containerRef}
      className="relative flex min-h-[100dvh] w-full flex-col overflow-hidden rounded-b-[3rem] bg-marketing-charcoal"
    >
      <div className="absolute inset-0 z-0 opacity-40 mix-blend-luminosity">
        <Image
          src="https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?ixlib=rb-4.0.3&auto=format&fit=crop&w=2850&q=80"
          alt="Biological research"
          fill
          className="object-cover"
          sizes="100vw"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-marketing-primary via-marketing-primary/80 to-transparent" />
      </div>

      {/* Reserve space under fixed nav (top-6 + h-16); scroll when content exceeds short viewports */}
      <div className="relative z-10 flex min-h-[100dvh] w-full flex-col">
        <div
          className="pointer-events-none shrink-0"
          style={{
            height:
              "calc(6.25rem + env(safe-area-inset-top, 0px))",
          }}
          aria-hidden
        />
        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [scrollbar-gutter:stable]">
          <div
            className="mx-auto flex w-full max-w-7xl min-h-[calc(100dvh-6.25rem-env(safe-area-inset-top,0px))] flex-col justify-end px-4 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] sm:px-8 sm:pb-10 md:pb-16 lg:pb-24"
          >
            <h1 className="flex flex-col gap-1 text-left sm:gap-2">
              <span
                className={`hero-text text-lg font-bold uppercase tracking-[0.2em] text-marketing-accent sm:text-xl md:text-2xl ${typo.headingSans}`}
              >
                Alti UCAT Prep
              </span>
              <span
                className={`hero-text text-3xl font-semibold tracking-tight text-marketing-cream sm:text-4xl md:text-6xl ${typo.headingSans}`}
              >
                Precision preparation is the
              </span>
              <span
                className={`hero-text mt-2 text-[clamp(2.75rem,12vw,8rem)] italic leading-[0.95] text-marketing-cream sm:mt-4 sm:leading-[0.9] ${typo.dramaSerif}`}
              >
                Unfair Advantage.
              </span>
            </h1>
            <p
              className={`hero-text mt-5 max-w-xl text-base text-marketing-cream/80 sm:mt-8 sm:text-lg md:text-xl ${typo.secondarySans}`}
            >
              A science-backed practice system powered by adaptive data. From
              zero knowledge to confident mastery.
            </p>
            <div className="hero-text mt-6 flex flex-col gap-3 sm:mt-10 sm:flex-row sm:flex-wrap sm:gap-4">
              <Link href="/signup" className="w-full sm:w-auto">
                <MagneticButton className="w-full bg-marketing-accent px-6 py-3 text-base font-medium tracking-wide text-marketing-charcoal shadow-lg shadow-marketing-accent/20 sm:w-auto sm:px-8 sm:py-4 sm:text-lg">
                  Sign up for a free trial <ArrowRight className="h-5 w-5" />
                </MagneticButton>
              </Link>
              <Link href={getTrialBookingUrl()} className="w-full sm:w-auto">
                <MagneticButton className="w-full border border-marketing-cream/30 bg-transparent px-6 py-3 text-base font-medium tracking-wide text-marketing-cream hover:bg-marketing-cream/10 sm:w-auto sm:px-8 sm:py-4 sm:text-lg">
                  Sign up for in-person <ArrowRight className="h-5 w-5" />
                </MagneticButton>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
