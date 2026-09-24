"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { gsap } from "gsap";
import { Check, Flag, Sparkles, X } from "lucide-react";
import { DemoCursor, DemoStage, demoItemVariants } from "./demo-stage";

type QuestionResult = "correct" | "incorrect";

type ReviewQuestion = {
  number: number;
  result: QuestionResult;
  timeSpentSeconds: number;
  averageTimeSeconds: number;
  stem: string;
  prompt: string;
  options: [string, string, string, string];
  selected: number;
  correct: number;
  explanation: string;
  insight: { title: string; body: string };
  categoryName: string;
};

/** Real Decision Making stems from production (text-only MCQs). */
const reviewQuestions: ReviewQuestion[] = [
  {
    number: 1,
    result: "correct",
    timeSpentSeconds: 42,
    averageTimeSeconds: 48,
    stem: "Should dogs be banned from entering national parks to avoid causing damage to native flora and fauna?",
    prompt: "Select the strongest argument from the statements below.",
    options: [
      "Yes, because dogs have been shown to destroy native animals and their habitats.",
      "Yes, because dogs are an introduced species which do not belong in national parks.",
      "No, because national parks are ideal settings to walk dogs, and the proposal is unfair to dog owners.",
      "No, because dogs could simply be controlled by leashes, rather than being banned altogether.",
    ],
    selected: 0,
    correct: 0,
    explanation:
      "A is strongest because it directly links dogs to damage of native flora and fauna — the reason given in the question — rather than fairness to owners or a weaker “introduced species” claim.",
    insight: {
      title: "Strongest argument spotted",
      body: "You matched the argument to the stated purpose of the ban, not a side issue about dog owners or leashes.",
    },
    categoryName: "Recognising Assumptions",
  },
  {
    number: 2,
    result: "incorrect",
    timeSpentSeconds: 78,
    averageTimeSeconds: 62,
    stem: "A round table discussion is held between American, British, Canadian, Danish, Eritrean and French diplomats. The six diplomats are distributed evenly around a circular table. The British diplomat is next to either the Eritrean or the French diplomat. The Canadian is directly between the French and the Eritrean representatives. The Danish diplomat is not next to the British diplomat.",
    prompt: "Which of the following must be true?",
    options: [
      "The American diplomat is next to the French diplomat.",
      "The British diplomat is next to the Eritrean diplomat.",
      "The Danish diplomat is next to the French diplomat.",
      "The Danish diplomat is next to the American diplomat.",
    ],
    selected: 1,
    correct: 3,
    explanation:
      "With Canada between France and Eritrea, Britain sits on one outer side of that trio. Denmark cannot sit next to Britain, which forces Denmark next to America.",
    insight: {
      title: "Circular seating slipped",
      body: "Britain next to Eritrea is possible, but not forced. Denmark beside America is the statement that must hold.",
    },
    categoryName: "Logical Puzzles",
  },
  {
    number: 3,
    result: "correct",
    timeSpentSeconds: 55,
    averageTimeSeconds: 50,
    stem: "Simon wants to buy a new printer. He would have to pay $25 per month for 1 year to afford Printer A. He would have to pay $75 per week for 4 weeks to afford Printer B. Printer A has an 85% chance of not breaking down. Printer B has a 25% chance of breaking down.",
    prompt:
      "Considering only the total price and the chance of breaking down, is Printer B the better choice?",
    options: [
      "Yes, Printer A has a 10-percentage-point higher chance of breaking down.",
      "Yes, Printer B is cheaper than Printer A.",
      "No, they are both the same price and have the same probability of breaking down.",
      "No, Printer A has a 10-percentage-point lower chance of breaking down.",
    ],
    selected: 3,
    correct: 3,
    explanation:
      "Both printers cost $300. Printer A’s break-down chance is 15% vs Printer B’s 25%, so A is 10 percentage points safer — B is not better.",
    insight: {
      title: "Price and risk lined up",
      body: "You converted both payment plans to the same total and compared failure rates on the same scale.",
    },
    categoryName: "Logical Puzzles",
  },
  {
    number: 4,
    result: "incorrect",
    timeSpentSeconds: 61,
    averageTimeSeconds: 54,
    stem: "Will decreasing university fees reduce unemployment levels?",
    prompt: "Select the strongest argument from the statements below.",
    options: [
      "Yes, because lower fees would leave students with more money for extracurricular activities.",
      "Yes, because more students would be able to afford university tuition.",
      "No, because unemployed people are generally less educated and may be unable to attend university.",
      "No, because unemployment depends on the availability of jobs, not simply on how many people can afford university.",
    ],
    selected: 1,
    correct: 3,
    explanation:
      "D attacks the causal link in the question: even if more people can attend university, unemployment still depends on jobs available. B only restates that fees affect enrolment.",
    insight: {
      title: "Causal link missed",
      body: "The strongest reply challenges whether fee cuts actually move unemployment — not whether more students can enrol.",
    },
    categoryName: "Recognising Assumptions",
  },
];

const CHART_BARS: Array<{ result: QuestionResult; height: number }> = [
  { result: "correct", height: 28 },
  { result: "incorrect", height: 71 },
  { result: "correct", height: 44 },
  { result: "correct", height: 33 },
  { result: "incorrect", height: 58 },
  { result: "correct", height: 51 },
  { result: "correct", height: 22 },
  { result: "incorrect", height: 66 },
  { result: "correct", height: 39 },
  { result: "incorrect", height: 47 },
  { result: "correct", height: 74 },
  { result: "correct", height: 31 },
  { result: "incorrect", height: 55 },
  { result: "correct", height: 62 },
  { result: "correct", height: 26 },
  { result: "incorrect", height: 43 },
  { result: "correct", height: 68 },
  { result: "incorrect", height: 36 },
  { result: "correct", height: 49 },
  { result: "correct", height: 57 },
  // Last four map to the detailed reviewQuestions (mixed heights from timing)
  { result: "correct", height: 41 },
  { result: "incorrect", height: 76 },
  { result: "correct", height: 53 },
  { result: "incorrect", height: 64 },
];

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function moveCursorTo(
  timeline: gsap.core.Timeline,
  stage: HTMLElement,
  cursor: HTMLElement,
  target: HTMLElement,
) {
  const stageRect = stage.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  timeline.to(cursor, {
    left: targetRect.left - stageRect.left + targetRect.width / 2 - 4,
    top: targetRect.top - stageRect.top + targetRect.height / 2 - 2,
    opacity: 1,
    duration: 0.5,
    ease: "power2.inOut",
  });
}

export function UcatAttemptReviewPreview() {
  const reduceMotion = useReducedMotion();
  const stageRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const question = reviewQuestions[activeIndex]!;
  const chartStartIndex = CHART_BARS.length - reviewQuestions.length;

  useEffect(() => {
    if (reduceMotion) return;
    const stage = stageRef.current;
    const cursor = cursorRef.current;
    if (!stage || !cursor) return;

    const context = gsap.context(() => {
      const timeline = gsap.timeline({ repeat: -1 });
      timeline.set(cursor, { opacity: 0, left: 60, top: 40 });

      for (let index = 0; index < reviewQuestions.length; index += 1) {
        const bar = stage.querySelector<HTMLElement>(
          `[data-demo-review-bar="${index}"]`,
        );
        if (!bar) continue;
        moveCursorTo(timeline, stage, cursor, bar);
        const ripple = cursor.querySelector<HTMLElement>(
          "[data-demo-cursor-ripple]",
        );
        if (ripple) {
          timeline
            .set(ripple, { opacity: 0.85, scale: 0.35 })
            .to(ripple, {
              opacity: 0,
              scale: 2.2,
              duration: 0.3,
              ease: "power2.out",
            });
        }
        timeline.call(() => setActiveIndex(index));
        timeline.to({}, { duration: 2.6 });
      }

      timeline.to(cursor, { opacity: 0, duration: 0.25 });
    }, stage);

    return () => context.revert();
  }, [reduceMotion]);

  return (
    <DemoStage>
      <div ref={stageRef} className="relative space-y-5 p-5 sm:p-6">
        <DemoCursor cursorRef={cursorRef} />

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-black/42">
            Attempt review
          </p>
          <h3 className="mt-1 text-xl font-semibold sm:text-2xl">
            Decision Making · Timed set
          </h3>
        </div>

        <section className="rounded-[1.15rem] bg-white p-5 shadow-sm ring-1 ring-black/[0.055]">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-base font-semibold">Question attempts</p>
              <p className="mt-0.5 text-sm text-black/42">
                Timing view · select a question to review
              </p>
            </div>
            <div className="flex items-center gap-3 text-sm text-black/42">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-[#16855b]" /> Correct
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-[#c84444]" /> Incorrect
              </span>
            </div>
          </div>
          <div className="mt-5 flex h-28 items-end gap-1 sm:h-32">
            {CHART_BARS.map((bar, index) => {
              const reviewIndex = index - chartStartIndex;
              const isReviewBar = reviewIndex >= 0;
              const selected = isReviewBar && reviewIndex === activeIndex;
              return (
                <div
                  key={index}
                  data-demo-review-bar={isReviewBar ? reviewIndex : undefined}
                  className={`relative flex min-w-0 flex-1 items-end rounded-sm px-0.5 pt-1 ${
                    selected ? "bg-[#0a2941]/15" : "bg-[#e8eaed]"
                  }`}
                >
                  <span
                    className={`block w-full rounded-sm ${
                      bar.result === "correct" ? "bg-[#16855b]" : "bg-[#c84444]"
                    }`}
                    style={{ height: bar.height }}
                  />
                </div>
              );
            })}
          </div>
        </section>

        <motion.div
          key={activeIndex}
          className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]"
          variants={demoItemVariants}
          initial={reduceMotion ? false : "hidden"}
          animate="show"
        >
          <section className="rounded-[1.15rem] bg-white p-5 sm:p-6 shadow-sm ring-1 ring-black/[0.055]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold text-black/50">
                Question {question.number} of {reviewQuestions.length}
              </span>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                  question.result === "correct"
                    ? "bg-[#16855b]/10 text-[#126a49]"
                    : "bg-[#c84444]/10 text-[#a52e2e]"
                }`}
              >
                {question.result === "correct" ? (
                  <Check className="size-3.5" aria-hidden />
                ) : (
                  <X className="size-3.5" aria-hidden />
                )}
                {question.result === "correct" ? "Correct" : "Incorrect"}
              </span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-black/60 sm:text-[15px]">
              {question.stem}
            </p>
            <p className="mt-4 text-base font-semibold leading-snug sm:text-lg">
              {question.prompt}
            </p>
            <div className="mt-4 space-y-2.5">
              {question.options.map((option, index) => {
                const isCorrect = index === question.correct;
                const isSelected = index === question.selected;
                return (
                  <div
                    key={option}
                    className={`flex items-start gap-3 rounded-xl border p-3.5 text-sm leading-snug ${
                      isCorrect
                        ? "border-[#16855b]/40 bg-[#16855b]/[0.06]"
                        : isSelected
                          ? "border-[#c84444]/35 bg-[#c84444]/[0.05]"
                          : "border-black/[0.08]"
                    }`}
                  >
                    <span
                      className={`grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold ${
                        isCorrect
                          ? "bg-[#16855b] text-white"
                          : isSelected
                            ? "bg-[#c84444] text-white"
                            : "bg-[#e8eaed] text-black/45"
                      }`}
                    >
                      {String.fromCharCode(65 + index)}
                    </span>
                    <span className="flex-1">{option}</span>
                  </div>
                );
              })}
            </div>
          </section>

          <aside className="space-y-3.5">
            <section className="rounded-[1.15rem] bg-gradient-to-br from-[#0a2941] to-[#163a52] p-5 text-white shadow-sm">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#b8d2da]">
                <Sparkles className="size-3.5" aria-hidden /> Question insight
              </div>
              <p className="mt-3 text-lg font-semibold">
                {question.insight.title}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-white/65">
                {question.insight.body}
              </p>
            </section>
            <section className="rounded-[1.15rem] bg-white p-5 shadow-sm ring-1 ring-black/[0.055]">
              <p className="text-base font-semibold">Answer explanation</p>
              <p className="mt-2 text-sm leading-relaxed text-black/58">
                {question.explanation}
              </p>
            </section>
            <section className="rounded-[1.15rem] bg-white p-5 shadow-sm ring-1 ring-black/[0.055]">
              <p className="text-base font-semibold">Question timing</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-black/38">
                    You
                  </p>
                  <p className="mt-1 text-2xl font-bold tabular-nums">
                    {formatTime(question.timeSpentSeconds)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-black/38">
                    Correct avg.
                  </p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-black/55">
                    {formatTime(question.averageTimeSeconds)}
                  </p>
                </div>
              </div>
            </section>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-[#e8eaed] px-3 py-1.5 text-xs font-medium text-[#0a2941]">
                Decision Making
              </span>
              <span className="rounded-full bg-[#e8eaed] px-3 py-1.5 text-xs font-medium text-[#0a2941]">
                {question.categoryName}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#e8eaed] px-3 py-1.5 text-xs font-medium text-[#0a2941]">
                <Flag className="size-3" aria-hidden /> Timed set
              </span>
            </div>
          </aside>
        </motion.div>
      </div>
    </DemoStage>
  );
}
