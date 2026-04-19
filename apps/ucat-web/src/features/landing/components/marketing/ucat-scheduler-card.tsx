"use client";

import { MARKETING_TOKENS } from "@altitutor/shared";
import { gsap } from "gsap";
import { BarChart3 } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";

const { typography: typo } = MARKETING_TOKENS;

type HeatCell = { id: number; bg: string; qs: number };

export function UcatSchedulerCard() {
  const containerRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const heatmapData = useMemo<HeatCell[]>(
    () =>
      Array.from({ length: 28 }, (_, i) => {
        const intensity = Math.random();
        let bg = "bg-marketing-cream border-black/5";
        let qs = 0;
        if (intensity > 0.8) {
          bg = "bg-marketing-primary";
          qs = Math.floor(Math.random() * 50) + 80;
        } else if (intensity > 0.5) {
          bg = "border-transparent bg-marketing-primary/80";
          qs = Math.floor(Math.random() * 40) + 40;
        } else if (intensity > 0.2) {
          bg = "border-transparent bg-marketing-primary/40";
          qs = Math.floor(Math.random() * 20) + 10;
        }
        return { id: i, bg, qs };
      }),
    [],
  );

  useEffect(() => {
    if (!cursorRef.current || !tooltipRef.current || !containerRef.current)
      return;

    const ctx = gsap.context(() => {
      const cells = containerRef.current!.querySelectorAll(".heatmap-cell");
      if (cells.length === 0) return;

      const targets = [cells[2], cells[10], cells[18], cells[25]];
      const tl = gsap.timeline({ repeat: -1 });

      targets.forEach((cell) => {
        if (!cell || !cursorRef.current || !tooltipRef.current) return;
        const rect = cell.getBoundingClientRect();
        const containerRect = containerRef.current!.getBoundingClientRect();

        const pctX =
          ((rect.left - containerRect.left + rect.width / 2) /
            containerRect.width) *
          100;
        const pctY =
          ((rect.top - containerRect.top + rect.height / 2) /
            containerRect.height) *
          100;
        const qsCount = cell.getAttribute("data-qs");

        tl.to(cursorRef.current, {
          left: `${pctX}%`,
          top: `${pctY}%`,
          duration: 1.2,
          ease: "power2.inOut",
          onStart: () => {
            gsap.to(tooltipRef.current, {
              opacity: 0,
              scale: 0,
              duration: 0.2,
              onComplete: () => {
                if (tooltipRef.current) {
                  gsap.set(tooltipRef.current, {
                    left: `${pctX}%`,
                    top: `${pctY}%`,
                    y: -24,
                  });
                }
              },
            });
          },
          onComplete: () => {
            if (tooltipRef.current) {
              tooltipRef.current.innerText = `${qsCount} Qs`;
              gsap.to(tooltipRef.current, {
                opacity: 1,
                scale: 1,
                duration: 0.3,
                ease: "back.out(1.5)",
              });
            }
          },
        })
          .to(cell, { scale: 1.15, duration: 0.15, yoyo: true, repeat: 1 })
          .to({}, { duration: 1.5 });
      });

      tl.to(cursorRef.current, {
        left: "80%",
        top: "80%",
        duration: 1.2,
        ease: "power2.inOut",
        onStart: () => {
          gsap.to(tooltipRef.current, { opacity: 0, scale: 0, duration: 0.2 });
        },
      });
    }, containerRef);

    return () => ctx.revert();
  }, [heatmapData]);

  return (
    <div className="relative flex h-[350px] w-full flex-col overflow-hidden rounded-[2rem] bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] ring-1 ring-black/5">
      <div className="mb-6 flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-marketing-primary" />
          <span
            className={`text-sm font-bold uppercase tracking-wider text-marketing-charcoal ${typo.headingSans}`}
          >
            Consistency Enforcement
          </span>
        </div>
        <span
          className={`text-xs text-marketing-charcoal/70 ${typo.secondarySans}`}
        >
          Highlight heatmaps track your daily question volume.
        </span>
      </div>

      <div
        ref={containerRef}
        className="group relative flex-1 overflow-hidden rounded-xl border border-black/5 bg-marketing-cream/30 p-4"
      >
        <div
          ref={tooltipRef}
          className="pointer-events-none absolute z-30 rounded bg-marketing-charcoal px-2 py-1 text-[10px] font-bold text-marketing-cream opacity-0 shadow-lg"
          style={{ transform: "translate(-50%, -100%)", top: 0, left: 0 }}
        >
          0 Qs
        </div>

        <div
          ref={cursorRef}
          className="pointer-events-none absolute z-20 w-5 h-5"
          style={{ top: "80%", left: "80%" }}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="h-6 w-6 -rotate-[15deg] text-marketing-charcoal drop-shadow-md"
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
            className={`mb-2 grid grid-cols-7 gap-2 text-center text-[10px] font-medium text-marketing-charcoal/40 ${typo.headingSans}`}
          >
            {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
              <div key={d + i}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {heatmapData.map((data) => (
              <div
                key={data.id}
                data-qs={data.qs}
                className={`heatmap-cell aspect-square rounded-[4px] border transition-colors duration-300 ${data.bg}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
