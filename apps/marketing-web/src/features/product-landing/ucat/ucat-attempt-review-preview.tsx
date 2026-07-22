"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, Clock3, Flag, Lightbulb, X } from "lucide-react";

const reviewQuestions = [
  {
    number: 12,
    result: "incorrect",
    prompt: "Which conclusion follows from the information in the passage?",
    options: ["The trial reduced average bus journey time.", "Every commuter changed route.", "Traffic was identical each day."],
    selected: 1,
    correct: 0,
    time: "1:14",
    average: "0:48",
    explanation: "The passage directly reports a six-minute reduction in average bus journey time. It does not say that every commuter changed route, and traffic volume varied between survey days.",
  },
  {
    number: 13,
    result: "correct",
    prompt: "Which statement is best supported by the passage?",
    options: ["Passenger numbers fell.", "The route carried more passengers during the trial.", "The lane is already permanent."],
    selected: 1,
    correct: 1,
    time: "0:39",
    average: "0:44",
    explanation: "Passenger numbers increased during the trial. The passage explicitly says the decision about making the lane permanent has not yet been made.",
  },
  {
    number: 14,
    result: "not attempted",
    prompt: "Which claim cannot be determined from the passage?",
    options: ["Buses were faster during the trial.", "Passenger numbers increased.", "The bus lane caused every observed change."],
    selected: null,
    correct: 2,
    time: "0:00",
    average: "0:51",
    explanation: "The observations occurred during the same period, but the passage does not establish that the bus lane alone caused every change.",
  },
] as const;

export function UcatAttemptReviewPreview() {
  const [activeIndex, setActiveIndex] = useState(0);
  const question = reviewQuestions[activeIndex];

  return (
    <div className="ucat-product-ui min-h-[34rem] rounded-[1.25rem] bg-[#e8eaed] p-3 text-[#1a1a1a] shadow-[0_22px_70px_rgba(10,41,65,0.15)] ring-1 ring-black/[0.08] sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-black/42">Attempt review</p><h3 className="mt-1 text-lg font-semibold">Verbal Reasoning · Timed set</h3></div>
        <div className="flex items-center gap-1.5">
          {reviewQuestions.map((item, index) => (
            <button key={item.number} type="button" onClick={() => setActiveIndex(index)} aria-label={`Review question ${item.number}`} aria-pressed={activeIndex === index} className={`grid size-9 place-items-center rounded-lg text-xs font-semibold transition-all ${activeIndex === index ? "ring-2 ring-[#0a2941] ring-offset-2 ring-offset-[#e8eaed]" : "opacity-55 hover:opacity-100"} ${item.result === "correct" ? "bg-[#16855b] text-white" : item.result === "incorrect" ? "bg-[#c84444] text-white" : "bg-white text-black/55"}`}>
              {item.number}
            </button>
          ))}
        </div>
      </div>

      <section className="mt-3 rounded-[1.1rem] bg-white p-3 shadow-sm ring-1 ring-black/[0.055] sm:p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold">Question accuracy and timing</p>
            <p className="mt-0.5 text-[9px] text-black/40">Select a question to review the answer and explanation</p>
          </div>
          <div className="flex items-center gap-2 text-[9px] text-black/42"><span className="size-2 rounded-sm bg-[#16855b]" /> Correct <span className="size-2 rounded-sm bg-[#c84444]" /> Incorrect</div>
        </div>
        <div className="mt-3 flex h-14 items-end gap-1.5" aria-label="Question timing chart">
          {Array.from({ length: 15 }, (_, index) => {
            const incorrect = [2, 6, 11, 13].includes(index);
            const selected = index === activeIndex + 11;
            const height = 24 + ((index * 19) % 31);
            return (
              <button
                key={index}
                type="button"
                onClick={() => {
                  if (index >= 11 && index <= 13) setActiveIndex(index - 11);
                }}
                aria-label={`Question ${index + 1}${incorrect ? ", incorrect" : ", correct"}`}
                className={`group relative flex min-w-0 flex-1 items-end rounded-sm bg-[#e8eaed] px-0.5 pt-1 ${selected ? "ring-2 ring-[#0a2941] ring-offset-1" : ""}`}
              >
                <span className={`block w-full rounded-sm ${incorrect ? "bg-[#c84444]" : "bg-[#16855b]"}`} style={{ height }} />
                <span className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 text-[7px] text-black/35 group-hover:text-black">{index + 1}</span>
              </button>
            );
          })}
        </div>
        <div className="h-3" />
      </section>

      <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1.45fr)_minmax(14rem,0.55fr)]">
        <section className="rounded-[1.1rem] bg-white p-4 shadow-sm ring-1 ring-black/[0.055] sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${question.result === "correct" ? "bg-[#16855b]/10 text-[#126a49]" : question.result === "incorrect" ? "bg-[#c84444]/10 text-[#a52e2e]" : "bg-[#e8eaed] text-black/55"}`}>
              {question.result === "correct" ? <Check className="size-3" aria-hidden /> : question.result === "incorrect" ? <X className="size-3" aria-hidden /> : null}
              {question.result === "not attempted" ? "Not answered" : question.result === "correct" ? "Correct" : "Incorrect"}
            </span>
            <span className="flex items-center gap-1 text-[10px] text-black/42"><Flag className="size-3" aria-hidden /> Review priority · Reading comprehension</span>
          </div>
          <p className="mt-5 text-sm font-semibold leading-relaxed">{question.prompt}</p>
          <div className="mt-4 space-y-2">
            {question.options.map((option, index) => {
              const correct = index === question.correct;
              const selected = index === question.selected;
              return (
                <div key={option} className={`flex items-start gap-3 rounded-xl border p-3 text-[11px] leading-relaxed ${correct ? "border-[#16855b]/40 bg-[#16855b]/[0.06]" : selected ? "border-[#c84444]/35 bg-[#c84444]/[0.05]" : "border-black/[0.08]"}`}>
                  <span className={`grid size-6 shrink-0 place-items-center rounded-full text-[10px] font-bold ${correct ? "bg-[#16855b] text-white" : selected ? "bg-[#c84444] text-white" : "bg-[#e8eaed] text-black/45"}`}>{String.fromCharCode(65 + index)}</span>
                  <span className="flex-1">{option}</span>
                  {correct ? <span className="text-[9px] font-semibold uppercase tracking-wider text-[#126a49]">Correct</span> : selected ? <span className="text-[9px] font-semibold uppercase tracking-wider text-[#a52e2e]">Your answer</span> : null}
                </div>
              );
            })}
          </div>

          <div className="mt-4 rounded-xl bg-[#f2f3f4] p-3.5">
            <div className="flex items-center gap-2 text-[11px] font-semibold"><Lightbulb className="size-4 text-[#0a2941]" aria-hidden /> Explanation</div>
            <p className="mt-2 text-[11px] leading-relaxed text-black/58">{question.explanation}</p>
          </div>
        </section>

        <aside className="space-y-3">
          <section className="rounded-[1.1rem] bg-white p-4 shadow-sm ring-1 ring-black/[0.055]">
            <div className="flex items-center gap-2 text-xs font-semibold"><Clock3 className="size-4 text-[#0a2941]" aria-hidden /> Timing</div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div><p className="text-[9px] uppercase tracking-wider text-black/38">You</p><p className="mt-1 text-xl font-bold">{question.time}</p></div>
              <div><p className="text-[9px] uppercase tracking-wider text-black/38">Correct avg.</p><p className="mt-1 text-xl font-bold text-black/55">{question.average}</p></div>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#e8eaed]"><div className={`h-full rounded-full ${question.result === "incorrect" ? "w-[78%] bg-[#c84444]" : question.result === "correct" ? "w-[45%] bg-[#16855b]" : "w-0"}`} /></div>
            <p className="mt-2 text-[10px] leading-relaxed text-black/44">Compare time with students who answered correctly.</p>
          </section>

          <section className="rounded-[1.1rem] bg-[#0a2941] p-4 text-white shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-[0.11em] text-[#b8d2da]">What this changes</p>
            <p className="mt-3 text-sm font-semibold">Your next VR block will emphasise evidence-only conclusions.</p>
            <p className="mt-2 text-[10px] leading-relaxed text-white/55">The pattern is carried into your progress view and next plan update.</p>
          </section>

          <div className="flex items-center justify-between gap-2">
            <button type="button" onClick={() => setActiveIndex((current) => Math.max(0, current - 1))} disabled={activeIndex === 0} className="grid size-9 place-items-center rounded-xl bg-white shadow-sm ring-1 ring-black/[0.055] disabled:opacity-35" aria-label="Previous review question"><ArrowLeft className="size-4" aria-hidden /></button>
            <span className="text-[10px] text-black/42">Question {question.number}</span>
            <button type="button" onClick={() => setActiveIndex((current) => Math.min(reviewQuestions.length - 1, current + 1))} disabled={activeIndex === reviewQuestions.length - 1} className="grid size-9 place-items-center rounded-xl bg-white shadow-sm ring-1 ring-black/[0.055] disabled:opacity-35" aria-label="Next review question"><ArrowRight className="size-4" aria-hidden /></button>
          </div>
        </aside>
      </div>
    </div>
  );
}
