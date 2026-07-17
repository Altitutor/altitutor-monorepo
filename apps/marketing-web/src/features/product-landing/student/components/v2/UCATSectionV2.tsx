"use client";

import React, { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { BrainCircuit, Target, Clock, Activity } from "lucide-react";
import { TOKENS } from "./shared";

// ----------------------------------------------------------------------
// CARD 1: Learning Modules (The Curriculum Sequencer)
// ----------------------------------------------------------------------
function CurriculumCard() {
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ repeat: -1 });
      const nodes = gsap.utils.toArray<HTMLElement>(".timeline-node");

      nodes.forEach((node) => {
        tl.to(node, { scale: 1.2, backgroundColor: "#92b9c6", duration: 0.3 })
          .to(node, { scale: 1, backgroundColor: "#0a2941", duration: 0.3, delay: 0.8 });
      });
    }, containerRef);
    return () => ctx.revert();
  }, []);

  return (
    <div className="relative flex h-[380px] w-full flex-col overflow-hidden rounded-[2rem] bg-[#1A1A1A] p-6 shadow-2xl ring-1 ring-white/10">
      <div className="flex flex-col gap-1 mb-6">
        <div className="flex items-center gap-2">
          <BrainCircuit className="h-5 w-5 text-[#92b9c6]" />
          <span className={`font-bold text-[#F2F0E9] tracking-wider text-sm uppercase ${TOKENS.typography.headingSans}`}>
            Learning Modules
          </span>
        </div>
        <span className={`text-xs text-[#F2F0E9]/50 ${TOKENS.typography.secondarySans}`}>
          From beginner to confident solving.
        </span>
      </div>

      <div ref={containerRef} className="flex-1 flex flex-col justify-center items-center relative">
        <div className="absolute left-1/2 top-4 bottom-4 w-1 -translate-x-1/2 bg-white/5 rounded-full" />
        
        {["Foundations", "Strategies", "Speed Drills", "Mastery"].map((step, i) => (
          <div key={i} className="relative z-10 flex w-full justify-between items-center my-3 px-4">
            <span className={`text-[10px] text-right w-1/2 pr-6 opacity-60 text-[#F2F0E9] uppercase tracking-widest ${TOKENS.typography.dataMono}`}>
              Stage 0{i+1}
            </span>
            <div className="timeline-node absolute left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-[#0a2941] border-[3px] border-[#1A1A1A] z-20" />
            <span className={`text-xs font-semibold pl-6 w-1/2 text-[#F2F0E9] ${TOKENS.typography.headingSans}`}>
              {step}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// CARD 2: Question Bank (Target Telemetry Radar)
// ----------------------------------------------------------------------
function QuestionBankCard() {
  const arcRef = useRef<SVGCircleElement>(null);
  const valRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      if (!arcRef.current) return;
      const len = arcRef.current.getTotalLength();
      gsap.set(arcRef.current, { strokeDasharray: len, strokeDashoffset: len });
      
      const tl = gsap.timeline({ repeat: -1 });
      const obj = { val: 0 };
      
      tl.to(arcRef.current, { strokeDashoffset: len * 0.2, duration: 2, ease: "power3.out" })
        .to(obj, {
          val: 87, 
          duration: 2, 
          ease: "power3.out", 
          onUpdate() {
             if (valRef.current) valRef.current.innerText = Math.round(obj.val).toString();
          }
        }, "<")
        .to(arcRef.current, { strokeDashoffset: len * 0.05, duration: 1, ease: "bounce.out", delay: 1 })
        .to(obj, {
          val: 95, 
          duration: 1, 
          ease: "bounce.out", 
          onUpdate() {
             if (valRef.current) valRef.current.innerText = Math.round(obj.val).toString();
          }
        }, "<")
        .to({}, { duration: 1.5 });

    });
    return () => ctx.revert();
  }, []);

  return (
    <div className="relative flex h-[380px] w-full flex-col overflow-hidden rounded-[2rem] bg-[#0a2941] p-6 shadow-2xl ring-1 ring-white/10">
      <div className="flex flex-col gap-1 mb-6 relative z-10">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-[#92b9c6]" />
          <span className={`font-bold text-[#F2F0E9] tracking-wider text-sm uppercase ${TOKENS.typography.headingSans}`}>
            Question Bank
          </span>
        </div>
        <span className={`text-xs text-[#F2F0E9]/70 ${TOKENS.typography.secondarySans}`}>
          Simulate timed practice sets mapped to specific sections.
        </span>
      </div>

      <div className="flex-1 flex justify-center items-center relative">
        <svg viewBox="0 0 100 100" className="w-[180px] h-[180px] -rotate-90">
          <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
          <circle 
            ref={arcRef}
            cx="50" 
            cy="50" 
            r="40" 
            fill="none" 
            stroke="#92b9c6" 
            strokeWidth="8" 
            strokeLinecap="round" 
            className="drop-shadow-[0_0_8px_rgba(146,185,198,0.6)]"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col justify-center items-center">
          <span className={`text-4xl font-bold text-white ${TOKENS.typography.headingSans}`}>
            <span ref={valRef}>0</span>%
          </span>
          <span className={`text-[10px] uppercase text-[#92b9c6] tracking-widest mt-1 ${TOKENS.typography.dataMono}`}>
            Accuracy
          </span>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// CARD 3: Simulated Exams (Pressure Gauge EKG)
// ----------------------------------------------------------------------
function ExamCard() {
  return (
    <div className="relative flex h-[380px] w-full flex-col overflow-hidden rounded-[2rem] bg-[#1A1A1A] p-6 shadow-2xl ring-1 ring-white/10">
      <div className="flex flex-col gap-1 mb-6">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-red-400" />
          <span className={`font-bold text-[#F2F0E9] tracking-wider text-sm uppercase ${TOKENS.typography.headingSans}`}>
            Simulated Exams
          </span>
        </div>
        <span className={`text-xs text-[#F2F0E9]/50 ${TOKENS.typography.secondarySans}`}>
          Pixel-perfect Pearson VUE testing environment.
        </span>
      </div>

      <div className="flex-1 rounded-xl bg-black px-4 py-8 border border-white/5 relative overflow-hidden flex flex-col justify-end">
        
        {/* Animated Digital Clock */}
        <div className="absolute top-4 left-4 flex items-center gap-2 opacity-50">
          <Clock className="w-4 h-4 text-white animate-pulse" />
          <span className={`text-xs text-white ${TOKENS.typography.dataMono}`}>01:45:22 REMAINING</span>
        </div>

        {/* EKG / Tension Wave */}
        <svg viewBox="0 0 200 50" className="w-full h-24 overflow-visible">
          <path 
            d="M 0 25 L 40 25 L 50 10 L 60 40 L 70 25 L 120 25 L 130 -10 L 140 50 L 150 25 L 200 25"
            fill="none"
            stroke="#F2F0E9"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            className="opacity-20 animate-[pulse_1s_ease-in-out_infinite]"
          >
            <animate attributeName="stroke-dasharray" values="500; 500" dur="2s" />
            <animate attributeName="stroke-dashoffset" values="500; 0" dur="2s" repeatCount="indefinite" />
          </path>
          
          <path 
            d="M 0 25 L 40 25 L 50 10 L 60 40 L 70 25 L 120 25 L 130 -10 L 140 50 L 150 25 L 200 25"
            fill="none"
            stroke="red"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            className="drop-shadow-[0_0_5px_red] animate-[pulse_1s_ease-in-out_infinite]"
            strokeDasharray="20 500"
          >
            <animate attributeName="stroke-dashoffset" values="500; 0" dur="2s" repeatCount="indefinite" />
          </path>
        </svg>

        <div className="absolute right-4 bottom-4">
          <span className={`text-[10px] text-white/40 uppercase tracking-widest ${TOKENS.typography.dataMono}`}>Stress Index</span>
          <div className="w-full bg-white/10 h-1 mt-1 rounded-full overflow-hidden">
             <div className="bg-red-500 h-full w-[80%] rounded-full animate-pulse"></div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// MAIN EXPORT
// ----------------------------------------------------------------------
export function UCATSectionV2() {
  return (
    <section id="ucat" className="relative w-full bg-[#1A1A1A] py-32 min-h-dvh flex flex-col justify-center rounded-[3rem] -mt-10 z-20 shadow-2xl text-[#F2F0E9]">
      <div className="mx-auto max-w-7xl px-8">
        <div className="mb-16 text-center">
          <h2
            className={`text-4xl font-bold tracking-tight md:text-5xl ${TOKENS.typography.headingSans}`}
          >
            Ace the UCAT
          </h2>
          <p
            className={`mt-4 text-xl text-[#F2F0E9]/60 max-w-2xl mx-auto ${TOKENS.typography.secondarySans}`}
          >
            Master the UCAT with our specialised engines. Designed to aggressively enhance your problem-solving, critical thinking, and specific section timing.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          <CurriculumCard />
          <QuestionBankCard />
          <ExamCard />
        </div>
      </div>
    </section>
  );
}
