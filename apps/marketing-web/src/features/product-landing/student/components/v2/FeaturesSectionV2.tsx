"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import { gsap } from "gsap";
import { Brain, MessageSquare, Flame } from "lucide-react";
import { TOKENS } from "./shared";

// ----------------------------------------------------------------------
// CARD 1: Diagnostic Shuffler (Student Ecosystem)
// ----------------------------------------------------------------------
function EcosystemCard() {
  const [items, setItems] = useState([
    {
      id: 1,
      title: "1. Student Portal",
      desc: "Gateway to comprehensive learning resources.",
    },
    { id: 2, title: "2. Altitutor App", desc: "Your ultimate study partner & instant messaging." },
    { id: 3, title: "3. 24/7 Support", desc: "Get help from tutors anytime you need." },
  ]);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    if (isHovered) return;
    const interval = setInterval(() => {
      setItems((prev) => {
        const next = [...prev];
        const first = next.shift();
        if (first) next.push(first);
        return next;
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [isHovered]);

  const handleCycle = () => {
    setItems((prev) => {
      const next = [...prev];
      const first = next.shift();
      if (first) next.push(first);
      return next;
    });
  };

  return (
    <div className="relative flex h-[380px] w-full flex-col items-center justify-center overflow-hidden rounded-[2rem] bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] ring-1 ring-black/5">
      <div className="absolute left-6 top-6 flex flex-col gap-1 z-20 pointer-events-none">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-[#0a2941]" />
          <span
            className={`font-bold text-[#1A1A1A] tracking-wider text-sm uppercase ${TOKENS.typography.headingSans}`}
          >
            Digital Ecosystem
          </span>
        </div>
        <span className={`text-xs text-[#1A1A1A]/70 ${TOKENS.typography.secondarySans}`}>
          Click to advance platform layer.
        </span>
      </div>

      <div
        className="relative mt-8 h-[220px] w-full max-w-[280px] cursor-pointer group z-10"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={handleCycle}
      >
        {items.map((item, i) => {
          const isTop = i === 0;
          return (
            <div
              key={item.id}
              className="absolute left-0 top-0 w-full rounded-2xl border border-black/5 p-6 shadow-md transition-all duration-1000 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
              style={{
                zIndex: 10 - i,
                transform: `scale(${1 - i * 0.05 + (isTop && isHovered ? 0.03 : 0)}) translateY(${
                  i * 18 - (isTop && isHovered ? 8 : 0)
                }px)`,
                opacity: 1 - i * 0.3,
                backgroundColor: isTop ? "#0a2941" : "#F2F0E9",
                color: isTop ? "#F2F0E9" : "#1A1A1A",
              }}
            >
              <h3 className={`text-xl font-bold ${TOKENS.typography.headingSans}`}>
                {item.title}
              </h3>
              <p className={`mt-3 text-sm opacity-90 ${TOKENS.typography.secondarySans}`}>
                {item.desc}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// CARD 2: Telemetry Typewriter (Question Board Feed)
// ----------------------------------------------------------------------
function QuestionFeedCard() {
  const [messages] = useState([
    "Student: How do I solve Q5 in the integration worksheet?",
    "System: Routing to available Mathematics tutor...",
    "Tutor: Let's break down the area bound by the two curves.",
    "Student: Ah, I see! I need to find the intersection points first.",
    "System: Query resolved. Session archived.",
  ]);
  const [currentMsgIndex, setCurrentMsgIndex] = useState(0);
  const [typedText, setTypedText] = useState("");

  useEffect(() => {
    let charIndex = 0;
    const currentMessage = messages[currentMsgIndex];
    let typeInterval: NodeJS.Timeout;

    const startTyping = () => {
      setTypedText("");
      charIndex = 0;
      typeInterval = setInterval(() => {
        if (charIndex < currentMessage.length - 1) {
          setTypedText((prev) => prev + currentMessage[charIndex]);
          charIndex++;
        } else {
          clearInterval(typeInterval);
          setTimeout(() => {
            setCurrentMsgIndex((prev) => (prev + 1) % messages.length);
          }, 2000);
        }
      }, 50);
    };

    startTyping();
    return () => clearInterval(typeInterval);
  }, [currentMsgIndex, messages]);

  return (
    <div className="relative flex h-[380px] w-full flex-col overflow-hidden rounded-[2rem] bg-[#1A1A1A] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] ring-1 ring-black/5">
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-[#92b9c6]" />
            <span
              className={`font-bold text-[#F2F0E9] tracking-wider text-sm uppercase ${TOKENS.typography.headingSans}`}
            >
              24/7 Question Board
            </span>
          </div>
          <span className={`text-xs text-[#F2F0E9]/50 ${TOKENS.typography.secondarySans}`}>
            Live feed tracking support system queries.
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping bg-[#92b9c6] absolute inline-flex h-full w-full rounded-full opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#92b9c6]"></span>
          </span>
          <span className={`text-xs text-[#F2F0E9]/50 uppercase ${TOKENS.typography.dataMono}`}>
            Live
          </span>
        </div>
      </div>
      <div className="relative mt-6 flex-1 w-full bg-[#1A1A1A] rounded-xl font-mono text-sm">
        <div className="flex flex-col gap-2 opacity-30 pointer-events-none mb-4 overflow-hidden h-[80px]">
          {messages.map((msg, idx) => {
            if (idx === currentMsgIndex) return null;
            return <div key={idx} className="truncate text-[#92b9c6]">{msg}</div>;
          })}
        </div>
        <div className={`text-[#92b9c6] mt-4 ${TOKENS.typography.dataMono}`}>
          {typedText}
          <span className="animate-pulse bg-[#92b9c6] inline-block w-2 h-4 ml-1 translate-y-1"></span>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// CARD 3: Cursor Protocol Scheduler (Consistency)
// ----------------------------------------------------------------------
function SchedulerCard() {
  const containerRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  
  // Simulated heatmap data (28 days / 4 weeks)
  const heatmapData = useMemo(() => Array.from({ length: 28 }, (_, i) => {
    const intensity = Math.random();
    let bg = "bg-[#F2F0E9] border-black/5"; // empty
    if (intensity > 0.8) { bg = "bg-[#0a2941]"; } 
    else if (intensity > 0.4) { bg = "bg-[#0a2941]/70 border-transparent"; } 
    else if (intensity > 0.15) { bg = "bg-[#0a2941]/30 border-transparent"; } 
    return { id: i, bg };
  }), []);

  useEffect(() => {
    if (!cursorRef.current || !containerRef.current) return;
    
    const ctx = gsap.context(() => {
      const cells = containerRef.current!.querySelectorAll('.heatmap-cell');
      if (cells.length === 0) return;

      const targets = [cells[4], cells[12], cells[18], cells[26]];
      const tl = gsap.timeline({ repeat: -1 });

      targets.forEach((cell) => {
         const rect = cell.getBoundingClientRect();
         const containerRect = containerRef.current!.getBoundingClientRect();
         
         const relativeX = rect.left - containerRect.left + rect.width / 2;
         const relativeY = rect.top - containerRect.top + rect.height / 2;

         tl.to(cursorRef.current, {
           left: relativeX,
           top: relativeY,
           duration: 1.2,
           ease: "power2.inOut",
         })
         .to(cursorRef.current, { scale: 0.85, duration: 0.1, yoyo: true, repeat: 1 }) // simulate click
         .to(cell, { backgroundColor: "#92b9c6", duration: 0.3 }) // highlight active day
         .to({}, { duration: 1.0 }); // Pause
      });

      tl.to(cursorRef.current, {
        left: '80%',
        top: '80%',
        duration: 1.2,
        ease: "power2.inOut",
      });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <div className="relative flex h-[380px] w-full flex-col overflow-hidden rounded-[2rem] bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] ring-1 ring-black/5">
      <div className="flex flex-col gap-1 mb-6">
        <div className="flex items-center gap-2">
          <Flame className="h-5 w-5 text-[#0a2941]" />
          <span
            className={`font-bold text-[#1A1A1A] tracking-wider text-sm uppercase ${TOKENS.typography.headingSans}`}
          >
            Study Consistency
          </span>
        </div>
        <span className={`text-xs text-[#1A1A1A]/70 ${TOKENS.typography.secondarySans}`}>
          Log your practice and assignment progress daily.
        </span>
      </div>

      <div ref={containerRef} className="flex-1 rounded-xl bg-[#F2F0E9]/50 p-4 border border-black/5 relative overflow-hidden group">
        {/* Animated GSAP Cursor */}
        <div ref={cursorRef} className="absolute z-20 w-5 h-5 pointer-events-none" style={{ top: '80%', left: '80%' }}>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="w-6 h-6 text-[#1A1A1A] drop-shadow-md -rotate-[15deg] filter transition-transform"
          >
            <path
              d="M4 4l5.33 16 2.67-7.33L19.33 10 4 4z"
              fill="currentColor"
              stroke="white"
              strokeWidth="2"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <div>
          <div
            className={`grid grid-cols-7 gap-2 text-center text-[10px] font-medium text-[#1A1A1A]/40 mb-2 ${TOKENS.typography.headingSans}`}
          >
            {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
              <div key={d + i}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {heatmapData.map((data: { id: number; bg: string }) => (
              <div
                key={data.id}
                className={`heatmap-cell aspect-square rounded-[4px] border ${data.bg}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// MAIN EXPORT
// ----------------------------------------------------------------------
export function FeaturesSectionV2() {
  return (
    <section id="features" className="relative w-full bg-[#F2F0E9] py-32 min-h-dvh flex flex-col justify-center border-t border-black/5">
      <div className="mx-auto max-w-7xl px-8">
        <div className="mb-16 text-center">
          <h2
            className={`text-4xl font-bold tracking-tight text-[#1A1A1A] md:text-5xl ${TOKENS.typography.headingSans}`}
          >
            Interactive Functional Artifacts
          </h2>
          <p
            className={`mt-4 text-xl text-[#1A1A1A]/60 max-w-2xl mx-auto ${TOKENS.typography.secondarySans}`}
          >
            A learning system which moves with you. Engage with a community dedicated to excellence and access all the tools you need to thrive.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          <EcosystemCard />
          <QuestionFeedCard />
          <SchedulerCard />
        </div>
      </div>
    </section>
  );
}
