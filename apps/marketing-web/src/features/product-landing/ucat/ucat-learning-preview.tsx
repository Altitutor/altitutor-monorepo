"use client";

import { useState } from "react";
import {
  BookOpen,
  Check,
  ChevronRight,
  Circle,
  RotateCcw,
} from "lucide-react";

const answers = [
  "It is directly stated in the passage.",
  "It is likely, but requires an extra assumption.",
  "It cannot be determined from the information given.",
] as const;

export function UcatLearningPreview() {
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);

  return (
    <div className="ucat-product-ui min-h-[34rem] overflow-hidden rounded-[1.25rem] bg-[#e8eaed] text-[#1a1a1a] shadow-[0_22px_70px_rgba(10,41,65,0.15)] ring-1 ring-black/[0.08]">
      <header className="border-b border-black/[0.06] bg-white px-4 py-3 sm:px-6">
        <p className="text-[10px] font-medium text-black/42">
          Learn / Verbal Reasoning / Reading Comprehension
        </p>
        <div className="mt-2 flex items-end justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold">Drawing safe conclusions</h3>
            <p className="mt-0.5 text-[10px] text-black/45">
              Lesson 2 of 5 · about 12 minutes
            </p>
          </div>
          <span className="rounded-full bg-[#e8eaed] px-2.5 py-1 text-[10px] font-semibold text-[#0a2941]">
            40% complete
          </span>
        </div>
      </header>

      <div className="grid min-h-[30rem] grid-cols-[minmax(0,1fr)] lg:grid-cols-[12rem_minmax(0,1fr)]">
        <aside className="hidden border-r border-black/[0.055] bg-white p-4 lg:block">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-black/40">
            Lesson contents
          </p>
          <ol className="mt-4 space-y-2">
            {[
              ["What follows?", true],
              ["Facts and assumptions", true],
              ["Worked example", false],
              ["Check your thinking", false],
              ["Summary", false],
            ].map(([label, complete], index) => (
              <li
                key={String(label)}
                className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-[10px] ${
                  index === 2
                    ? "bg-[#e8eaed] font-semibold text-[#0a2941]"
                    : "text-black/48"
                }`}
              >
                {complete ? (
                  <Check className="size-3 text-[#16855b]" aria-hidden />
                ) : (
                  <Circle className="size-3" aria-hidden />
                )}
                {label}
              </li>
            ))}
          </ol>
        </aside>

        <div className="min-w-0 overflow-hidden p-3 sm:p-5">
          <article className="rounded-[1.1rem] bg-white p-4 shadow-sm ring-1 ring-black/[0.055] sm:p-5">
            <div className="flex items-center gap-2 text-[11px] font-semibold text-[#0a2941]">
              <BookOpen className="size-4" aria-hidden /> The evidence-only rule
            </div>
            <h4 className="mt-3 text-base font-semibold">
              A conclusion is safe only when the passage gives you enough evidence.
            </h4>
            <p className="mt-2 text-[11px] leading-relaxed text-black/56">
              Do not choose an answer because it sounds reasonable. Ask whether
              it must be true using only what you have been told.
            </p>
            <div className="mt-4 rounded-xl border-l-4 border-[#92b9c6] bg-[#f2f3f4] p-3">
              <p className="text-[10px] font-semibold">Tutor note</p>
              <p className="mt-1 text-[10px] leading-relaxed text-black/52">
                Words such as <em>all</em>, <em>only</em>, and <em>always</em>
                often turn a supported idea into an unsupported claim.
              </p>
            </div>
          </article>

          <section className="mt-3 rounded-[1.1rem] bg-white p-4 shadow-sm ring-1 ring-black/[0.055] sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.11em] text-black/42">
                  Check your thinking
                </p>
                <p className="mt-1 text-xs font-semibold">
                  Which description best fits the conclusion?
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAnswer(null)}
                className="grid size-8 place-items-center rounded-lg border border-black/10 text-black/45"
                aria-label="Reset answer"
              >
                <RotateCcw className="size-3.5" aria-hidden />
              </button>
            </div>
            <p className="mt-3 rounded-lg bg-[#f2f3f4] p-3 text-[10px] leading-relaxed text-black/58">
              The survey found that students who reviewed errors within one day
              improved more consistently. It did not compare every possible
              review schedule.
            </p>
            <div className="mt-3 grid gap-2">
              {answers.map((answer, index) => (
                <button
                  key={answer}
                  type="button"
                  onClick={() => setSelectedAnswer(index)}
                  aria-pressed={selectedAnswer === index}
                  className={`flex items-center gap-3 rounded-xl border p-3 text-left text-[10px] transition-colors ${
                    selectedAnswer === index
                      ? "border-[#0a2941] bg-[#e8eaed]"
                      : "border-black/[0.08] hover:bg-[#f5f6f7]"
                  }`}
                >
                  <span className="grid size-5 shrink-0 place-items-center rounded-full border border-black/20 text-[9px] font-semibold">
                    {String.fromCharCode(65 + index)}
                  </span>
                  <span className="flex-1">{answer}</span>
                  <ChevronRight className="size-3.5 text-black/30" aria-hidden />
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
