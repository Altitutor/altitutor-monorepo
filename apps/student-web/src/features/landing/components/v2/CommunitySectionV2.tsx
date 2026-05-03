"use client";

import React, { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { Users, HelpCircle, Bell, Award, Calendar, Trophy } from "lucide-react";
import { TOKENS } from "./shared";

// ----------------------------------------------------------------------
// CARD 1: Study Sessions (Node network pulse)
// ----------------------------------------------------------------------
function StudySessionsCard() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.to(".study-node", {
        scale: 1.2,
        opacity: 0.8,
        duration: 1.5,
        stagger: { each: 0.2, yoyo: true, repeat: -1 },
        ease: "sine.inOut",
      });
      gsap.to(".study-line", {
        strokeDashoffset: 0,
        duration: 2,
        repeat: -1,
        ease: "linear",
      });
    }, containerRef);
    return () => ctx.revert();
  }, []);

  return (
    <div className="relative flex h-[320px] w-full flex-col overflow-hidden rounded-[2rem] bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] ring-1 ring-black/5">
      <div className="flex flex-col gap-1 mb-6">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-[#0a2941]" />
          <span className={`font-bold text-[#1A1A1A] tracking-wider text-sm uppercase ${TOKENS.typography.headingSans}`}>
            Study Sessions
          </span>
        </div>
        <span className={`text-xs text-[#1A1A1A]/70 ${TOKENS.typography.secondarySans}`}>
          Join live groups with peers.
        </span>
      </div>

      <div ref={containerRef} className="flex-1 rounded-xl bg-[#F2F0E9]/50 p-4 border border-black/5 relative overflow-hidden flex items-center justify-center">
        <svg viewBox="0 0 200 150" className="w-[80%] h-full overflow-visible">
          {/* Lines */}
          <path d="M 50 50 L 100 75 L 150 50" stroke="#0a2941" strokeWidth="2" strokeDasharray="4 4" className="study-line" opacity="0.2" fill="none" />
          <path d="M 100 75 L 100 120" stroke="#0a2941" strokeWidth="2" strokeDasharray="4 4" className="study-line" opacity="0.2" fill="none" />
          
          {/* Nodes */}
          <circle cx="50" cy="50" r="15" fill="#92b9c6" className="study-node" />
          <circle cx="150" cy="50" r="15" fill="#92b9c6" className="study-node" />
          <circle cx="100" cy="120" r="15" fill="#92b9c6" className="study-node" />
          <circle cx="100" cy="75" r="25" fill="#0a2941" className="study-node shadow-xl" />
        </svg>
        <div className="absolute bottom-4 right-4 flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping bg-green-500 absolute inline-flex h-full w-full rounded-full opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
          <span className={`text-[10px] text-[#1A1A1A]/60 uppercase font-bold tracking-widest ${TOKENS.typography.dataMono}`}>14 Online</span>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// CARD 2: Homework Help (Thread resolution)
// ----------------------------------------------------------------------
function HomeworkHelpCard() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ repeat: -1 });
      tl.to(".msg-1", { opacity: 1, y: 0, duration: 0.5 })
        .to(".msg-2", { opacity: 1, y: 0, duration: 0.4, delay: 0.5 })
        .to(".msg-indicator", { opacity: 1, duration: 0.2 })
        .to(".msg-indicator", { opacity: 0, duration: 0.2, delay: 1 })
        .to(".msg-3", { opacity: 1, y: 0, duration: 0.4 })
        .to(".resolve-badge", { scale: 1, opacity: 1, duration: 0.5, ease: "back.out(2)" })
        .to({}, { duration: 2 }) // pause
        .to([".msg-1", ".msg-2", ".msg-3", ".resolve-badge"], { opacity: 0, y: 10, scale: 0.8, duration: 0.3 }); // reset
    }, containerRef);
    return () => ctx.revert();
  }, []);

  return (
    <div className="relative flex h-[320px] w-full flex-col overflow-hidden rounded-[2rem] bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] ring-1 ring-black/5">
      <div className="flex flex-col gap-1 mb-6">
        <div className="flex items-center gap-2">
          <HelpCircle className="h-5 w-5 text-[#92b9c6]" />
          <span className={`font-bold text-[#1A1A1A] tracking-wider text-sm uppercase ${TOKENS.typography.headingSans}`}>
            Homework Help
          </span>
        </div>
        <span className={`text-xs text-[#1A1A1A]/70 ${TOKENS.typography.secondarySans}`}>
          Get unstuck instantly by mentors.
        </span>
      </div>

      <div ref={containerRef} className="flex-1 rounded-xl bg-gray-50 p-4 border border-black/5 relative overflow-hidden flex flex-col justify-end gap-2 text-xs">
        <div className="msg-1 opacity-0 translate-y-2 self-start bg-white p-2 rounded-lg rounded-tl-none shadow-sm border border-black/5 max-w-[80%]">
          I'm stuck on Q4 for the Calculus assignment...
        </div>
        <div className="msg-2 opacity-0 translate-y-2 self-start bg-white p-2 rounded-lg rounded-tl-none shadow-sm border border-black/5 max-w-[80%]">
           <img src="/images/landing/study-notes-screenshot.png" className="w-full h-8 object-cover rounded mb-1 opacity-50 grayscale" alt="attachment" />
           Here is my working out.
        </div>
        
        <div className="msg-indicator opacity-0 self-end flex gap-1 items-center px-2 text-[10px] text-gray-400">
           Tutor typing...
        </div>

        <div className="msg-3 opacity-0 translate-y-2 self-end bg-[#0a2941] text-white p-2 rounded-lg rounded-tr-none shadow-sm max-w-[80%]">
          Look at line 3, you forgot to apply the chain rule! Let me walk you through it.
        </div>
        
        <div className="resolve-badge absolute top-4 right-4 opacity-0 scale-50 bg-green-100 text-green-700 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide flex items-center gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div> Resolved
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// CARD 3: Announcements (Ticker tape)
// ----------------------------------------------------------------------
function AnnouncementsCard() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.to(".marquee-inner", {
        xPercent: -50,
        ease: "none",
        duration: 15,
        repeat: -1,
      });
      gsap.to(".bell-icon", {
        rotate: 15,
        yoyo: true,
        repeat: -1,
        ease: "sine.inOut",
        duration: 0.2,
        repeatDelay: 3
      });
    }, containerRef);
    return () => ctx.revert();
  }, []);

  return (
    <div className="relative flex h-[320px] w-full flex-col overflow-hidden rounded-[2rem] bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] ring-1 ring-black/5">
      <div className="flex flex-col gap-1 mb-6">
        <div className="flex items-center gap-2">
          <Bell className="bell-icon h-5 w-5 text-[#CC5833]" />
          <span className={`font-bold text-[#1A1A1A] tracking-wider text-sm uppercase ${TOKENS.typography.headingSans}`}>
            Announcements
          </span>
        </div>
        <span className={`text-xs text-[#1A1A1A]/70 ${TOKENS.typography.secondarySans}`}>
          Stay updated with platform drops.
        </span>
      </div>

      <div ref={containerRef} className="flex-1 rounded-xl bg-[#1A1A1A] text-[#F2F0E9] p-4 relative overflow-hidden flex flex-col">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,rgba(204,88,51,0.1)_0,transparent_100%)]"></div>
        <div className="flex-1 flex flex-col justify-center">
          <div className="w-[200%] flex marquee-inner whitespace-nowrap text-3xl font-bold uppercase tracking-tight opacity-50">
             NEW MOCK EXAMS RELEASED • SERVER MAINTENANCE TONIGHT • NEW MOCK EXAMS RELEASED • SERVER MAINTENANCE TONIGHT •
          </div>
          <div className="w-[200%] flex marquee-inner whitespace-nowrap text-3xl font-bold uppercase tracking-tight opacity-100 ml-10 text-[#CC5833]">
             TERM 3 TIMETABLE LIVE • TERM 3 TIMETABLE LIVE • TERM 3 TIMETABLE LIVE • TERM 3 TIMETABLE LIVE •
          </div>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// CARD 4: Loyalty Cards (Stamping Animation)
// ----------------------------------------------------------------------
function LoyaltyCard() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ repeat: -1 });
      const stamps = gsap.utils.toArray(".stamp-mark");
      
      stamps.forEach((stamp: any, i) => {
        tl.to(stamp, { opacity: 1, scale: 1, rotation: gsap.utils.random(-15, 15), duration: 0.3, ease: "back.out(2)" })
          .to({}, { duration: 0.5 }); // delay between stamps
      });
      tl.to(".reward-unlock", { y: 0, opacity: 1, duration: 0.5, ease: "back.out(1.5)" })
        .to({}, { duration: 2 })
        .to([stamps, ".reward-unlock"], { opacity: 0, scale: 0.5, y: 20, duration: 0.5 });
    }, containerRef);
    return () => ctx.revert();
  }, []);

  return (
    <div className="relative flex h-[320px] w-full flex-col overflow-hidden rounded-[2rem] bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] ring-1 ring-black/5">
      <div className="flex flex-col gap-1 mb-6">
        <div className="flex items-center gap-2">
          <Award className="h-5 w-5 text-yellow-500" />
          <span className={`font-bold text-[#1A1A1A] tracking-wider text-sm uppercase ${TOKENS.typography.headingSans}`}>
            Loyalty Rewards
          </span>
        </div>
        <span className={`text-xs text-[#1A1A1A]/70 ${TOKENS.typography.secondarySans}`}>
          Earn perks through consistent attendance.
        </span>
      </div>

      <div ref={containerRef} className="flex-1 rounded-xl bg-orange-50 border border-orange-100 p-4 relative overflow-hidden flex flex-col items-center justify-center">
        <div className="grid grid-cols-3 gap-3 w-full max-w-[180px]">
           {[1,2,3,4,5,6].map((i) => (
             <div key={i} className="aspect-square rounded-full border-2 border-dashed border-orange-200 flex items-center justify-center relative bg-white">
                <span className="text-orange-200 text-xs font-bold">{i}</span>
                <div className="stamp-mark absolute inset-0 bg-[#0a2941] text-white rounded-full flex items-center justify-center opacity-0 scale-50 z-10 font-bold text-xs origin-center">
                  ✓
                </div>
             </div>
           ))}
        </div>
        <div className="reward-unlock absolute bottom-4 bg-yellow-400 text-yellow-900 px-4 py-2 font-bold text-xs rounded-full shadow-lg opacity-0 translate-y-4 uppercase tracking-widest">
           Reward Unlocked!
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// CARD 5: Alti Events (Calendar flip)
// ----------------------------------------------------------------------
function EventsCard() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ repeat: -1 });
      tl.to(".cal-top", { rotationX: -90, transformOrigin: "bottom", duration: 0.4, ease: "power1.in" })
        .set(".cal-num", { innerText: "18" })
        .set(".cal-top", { rotationX: 90 })
        .to(".cal-top", { rotationX: 0, duration: 0.4, ease: "bounce.out" })
        .to({}, { duration: 2 });
    }, containerRef);
    return () => ctx.revert();
  }, []);

  return (
    <div className="relative flex h-[320px] w-full flex-col overflow-hidden rounded-[2rem] bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] ring-1 ring-black/5">
      <div className="flex flex-col gap-1 mb-6">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-[#92b9c6]" />
          <span className={`font-bold text-[#1A1A1A] tracking-wider text-sm uppercase ${TOKENS.typography.headingSans}`}>
            Alti Events
          </span>
        </div>
        <span className={`text-xs text-[#1A1A1A]/70 ${TOKENS.typography.secondarySans}`}>
          Seminars, workshops, and meetups.
        </span>
      </div>

      <div ref={containerRef} className="flex-1 rounded-xl bg-[#F2F0E9] p-4 relative overflow-hidden flex items-center justify-center dashboard-perspective">
        <div className="w-24 h-28 bg-white rounded-xl shadow-lg border border-black/10 flex flex-col overflow-hidden relative" style={{ perspective: "1000px" }}>
           <div className="bg-[#cc5833] h-6 w-full flex items-center justify-center text-[10px] text-white font-bold uppercase tracking-widest">
             OCTOBER
           </div>
           <div className="flex-1 flex items-center justify-center text-5xl font-bold text-[#1A1A1A] relative bg-white">
              <span className="cal-num z-0">17</span>
              {/* Fake flip top half */}
              <div className="cal-top absolute top-0 left-0 w-full h-[50%] bg-white border-b border-black/5 overflow-hidden origin-bottom">
                 <div className="absolute bottom-0 w-full text-center translate-y-[50%]">17</div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// CARD 6: Weekly Competitions (Leaderboard Swap)
// ----------------------------------------------------------------------
function CompetitionsCard() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ repeat: -1 });
      // Player 3 overtakes Player 2, then Player 1
      tl.to(".player-3", { y: -48, backgroundColor: "#e2e8f0", duration: 0.6, ease: "power2.inOut", delay: 1 })
        .to(".player-2", { y: 48, duration: 0.6, ease: "power2.inOut" }, "<")
        // Now 3 overtakes 1
        .to(".player-3", { y: -96, backgroundColor: "rgba(255,215,0,0.2)", scale: 1.05, duration: 0.6, ease: "power2.inOut", delay: 1 })
        .to(".player-1", { y: 48, backgroundColor: "white", scale: 1, duration: 0.6, ease: "power2.inOut" }, "<")
        .to({}, { duration: 2 })
        // Reset
        .to(".player-3", { y: 0, backgroundColor: "white", scale: 1, duration: 0 })
        .to(".player-2", { y: 0, duration: 0 })
        .to(".player-1", { y: 0, backgroundColor: "rgba(255,215,0,0.2)", scale: 1.05, duration: 0 });
    }, containerRef);
    return () => ctx.revert();
  }, []);

  return (
    <div className="relative flex h-[320px] w-full flex-col overflow-hidden rounded-[2rem] bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] ring-1 ring-black/5">
      <div className="flex flex-col gap-1 mb-6">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-500" />
          <span className={`font-bold text-[#1A1A1A] tracking-wider text-sm uppercase ${TOKENS.typography.headingSans}`}>
            Competitions
          </span>
        </div>
        <span className={`text-xs text-[#1A1A1A]/70 ${TOKENS.typography.secondarySans}`}>
          Weekly leaderboards and prizes.
        </span>
      </div>

      <div ref={containerRef} className="flex-1 rounded-xl bg-gray-50 p-4 border border-black/5 relative overflow-hidden flex flex-col justify-center gap-2 text-xs">
        
        <div className="player-1 bg-[rgba(255,215,0,0.2)] scale-[1.05] p-3 rounded-lg flex items-center justify-between border border-yellow-200 z-30 shadow-sm relative">
          <div className="flex items-center gap-2"><div className="w-5 h-5 rounded bg-yellow-400 text-white flex items-center justify-center font-bold text-[10px]">1</div><span className="font-bold">Sarah</span></div>
          <span className={`font-bold text-[#1A1A1A] ${TOKENS.typography.dataMono}`}>9,420</span>
        </div>
        
        <div className="player-2 bg-white p-3 rounded-lg flex items-center justify-between border border-black/5 z-20 relative shadow-sm">
          <div className="flex items-center gap-2"><div className="w-5 h-5 rounded bg-slate-200 text-slate-500 flex items-center justify-center font-bold text-[10px]">2</div><span className="font-semibold">David</span></div>
          <span className={`font-medium text-[#1A1A1A]/80 ${TOKENS.typography.dataMono}`}>8,100</span>
        </div>
        
        <div className="player-3 bg-white p-3 rounded-lg flex items-center justify-between border border-black/5 z-10 relative shadow-sm">
          <div className="flex items-center gap-2"><div className="w-5 h-5 rounded bg-orange-100 text-orange-600 flex items-center justify-center font-bold text-[10px]">3</div><span className="font-semibold">You</span></div>
          <span className={`font-bold text-green-600 ${TOKENS.typography.dataMono}`}>7,950 </span>
        </div>

      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// MAIN EXPORT
// ----------------------------------------------------------------------
export function CommunitySectionV2() {
  return (
    <section id="community" className="relative w-full bg-[#F2F0E9] py-32 min-h-dvh flex flex-col justify-center z-10 text-[#1A1A1A]">
      <div className="mx-auto max-w-7xl px-8">
        <div className="mb-16 text-center">
          <h2
            className={`text-4xl font-bold tracking-tight md:text-5xl ${TOKENS.typography.headingSans}`}
          >
            Alti Community
          </h2>
          <p
            className={`mt-4 text-xl text-[#1A1A1A]/60 max-w-2xl mx-auto ${TOKENS.typography.secondarySans}`}
          >
            Built to provide continuous accountability, instant help, and reward execution.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          <StudySessionsCard />
          <HomeworkHelpCard />
          <AnnouncementsCard />
          <LoyaltyCard />
          <EventsCard />
          <CompetitionsCard />
        </div>
      </div>
    </section>
  );
}
