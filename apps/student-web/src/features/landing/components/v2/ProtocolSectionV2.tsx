"use client";

import React, { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { TOKENS } from "./shared";

gsap.registerPlugin(ScrollTrigger);

export function ProtocolSectionV2() {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<(HTMLDivElement | null)[]>([]);

  const steps = [
    {
      title: "Learn Content",
      desc: "Comprehensive video lessons, interactive study notes, and a 24/7 question board to master the material efficiently.",
      num: "01",
      visual: (
        <div className="absolute right-10 top-1/2 -translate-y-1/2 opacity-20 hidden md:block">
          <svg
            width="300"
            height="300"
            viewBox="0 0 100 100"
            className="animate-[spin_20s_linear_infinite]"
          >
            <circle cx="50" cy="50" r="40" fill="none" stroke="#0a2941" strokeWidth="2" strokeDasharray="4 4" />
            <polygon points="50,15 80,80 20,80" fill="none" stroke="#92b9c6" strokeWidth="1" />
            <polygon points="50,85 20,20 80,20" fill="none" stroke="#92b9c6" strokeWidth="1" />
          </svg>
        </div>
      ),
    },
    {
      title: "Master Testing",
      desc: "Full-length practice exams and tests created to be as close as possible to your school assessments with worked solutions.",
      num: "02",
      visual: (
        <div className="absolute right-10 top-1/2 -translate-y-1/2 opacity-30 hidden md:block">
          <svg width="300" height="300" viewBox="0 0 200 200">
            {/* Grid of dots */}
            <defs>
              <pattern id="dotGrid" width="20" height="20" patternUnits="userSpaceOnUse">
                <circle cx="10" cy="10" r="2" fill="#92b9c6" fillOpacity="0.4" />
              </pattern>
            </defs>
            <rect width="200" height="200" fill="url(#dotGrid)" />
            {/* Scanning Laser Line */}
            <line x1="0" y1="0" x2="200" y2="0" stroke="#92b9c6" strokeWidth="4" className="animate-[pulse_2s_ease-in-out_infinite]">
              <animate attributeName="y1" values="0;200;0" dur="4s" repeatCount="indefinite" />
              <animate attributeName="y2" values="0;200;0" dur="4s" repeatCount="indefinite" />
            </line>
          </svg>
        </div>
      ),
    },
    {
      title: "Excel in Assignments",
      desc: "Step-by-step assignment writing guides and A+ exemplars from our tutors and past students to guide your writing.",
      num: "03",
      visual: (
        <div className="absolute right-10 top-1/2 -translate-y-1/2 opacity-30 hidden md:block">
          <svg width="300" height="300" viewBox="0 0 200 200">
            {/* EKG / Waveform Style Animation */}
            <path
              d="M0 100 L 50 100 L 65 70 L 90 140 L 115 60 L 135 120 L 150 100 L 200 100"
              fill="none"
              stroke="#92b9c6"
              strokeWidth="4"
              strokeLinejoin="round"
              strokeLinecap="round"
              className="animate-[pulse_1.5s_ease-in-out_infinite]"
            >
              <animate attributeName="stroke-dasharray" values="0 400; 400 400" dur="2s" repeatCount="indefinite" />
            </path>
          </svg>
        </div>
      ),
    },
  ];

  useEffect(() => {
    // Stacking effect using GSAP scrub
    const ctx = gsap.context(() => {
      cardsRef.current.forEach((card, i) => {
        if (!card) return;
        if (i === cardsRef.current.length - 1) return; // Last card doesn't scale/blur
        
        gsap.to(card, {
          scrollTrigger: {
            trigger: cardsRef.current[i + 1],
            start: "top center", // start fading when next card is halfway up
            end: "top top+=10%", // finish when next card pins
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
      id="protocol"
      className="relative w-full bg-[#F2F0E9] py-32 px-4 md:px-8 pb-[40vh]"
    >
      <div className="mx-auto max-w-5xl mb-32 text-center text-[#1A1A1A] relative z-20">
        <h2
          className={`text-4xl md:text-6xl font-bold tracking-tight ${TOKENS.typography.headingSans}`}
        >
          Resource Protocol
        </h2>
        <p
          className={`mt-4 text-xl text-[#1A1A1A]/60 ${TOKENS.typography.secondarySans}`}
        >
          All the resources you need, structured for mastery.
        </p>
      </div>

      <div className="relative mx-auto w-full max-w-5xl">
        {steps.map((step, i) => (
          <div
            key={i}
            ref={(el) => {
              cardsRef.current[i] = el;
            }}
            className={`sticky top-[10vh] flex min-h-[500px] w-full flex-col justify-center p-10 md:p-16 mb-[30vh] shadow-xl border border-black/5 rounded-[3rem] origin-top ${
              i === 0
                ? "bg-white text-[#1A1A1A]"
                : i === 1
                  ? "bg-[#0a2941] text-[#F2F0E9]"
                  : "bg-[#1A1A1A] text-[#F2F0E9]"
            }`}
          >
            <div className="relative z-10 w-full md:w-2/3">
              <span
                className={`block text-2xl font-semibold opacity-50 mb-4 ${TOKENS.typography.dataMono}`}
              >
                {step.num}
              </span>
              <h3
                className={`text-5xl md:text-7xl font-bold tracking-tighter mb-8 ${TOKENS.typography.headingSans}`}
              >
                {step.title}
              </h3>
              <p
                className={`text-xl md:text-2xl leading-relaxed opacity-90 ${TOKENS.typography.secondarySans}`}
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
