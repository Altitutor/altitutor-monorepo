"use client";

import { MARKETING_TOKENS } from "@altitutor/shared";
import { gsap } from "gsap";
import { Activity } from "lucide-react";
import { useEffect, useRef } from "react";

const { typography: typo } = MARKETING_TOKENS;

export function UcatTelemetryCard() {
  const pathRef = useRef<SVGPathElement>(null);
  const scoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pathRef.current || !scoreRef.current) return;
    const path = pathRef.current;
    const length = path.getTotalLength();
    path.style.strokeDasharray = `${length}`;
    path.style.strokeDashoffset = `${length}`;

    const scoreObj = { val: 520 };

    const ctx = gsap.context(() => {
      gsap.to(path, {
        strokeDashoffset: 0,
        duration: 4,
        ease: "power2.inOut",
        repeat: -1,
        yoyo: true,
        repeatDelay: 1,
      });

      gsap.fromTo(
        scoreObj,
        { val: 520 },
        {
          val: 2630,
          duration: 4,
          ease: "power2.inOut",
          repeat: -1,
          yoyo: true,
          repeatDelay: 1,
          onUpdate: () => {
            if (scoreRef.current) {
              scoreRef.current.innerText = Math.round(scoreObj.val).toString();
            }
          },
        },
      );
    });
    return () => ctx.revert();
  }, []);

  return (
    <div className="relative flex h-[350px] w-full flex-col overflow-hidden rounded-[2rem] bg-marketing-charcoal p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] ring-1 ring-black/5">
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-marketing-accent" />
            <span
              className={`text-sm font-bold uppercase tracking-wider text-marketing-cream ${typo.headingSans}`}
            >
              Adaptive Telemetry
            </span>
          </div>
          <span
            className={`text-xs text-marketing-cream/50 ${typo.secondarySans}`}
          >
            Real-time score projection based on performance.
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-marketing-accent opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-marketing-accent" />
          </span>
          <span
            className={`text-xs uppercase tracking-widest text-marketing-cream/50 ${typo.dataMono}`}
          >
            Live
          </span>
        </div>
      </div>
      <div className="relative mt-8 flex w-full flex-1 items-end">
        <svg viewBox="0 0 300 150" className="h-full w-full overflow-visible">
          <path
            d="M0 150 L300 150"
            stroke="currentColor"
            className="text-marketing-cream/10"
            strokeWidth="1"
            strokeDasharray="4 4"
            fill="none"
          />
          <path
            d="M0 100 L300 100"
            stroke="currentColor"
            className="text-marketing-cream/10"
            strokeWidth="1"
            strokeDasharray="4 4"
            fill="none"
          />
          <path
            d="M0 50 L300 50"
            stroke="currentColor"
            className="text-marketing-cream/10"
            strokeWidth="1"
            strokeDasharray="4 4"
            fill="none"
          />

          <path
            ref={pathRef}
            d="M 10 140 Q 40 130, 70 110 T 130 90 T 190 60 T 250 30 T 290 10"
            fill="none"
            stroke="currentColor"
            className="text-marketing-accent"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </svg>

        <div className="absolute left-0 top-0 pt-4 opacity-50">
          <div
            ref={scoreRef}
            className={`text-4xl font-bold text-marketing-accent ${typo.headingSans}`}
          >
            520
          </div>
          <div
            className={`text-xs uppercase tracking-widest text-marketing-cream ${typo.dataMono}`}
          >
            Proj. Score
          </div>
        </div>
      </div>
    </div>
  );
}
