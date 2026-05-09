"use client";

import React, { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ArrowRight } from "lucide-react";
import { TOKENS, MagneticButton } from "./shared";
import Link from "next/link";
import Image from "next/image";

export function HeroSectionV2() {
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
      className="relative z-30 flex min-h-[100dvh] w-full flex-col overflow-hidden rounded-b-[3rem] bg-[#1A1A1A] shadow-[0_24px_60px_rgba(0,0,0,0.45)]"
    >
      {/* Background Image & Gradient */}
      <div className="absolute inset-0 z-0 opacity-70">
        {/* Using original V1 hero background image */}
        <Image
          src="/images/landing/background-alt-scaled.jpg"
          alt="Altitutor Students"
          fill
          priority
          sizes="100vw"
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a2941] via-[#0a2941]/60 to-[#0a2941]/10" />
      </div>

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
                className={`hero-text text-lg font-bold uppercase tracking-[0.2em] text-[#92b9c6] sm:text-xl md:text-2xl ${TOKENS.typography.headingSans}`}
              >
                Altitutor Student Portal
              </span>
              <span
                className={`hero-text text-3xl font-semibold tracking-tight text-[#F2F0E9] sm:text-4xl md:text-6xl ${TOKENS.typography.headingSans}`}
              >
                A learning system which
              </span>
              <span
                className={`hero-text mt-2 text-[clamp(2.75rem,12vw,8rem)] italic leading-[0.95] text-[#F2F0E9] sm:mt-4 sm:leading-[0.9] ${TOKENS.typography.dramaSerif}`}
              >
                Moves with you.
              </span>
            </h1>
            <p
              className={`hero-text mt-5 max-w-xl text-base text-[#F2F0E9]/80 sm:mt-8 sm:text-lg md:text-xl ${TOKENS.typography.secondarySans}`}
            >
              A seamless blend of personalised learning, expert support, and
              cutting-edge resources designed to propel you towards academic
              success.
            </p>
            <div className="hero-text mt-6 flex flex-col gap-3 sm:mt-10 sm:flex-row sm:flex-wrap sm:gap-4">
              <Link href="/login" className="w-full sm:w-auto">
                <MagneticButton className="w-full bg-[#92b9c6] px-6 py-3 text-base font-medium tracking-wide text-[#1A1A1A] shadow-lg shadow-[#92b9c6]/20 sm:w-auto sm:px-8 sm:py-4 sm:text-lg">
                  Log in to Portal <ArrowRight className="h-5 w-5" />
                </MagneticButton>
              </Link>
              <Link href="#ecosystem" className="w-full sm:w-auto">
                <MagneticButton className="w-full border border-[#F2F0E9]/30 bg-transparent px-6 py-3 text-base font-medium tracking-wide text-[#F2F0E9] hover:bg-[#F2F0E9]/10 sm:w-auto sm:px-8 sm:py-4 sm:text-lg">
                  Get Started <ArrowRight className="h-5 w-5" />
                </MagneticButton>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
