"use client";

import React, { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { TOKENS, MagneticButton } from "./shared";
import Image from "next/image";
import { images } from "../../constants/images";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

gsap.registerPlugin(ScrollTrigger);

export function ResourcesSectionV2() {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<(HTMLDivElement | null)[]>([]);

  const resourceData = [
    {
      title: "Study notes",
      desc: "Our study notes save time learning material so we can spend more time doing practice tests.",
      img: images.studyNotesScreenshot,
      num: "01",
      bg: "bg-white text-[#1A1A1A]",
      accent: "#0a2941",
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
              className="text-[#0a2941]"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
            <path
              d="M50 10 L50 90 M10 50 L90 50 M21.7 21.7 L78.3 78.3 M21.7 78.3 L78.3 21.7"
              stroke="currentColor"
              className="text-[#92b9c6]"
              strokeWidth="0.5"
            />
          </svg>
        </div>
      ),
    },
    {
      title: "Video lessons",
      desc: "Our video lessons are the perfect companion for our notes, teaching you through each subtopic of the course with concise explanations, visual explanations, exam-appropiate example questions, and step by step calculator instructions.",
      img: null,
      num: "02",
      bg: "bg-[#0a2941] text-[#F2F0E9]",
      accent: "#92b9c6",
      visual: (
        <div className="absolute right-10 top-1/2 hidden -translate-y-1/2 opacity-30 md:block">
          <svg width="300" height="300" viewBox="0 0 200 200">
            <circle
              cx="100"
              cy="100"
              r="80"
              fill="none"
              stroke="currentColor"
              className="text-[#F2F0E9] animate-[spin_30s_linear_infinite_reverse]"
              strokeWidth="2"
              strokeDasharray="10 10"
            />
            <circle
              cx="100"
              cy="100"
              r="40"
              fill="none"
              stroke="currentColor"
              className="text-[#92b9c6] animate-ping"
              strokeWidth="4"
              style={{ animationDuration: "3s" }}
            />
            <path
              d="M100 20 L100 180 M20 100 L180 100 M43 43 L157 157 M43 157 L157 43"
              stroke="currentColor"
              className="text-[#F2F0E9] opacity-50"
              strokeWidth="1"
            />
          </svg>
        </div>
      ),
    },
    {
      title: "Question board",
      desc: "Need help while you’re at home? Post your questions on the question board to get a response from a tutor, at any time of the day. Use our question board to ask for help solving maths questions, answer explanations, or for advice on practicals / SHE tasks.",
      img: images.questionBoardPhone,
      num: "03",
      bg: "bg-[#1A1A1A] text-[#F2F0E9]",
      accent: "#CC5833",
      visual: (
        <div className="absolute right-10 top-1/2 hidden -translate-y-1/2 opacity-20 md:block">
          <div className="grid h-[200px] w-[200px] grid-cols-5 gap-2">
            {[...Array(25)].map((_, cellIndex) => (
              <div
                key={`res-grid-${cellIndex}`}
                className="animate-pulse rounded-sm bg-[#92b9c6] opacity-50"
                style={{ animationDelay: `${cellIndex * 0.1}s` }}
              />
            ))}
          </div>
        </div>
      ),
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
    const ctx = gsap.context(() => {
      const cards = cardsRef.current.filter(
        (card): card is HTMLDivElement => card !== null
      );

      gsap.set(cards, { transformOrigin: "top center" });

      cards.forEach((card, i) => {
        if (!card) return;
        if (i === cards.length - 1) return;

        gsap.to(card, {
          scrollTrigger: {
            trigger: cards[i + 1],
            start: "top 65%",
            end: "top top+=10%",
            scrub: true,
            invalidateOnRefresh: true,
          },
          scale: 0.9,
          filter: "blur(20px)",
          opacity: 0.5,
          ease: "none",
        });
      });
    }, containerRef);

    // Ensure trigger math uses final layout after image sizing settles.
    const refreshTimer = window.setTimeout(() => {
      ScrollTrigger.refresh();
    }, 100);

    return () => {
      window.clearTimeout(refreshTimer);
      ctx.revert();
    };
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
          Our extensive resource library encompasses all aspects of your course, providing everything needed to excel in tests, assignments, and exams. And if you find you need any other materials for your subject, reach out and we’ll create them for you.
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
            {res.visual}
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
        <Link href="/booking/trial-session">
          <MagneticButton className="bg-[#0a2941] px-10 py-5 text-[#F2F0E9] font-semibold text-lg hover:shadow-xl shadow-[#0a2941]/20 group">
            Book Trial <ArrowRight className="h-5 w-5 ml-2 transition-transform group-hover:translate-x-1" />
          </MagneticButton>
        </Link>
      </div>
    </section>
  );
}
