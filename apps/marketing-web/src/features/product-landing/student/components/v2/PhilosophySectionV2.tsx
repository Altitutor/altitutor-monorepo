"use client";

import React, { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { TOKENS } from "./shared";
import { stats } from "../../constants/stats";

gsap.registerPlugin(ScrollTrigger);

export function PhilosophySectionV2() {
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
      id="mission"
      className="relative z-20 -mt-10 flex min-h-dvh w-full flex-col justify-center overflow-hidden rounded-b-[3rem] rounded-t-none bg-[#1A1A1A] py-40 text-[#F2F0E9] shadow-2xl"
    >
      <div className="absolute inset-0 z-0 opacity-10">
        <div
          aria-hidden
          className="h-full w-full bg-cover bg-center grayscale"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1618044733300-9472054094ee?ixlib=rb-4.0.3&auto=format&fit=crop&w=2800&q=80')",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#1A1A1A] to-transparent" />
      </div>

      <div className="relative z-10 mx-auto max-w-5xl px-8 text-center">
        <p
          className={`phil-textline mb-8 text-xl tracking-wide text-[#F2F0E9]/60 md:text-2xl ${TOKENS.typography.secondarySans}`}
        >
          Most tutoring focuses on:{" "}
          <span className="text-white/80 line-through">
            static worksheets and isolated study.
          </span>
        </p>
        <h2
          className={`phil-textline mt-4 flex flex-col items-center text-4xl leading-[1.1] md:text-7xl ${TOKENS.typography.headingSans}`}
        >
          <span className="font-semibold tracking-tight">We focus on:</span>
          <span
            className={`mt-2 italic text-[#92b9c6] ${TOKENS.typography.dramaSerif}`}
          >
            immersive education
          </span>
          <span className="font-semibold tracking-tight">
            powered by supportive communities.
          </span>
        </h2>

        <p
          className={`phil-textline mx-auto mt-12 max-w-2xl text-lg text-[#F2F0E9]/70 ${TOKENS.typography.secondarySans}`}
        >
          The Altitutor community is more than study; it&apos;s a vibrant hub where academics blend with fun and friendship. Enjoy interactive competitions, rewards, and supportive sessions that make learning enjoyable.
        </p>

        {/* Legacy Statistics Grid */}
        <div className="phil-textline mt-24 grid grid-cols-1 md:grid-cols-3 gap-8 border-t border-white/10 pt-16">
          {stats.map((stat, idx) => (
            <div key={idx} className="flex flex-col items-center justify-center">
              <div className={`text-4xl md:text-5xl font-bold text-[#92b9c6] mb-2 ${TOKENS.typography.headingSans}`}>
                {stat.value}{stat.suffix}
              </div>
              <div className={`text-sm text-[#F2F0E9]/80 font-medium max-w-[250px] leading-relaxed ${TOKENS.typography.secondarySans}`}>
                {stat.description}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
