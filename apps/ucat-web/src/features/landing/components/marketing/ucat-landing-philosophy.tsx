"use client";

import { MARKETING_TOKENS } from "@altitutor/shared";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Image from "next/image";
import { useEffect, useRef } from "react";

const { typography: typo } = MARKETING_TOKENS;

gsap.registerPlugin(ScrollTrigger);

export function UcatLandingPhilosophy() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(".phil-textline", {
        scrollTrigger: {
          trigger: containerRef.current,
          start: "top 70%",
        },
        y: 30,
        opacity: 0,
        stagger: 0.2,
        duration: 1,
        ease: "power2.out",
      });
    }, containerRef);
    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={containerRef}
      className="relative z-20 -mt-10 flex min-h-dvh w-full flex-col justify-center overflow-hidden rounded-[3rem] bg-marketing-charcoal py-40 text-marketing-cream shadow-2xl"
    >
      <div className="absolute inset-0 z-0 opacity-10">
        <Image
          src="https://images.unsplash.com/photo-1618044733300-9472054094ee?ixlib=rb-4.0.3&auto=format&fit=crop&w=2800&q=80"
          alt="Organic Texture"
          fill
          className="object-cover grayscale"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-marketing-charcoal to-transparent" />
      </div>

      <div className="relative z-10 mx-auto max-w-5xl px-8 text-center">
        <p
          className={`phil-textline mb-8 text-xl tracking-wide text-marketing-cream/60 md:text-2xl ${typo.secondarySans}`}
        >
          Most UCAT prep focuses on:{" "}
          <span className="text-white/80 line-through">
            profit and static question banks.
          </span>
        </p>
        <h2
          className={`phil-textline mt-4 flex flex-col items-center text-4xl leading-[1.1] md:text-7xl ${typo.headingSans}`}
        >
          <span className="font-semibold tracking-tight">We focus on:</span>
          <span
            className={`mt-2 italic text-marketing-accent ${typo.dramaSerif}`}
          >
            accessible education
          </span>
          <span className="font-semibold tracking-tight">
            powered by adaptive data.
          </span>
        </h2>

        <p
          className={`phil-textline mx-auto mt-12 max-w-2xl text-lg text-marketing-cream/70 ${typo.secondarySans}`}
        >
          Altitutor is a non-profit. Our primary mission is to make elite
          medical entry prep accessible for everyone. Your support goes directly
          toward funding students who otherwise couldn&apos;t afford it.
        </p>
      </div>
    </section>
  );
}
