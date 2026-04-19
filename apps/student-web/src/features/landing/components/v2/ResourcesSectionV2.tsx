"use client";

import React, { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { TOKENS, MagneticButton } from "./shared";
import Image from "next/image";
import { images } from "../../constants/images";
import { ArrowRight } from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

export function ResourcesSectionV2() {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<(HTMLDivElement | null)[]>([]);

  const resourceData = [
    {
      title: "Study notes",
      desc: "Written to be concise and easy to understand, comprehensively covering every part of the content with active recall features.",
      img: images.studyNotesScreenshot,
      num: "01",
      bg: "bg-white text-[#1A1A1A]",
      accent: "#0a2941",
    },
    {
      title: "Video lessons",
      desc: "Learn through each subtopic with concise explanations and exam-appropriate example questions.",
      img: null,
      num: "02",
      bg: "bg-[#0a2941] text-[#F2F0E9]",
      accent: "#92b9c6",
    },
    {
      title: "Question board",
      desc: "Get an answer from a tutor at any time of the day to help solving exact worksheets and practicals.",
      img: images.questionBoardPhone,
      num: "03",
      bg: "bg-[#1A1A1A] text-[#F2F0E9]",
      accent: "#CC5833",
    },
    {
      title: "Practice questions",
      desc: "Designed to help you master each topic with detailed worked solutions for every question.",
      img: images.practiceQuestions,
      num: "04",
      bg: "bg-[#92b9c6] text-[#1A1A1A]",
      accent: "#1A1A1A",
    },
    {
      title: "Assignments",
      desc: "Navigate assignments confidently with our guides and A+ exemplars from successful past students.",
      img: images.cheatSheet,
      num: "05",
      bg: "bg-white text-[#1A1A1A]",
      accent: "#0a2941",
    },
    {
      title: "Simulated Exams",
      desc: "Full-length mock exams perfectly mirroring the real school tests to prep for ultimate pressure.",
      img: images.examInterface,
      num: "06",
      bg: "bg-[#1A1A1A] text-[#F2F0E9]",
      accent: "#92b9c6",
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
            start: "top 65%", // start fading when next card is 35% in view
            end: "top top+=10%", // finish when next card pins
            scrub: true,
          },
          scale: 0.9,
          filter: "blur(20px)",
          opacity: 0.5,
          ease: "none"
        });
      });
    }, containerRef);
    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={containerRef}
      id="resources"
      className="relative w-full bg-[#F2F0E9] py-32 px-4 md:px-8 pb-[40vh] z-10"
    >
      <div className="mx-auto max-w-5xl mb-32 text-center text-[#1A1A1A] relative z-20">
        <h2
          className={`text-4xl md:text-6xl font-bold tracking-tight ${TOKENS.typography.headingSans}`}
        >
          All The Resources You Need
        </h2>
        <p
          className={`mt-4 text-xl text-[#1A1A1A]/60 ${TOKENS.typography.secondarySans}`}
        >
          Our extensive library encompasses all aspects of your course.
        </p>
      </div>

      <div className="relative mx-auto w-full max-w-5xl">
        {resourceData.map((res, i) => (
          <div
            key={i}
            ref={(el) => {
              cardsRef.current[i] = el;
            }}
            className={`sticky top-[10vh] flex min-h-[500px] w-full flex-col md:flex-row items-center justify-between p-10 md:p-16 mb-[30vh] shadow-xl border border-black/5 rounded-[3rem] origin-top ${res.bg}`}
          >
            <div className="relative z-10 w-full md:w-1/2">
              <span
                className={`block text-2xl font-semibold opacity-50 mb-4 ${TOKENS.typography.dataMono}`}
              >
                {res.num}
              </span>
              <h3
                className={`text-4xl md:text-6xl font-bold tracking-tighter mb-8 ${TOKENS.typography.headingSans}`}
              >
                {res.title}
              </h3>
              <p
                className={`text-lg md:text-xl leading-relaxed opacity-90 ${TOKENS.typography.secondarySans}`}
              >
                {res.desc}
              </p>
            </div>
            
            <div className="relative z-10 w-full md:w-5/12 mt-10 md:mt-0 flex justify-center">
              {res.img ? (
                <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-black/5 aspect-[4/5] w-full max-w-sm">
                  <Image
                    src={res.img.src}
                    alt={res.title}
                    fill
                    className="object-cover object-top"
                  />
                </div>
              ) : (
                <div className="relative rounded-2xl overflow-hidden border border-white/10 aspect-[4/5] w-full max-w-sm flex items-center justify-center opacity-30">
                  <svg width="200" height="200" viewBox="0 0 100 100" className="animate-[spin_20s_linear_infinite]">
                     <circle cx="50" cy="50" r="40" fill="none" stroke={res.accent} strokeWidth="2" strokeDasharray="4 4" />
                     <path d="M50 15 L50 85 M15 50 L85 50" stroke={res.accent} strokeWidth="1" />
                  </svg>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      
      <div className="mx-auto max-w-7xl mt-16 flex justify-center">
        <MagneticButton className="bg-[#0a2941] px-10 py-5 text-[#F2F0E9] font-semibold text-lg hover:shadow-xl shadow-[#0a2941]/20 group">
          Explore Trial <ArrowRight className="h-5 w-5 ml-2 transition-transform group-hover:translate-x-1" />
        </MagneticButton>
      </div>
    </section>
  );
}
