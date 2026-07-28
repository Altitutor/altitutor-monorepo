"use client";

import { useState } from "react";
import {
  Calculator,
  ChevronRight,
  Clock3,
  FileStack,
  Filter,
  Flag,
  ListChecks,
} from "lucide-react";

const tabs = ["Practice", "Sets & mocks"] as const;
type PracticeTab = (typeof tabs)[number];

export function UcatPracticeSuitePreview() {
  const [activeTab, setActiveTab] = useState<PracticeTab>("Practice");
  const [timed, setTimed] = useState(true);

  return (
    <div className="ucat-product-ui min-h-[30rem] rounded-[1.25rem] bg-[#e8eaed] p-3 text-[#1a1a1a] shadow-[0_22px_70px_rgba(10,41,65,0.14)] ring-1 ring-black/[0.08] sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-black/42">
            Choose how to practice
          </p>
          <h4 className="mt-1 text-lg font-semibold">Build a useful session</h4>
        </div>
        <div className="flex rounded-full bg-white p-1 shadow-sm ring-1 ring-black/[0.05]" role="tablist" aria-label="Practice preview mode">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={activeTab === tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-full px-3 py-1.5 text-[10px] font-semibold ${activeTab === tab ? "bg-[#0a2941] text-white" : "text-black/48"}`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "Practice" ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <section className="rounded-[1.1rem] bg-white p-4 shadow-sm ring-1 ring-black/[0.055]">
            <div className="flex items-center gap-2 text-xs font-semibold">
              <Filter className="size-4 text-[#0a2941]" aria-hidden /> Focus
            </div>
            <div className="mt-4 space-y-2">
              {[
                ["Section", "Verbal Reasoning"],
                ["Question type", "Reading Comprehension"],
                ["Performance", "Questions previously incorrect"],
                ["Questions", "16"],
              ].map(([label, value]) => (
                <button key={label} type="button" className="flex w-full items-center justify-between gap-3 rounded-xl bg-[#f2f3f4] px-3 py-2.5 text-left">
                  <span className="text-[9px] uppercase tracking-wider text-black/38">{label}</span>
                  <span className="flex items-center gap-1 text-[10px] font-semibold">{value}<ChevronRight className="size-3 text-black/30" aria-hidden /></span>
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-[1.1rem] bg-white p-4 shadow-sm ring-1 ring-black/[0.055]">
            <div className="flex items-center gap-2 text-xs font-semibold">
              <Clock3 className="size-4 text-[#0a2941]" aria-hidden /> Timing
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {[false, true].map((isTimed) => (
                <button
                  key={String(isTimed)}
                  type="button"
                  onClick={() => setTimed(isTimed)}
                  aria-pressed={timed === isTimed}
                  className={`rounded-xl border p-3 text-left ${timed === isTimed ? "border-[#0a2941] bg-[#e8eaed]" : "border-black/[0.08]"}`}
                >
                  <p className="text-[11px] font-semibold">{isTimed ? "Timed" : "Untimed"}</p>
                  <p className="mt-1 text-[9px] leading-relaxed text-black/43">{isTimed ? "Set your pace against UCAT timing." : "Take the time you need to learn."}</p>
                </button>
              ))}
            </div>
            <div className="mt-4 rounded-xl bg-[#f2f3f4] p-3">
              <div className="flex items-center justify-between text-[10px]"><span>UCAT exam pace</span><strong>{timed ? "0.75×" : "No limit"}</strong></div>
              <div className="mt-3 h-1.5 rounded-full bg-black/10"><div className={`h-full rounded-full bg-[#0a2941] ${timed ? "w-3/4" : "w-0"}`} /></div>
            </div>
            <button type="button" className="mt-4 w-full rounded-xl bg-[#0a2941] px-4 py-3 text-[11px] font-semibold text-white">Start practice</button>
          </section>
        </div>
      ) : (
        <section className="mt-4 rounded-[1.1rem] bg-white p-4 shadow-sm ring-1 ring-black/[0.055]">
          <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-xs font-semibold"><FileStack className="size-4 text-[#0a2941]" aria-hidden /> Sets and mocks</span><span className="text-[10px] text-black/40">Timed and untimed</span></div>
          <div className="mt-4 space-y-2.5">
            {[
              ["Verbal Reasoning full set 04", "29 questions · 22 min", "Set"],
              ["Quantitative Reasoning pacing set", "36 questions · 26 min", "Set"],
              ["Full UCAT mock 03", "Complete exam simulation", "Mock"],
              ["Full UCAT mock 04", "Complete exam simulation", "Mock"],
            ].map(([title, meta, type]) => (
              <button key={title} type="button" className="flex w-full items-center gap-3 rounded-xl border border-black/[0.07] p-3 text-left transition-colors hover:bg-[#f5f6f7]">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#e8eaed] text-[#0a2941]"><ListChecks className="size-4" aria-hidden /></span>
                <span className="min-w-0 flex-1"><span className="block truncate text-[11px] font-semibold">{title}</span><span className="mt-0.5 block text-[9px] text-black/42">{meta}</span></span>
                <span className="rounded-full bg-[#e8eaed] px-2 py-1 text-[9px] font-semibold">{type}</span>
                <ChevronRight className="size-3.5 text-black/30" aria-hidden />
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="mt-3 flex items-center justify-between rounded-xl bg-[#0a2941] px-4 py-2.5 text-white">
        <span className="text-[10px] font-semibold">Inside the simulator</span>
        <span className="flex items-center gap-3 text-[9px] text-white/65"><Calculator className="size-3" aria-hidden /> Calculator <Flag className="size-3" aria-hidden /> Flag <span className="rounded bg-[#fffd6f] px-1.5 py-0.5 font-semibold text-[#1b4c7d]">Navigator</span></span>
      </div>
    </div>
  );
}
