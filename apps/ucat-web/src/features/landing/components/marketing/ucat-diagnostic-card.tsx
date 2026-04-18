"use client";

import { MARKETING_TOKENS } from "@altitutor/shared";
import { Brain } from "lucide-react";
import { useEffect, useState } from "react";

const { colors, typography: typo } = MARKETING_TOKENS;

type PipelineItem = { id: number; title: string; desc: string };

const INITIAL_ITEMS: PipelineItem[] = [
  {
    id: 1,
    title: "1. Learning Modules",
    desc: "Build foundational knowledge.",
  },
  { id: 2, title: "2. Practice Banks", desc: "Drill targeted concepts." },
  { id: 3, title: "3. Full Mocks", desc: "Simulate test day pressure." },
];

export function UcatDiagnosticCard() {
  const [items, setItems] = useState<PipelineItem[]>(INITIAL_ITEMS);
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
    }, 2500);
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
    <div className="relative flex h-[350px] w-full flex-col items-center justify-center overflow-hidden rounded-[2rem] bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] ring-1 ring-black/5">
      <div className="absolute left-6 top-6 flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-marketing-primary" />
          <span
            className={`text-sm font-bold uppercase tracking-wider text-marketing-charcoal ${typo.headingSans}`}
          >
            The Pipeline
          </span>
        </div>
        <span
          className={`text-xs text-marketing-charcoal/70 ${typo.secondarySans}`}
        >
          Click to advance stage.
        </span>
      </div>

      <div
        className="group relative mt-12 h-[200px] w-full max-w-[280px] cursor-pointer"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={handleCycle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleCycle();
          }
        }}
        role="button"
        tabIndex={0}
      >
        {items.map((item, i) => {
          const isTop = i === 0;
          return (
            <div
              key={item.id}
              className="absolute left-0 top-0 w-full rounded-2xl border border-black/5 p-6 shadow-md transition-all duration-1000 ease-in-out"
              style={{
                zIndex: 10 - i,
                transform: `scale(${1 - i * 0.05 + (isTop && isHovered ? 0.03 : 0)}) translateY(${i * 15 - (isTop && isHovered ? 5 : 0)}px)`,
                opacity: 1 - i * 0.3,
                backgroundColor: isTop ? colors.primary : colors.background,
                color: isTop ? colors.background : colors.dark,
              }}
            >
              <h3 className={`text-lg font-bold ${typo.headingSans}`}>
                {item.title}
              </h3>
              <p className={`mt-2 text-sm opacity-80 ${typo.secondarySans}`}>
                {item.desc}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
