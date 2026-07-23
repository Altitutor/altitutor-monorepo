"use client";

import { useState } from "react";
import { ArrowUpRight, BarChart3, HelpCircle, TrendingUp } from "lucide-react";

const sections = {
  "Total score": {
    estimate: "2,105",
    range: "2,030–2,180",
    target: "2,350",
    confidence: "Medium confidence",
    bars: [74, 81, 58],
    labels: ["Verbal Reasoning", "Decision Making", "Quantitative Reasoning"],
  },
  "Verbal Reasoning": {
    estimate: "710",
    range: "680–740",
    target: "760",
    confidence: "High confidence",
    bars: [78, 61, 72],
    labels: ["Reading comprehension", "True / false / can’t tell", "Author opinion"],
  },
  "Decision Making": {
    estimate: "730",
    range: "700–755",
    target: "760",
    confidence: "High confidence",
    bars: [84, 67, 77],
    labels: ["Syllogisms", "Logic puzzles", "Probability"],
  },
  "Quantitative Reasoning": {
    estimate: "665",
    range: "625–700",
    target: "780",
    confidence: "Medium confidence",
    bars: [59, 48, 71],
    labels: ["Data interpretation", "Rates and ratios", "Arithmetic"],
  },
} as const;

type SectionName = keyof typeof sections;

export function UcatPerformancePreview() {
  const [sectionName, setSectionName] = useState<SectionName>("Total score");
  const selected = sections[sectionName];

  return (
    <div className="ucat-product-ui min-h-[32rem] rounded-[1.25rem] bg-[#e8eaed] p-3 text-[#1a1a1a] shadow-[0_22px_70px_rgba(10,41,65,0.15)] ring-1 ring-black/[0.08] sm:min-h-[35rem] sm:p-5">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Score preview section">
        {(Object.keys(sections) as SectionName[]).map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            aria-selected={sectionName === name}
            onClick={() => setSectionName(name)}
            className={`rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors ${
              sectionName === name
                ? "bg-[#0a2941] text-white"
                : "bg-white text-black/55 shadow-sm ring-1 ring-black/[0.05] hover:text-black"
            }`}
          >
            {name}
          </button>
        ))}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-[0.72fr_1.28fr]">
        <section className="rounded-[1.1rem] bg-white p-4 shadow-sm ring-1 ring-black/[0.055]">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-semibold">Current estimate</span>
            <TrendingUp className="size-4 text-[#0a2941]" aria-hidden />
          </div>
          <p className="mt-5 text-4xl font-bold tracking-tight text-[#0a2941]">{selected.estimate}</p>
          <p className="mt-1 text-xs text-black/48">Plausible range {selected.range}</p>
          <div className="mt-5 rounded-xl bg-[#f1f2f3] p-3">
            <div className="flex items-center justify-between text-[10px] text-black/48">
              <span>Confidence</span>
              <HelpCircle className="size-3" aria-hidden />
            </div>
            <p className="mt-1 text-sm font-semibold">{selected.confidence}</p>
            <p className="mt-1 text-[10px] leading-relaxed text-black/44">
              Your range narrows as you complete more timed evidence.
            </p>
          </div>
        </section>

        <section className="rounded-[1.1rem] bg-white p-4 shadow-sm ring-1 ring-black/[0.055]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold">Score progress</p>
              <p className="mt-1 text-[10px] text-black/44">Historical estimates and a projection towards test day</p>
            </div>
            <span className="rounded-full bg-[#e8eaed] px-2.5 py-1 text-[10px] font-semibold text-[#0a2941]">Target {selected.target}</span>
          </div>
          <div className="relative mt-4 h-44 overflow-hidden rounded-xl bg-[#f5f6f7]">
            <div className="absolute inset-x-4 top-[22%] border-t border-dashed border-[#0a2941]/25" />
            <div className="absolute inset-x-4 top-1/2 border-t border-dashed border-black/10" />
            <div className="absolute inset-x-4 top-[78%] border-t border-dashed border-black/10" />
            <svg viewBox="0 0 600 180" className="absolute inset-0 size-full" preserveAspectRatio="none" aria-label="Historical score and future score projection">
              <path d="M36 137 C105 135 152 119 216 121 S292 101 324 102" fill="none" stroke="#0a2941" strokeWidth="5" strokeLinecap="round" />
              <path d="M324 102 C395 92 474 64 568 41" fill="none" stroke="#92b9c6" strokeWidth="5" strokeLinecap="round" strokeDasharray="10 8" />
              <path d="M324 79 C402 68 483 41 568 20 L568 70 C478 79 397 109 324 121 Z" fill="#92b9c6" opacity="0.2" />
            </svg>
            {[{ left: "8%", bottom: "20%", label: "May" }, { left: "37%", bottom: "30%", label: "Jun" }, { left: "54%", bottom: "43%", label: "Today" }, { left: "93%", bottom: "68%", label: "Test" }].map((point) => (
              <div key={point.label} className="absolute -translate-x-1/2 translate-y-1/2" style={{ left: point.left, bottom: point.bottom }}>
                <span className="block size-3 rounded-full border-[3px] border-white bg-[#0a2941] shadow-[0_0_0_2px_rgba(10,41,65,0.16)]" />
                <span className="mt-2 block -translate-x-1/3 text-[9px] font-medium text-black/42">{point.label}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="mt-3 rounded-[1.1rem] bg-white p-4 shadow-sm ring-1 ring-black/[0.055]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2"><BarChart3 className="size-4 text-[#0a2941]" aria-hidden /><span className="text-xs font-semibold">Strengths and weaknesses</span></div>
          <span className="text-[10px] text-black/42">Accuracy by skill</span>
        </div>
        <div className="mt-4 space-y-3">
          {selected.labels.map((label, index) => (
            <button key={label} type="button" className="group grid w-full grid-cols-[minmax(8rem,0.8fr)_minmax(8rem,1.2fr)_2.25rem] items-center gap-3 text-left">
              <span className="truncate text-[11px] text-black/58 group-hover:text-black">{label}</span>
              <span className="h-2 overflow-hidden rounded-full bg-[#e8eaed]"><span className="block h-full rounded-full bg-[#0a2941] transition-[width] duration-500" style={{ width: `${selected.bars[index]}%` }} /></span>
              <span className="flex items-center justify-end gap-0.5 text-[10px] font-semibold tabular-nums">{selected.bars[index]}<ArrowUpRight className="size-3 opacity-35" aria-hidden /></span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
