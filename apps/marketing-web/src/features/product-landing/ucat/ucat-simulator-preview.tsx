"use client";

import { useEffect, useRef, useState } from "react";
import { UcatExamActionButton, UcatExamShell } from "@altitutor/ui";
import { gsap } from "gsap";
import {
  ArrowLeft,
  ArrowRight,
  Calculator,
  Flag,
  Navigation,
} from "lucide-react";
import clsx from "clsx";
import { DemoCursor, DemoStage, DEMO_EASE } from "./demo-stage";

type SimulatorQuestion = {
  number: number;
  passage: string[];
  prompt: string;
  options: readonly [string, string, string, string];
  correctIndex: number;
  timeRemainingSeconds: number;
};

const PASSAGE = [
  "In 2021, the coastal city of Bellhaven began a three-year trial called Fix First. Residents could take small household appliances to one of six repair hubs, where technicians assessed whether an item could be repaired, recycled or returned to its owner unchanged. The council funded the assessment, but owners paid for replacement parts. The scheme was intended to reduce waste, although its organisers also wanted to collect evidence about why products were discarded.",
  "The hubs recorded 18,400 visits in their first 18 months. Of the items assessed, 46% were repaired during the first appointment and a further 19% were repaired after a part was ordered. In 21% of cases, repair was considered possible but uneconomic because the required labour or part cost more than a comparable new item. The remaining items included products for which no suitable part was available, as well as appliances judged unsafe to repair.",
  "Fix First found that availability of parts varied sharply between product types. Bellhaven later introduced a voluntary “repairable by design” label for manufacturers that agreed to supply selected spare parts for seven years and publish repair information.",
  "A university team cautioned against treating repair rates as a direct measure of environmental benefit because the study did not track how long repaired items remained in use.",
] as const;

const QUESTIONS: SimulatorQuestion[] = [
  {
    number: 12,
    timeRemainingSeconds: 18 * 60 + 42,
    passage: [...PASSAGE],
    prompt:
      "According to the passage, why were some items classed as possible to repair but not repaired?",
    options: [
      "The cost of labour or parts exceeded the cost of a comparable new item",
      "No suitable replacement part could be obtained",
      "Technicians considered the items unsafe to repair",
      "The council would not pay for the initial assessment",
    ],
    correctIndex: 0,
  },
  {
    number: 13,
    timeRemainingSeconds: 18 * 60 + 18,
    passage: [...PASSAGE],
    prompt:
      "Which of the following can most reliably be concluded from the university team’s caution?",
    options: [
      "Most repaired appliances failed again within a year",
      "The repairable-by-design label had no effect on manufacturers",
      "Repair rates alone do not prove how much waste was permanently avoided",
      "Bellhaven’s council should stop funding assessments",
    ],
    correctIndex: 2,
  },
  {
    number: 14,
    timeRemainingSeconds: 17 * 60 + 55,
    passage: [...PASSAGE],
    prompt:
      "The “repairable by design” label most directly addresses which problem identified in the trial?",
    options: [
      "Unsafe appliances being brought to hubs",
      "Uneven availability of spare parts across product types",
      "Residents refusing to pay for assessments",
      "Universities opposing all repair schemes",
    ],
    correctIndex: 1,
  },
];

const TOTAL_QUESTIONS = 29;
const DEMO_GSAP_EASE = `cubic-bezier(${DEMO_EASE.join(", ")})`;

function formatClock(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.max(0, totalSeconds % 60);
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function getElementCenter(
  stage: HTMLElement,
  target: HTMLElement,
): { left: number; top: number } {
  const stageRect = stage.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  return {
    left: targetRect.left - stageRect.left + targetRect.width / 2 - 4,
    top: targetRect.top - stageRect.top + targetRect.height / 2 - 2,
  };
}

function appendClickRipple(
  timeline: gsap.core.Timeline,
  cursor: HTMLDivElement,
): void {
  const ripple = cursor.querySelector<HTMLElement>("[data-demo-cursor-ripple]");
  if (!ripple) return;

  timeline
    .set(ripple, { opacity: 0.85, scale: 0.35 })
    .to(ripple, {
      opacity: 0,
      scale: 2.4,
      duration: 0.4,
      ease: "power2.out",
    });
}

export function UcatSimulatorPreview({ bleed = false }: { bleed?: boolean }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const nextButtonRef = useRef<HTMLSpanElement>(null);
  const optionRefs = useRef<(HTMLLabelElement | null)[]>([]);
  const timerRef = useRef({ seconds: QUESTIONS[0]!.timeRemainingSeconds });

  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(
    QUESTIONS[0]!.timeRemainingSeconds,
  );

  const question = QUESTIONS[questionIndex]!;

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncPreference = () => {
      setPrefersReducedMotion(mediaQuery.matches);
    };

    syncPreference();
    mediaQuery.addEventListener("change", syncPreference);
    return () => mediaQuery.removeEventListener("change", syncPreference);
  }, []);

  useEffect(() => {
    if (prefersReducedMotion) {
      setQuestionIndex(0);
      setSelectedOption(QUESTIONS[0]!.correctIndex);
      setTimeRemaining(QUESTIONS[0]!.timeRemainingSeconds);
      return;
    }

    const stage = stageRef.current;
    const cursor = cursorRef.current;
    if (!stage || !cursor) return;

    timerRef.current.seconds = QUESTIONS[0]!.timeRemainingSeconds;
    setQuestionIndex(0);
    setSelectedOption(null);
    setTimeRemaining(QUESTIONS[0]!.timeRemainingSeconds);

    const context = gsap.context(() => {
      gsap.set(cursor, { opacity: 0, left: 40, top: 120 });
      const timeline = gsap.timeline({ repeat: -1, repeatDelay: 0.45 });

      for (let index = 0; index < QUESTIONS.length; index += 1) {
        const item = QUESTIONS[index]!;

        timeline.call(() => {
          setQuestionIndex(index);
          setSelectedOption(null);
          timerRef.current.seconds = item.timeRemainingSeconds;
          setTimeRemaining(item.timeRemainingSeconds);
        });

        // Tick the clock down while the student “reads”
        timeline.to(timerRef.current, {
          seconds: item.timeRemainingSeconds - 12,
          duration: 1.1,
          ease: "none",
          onUpdate: () => setTimeRemaining(Math.round(timerRef.current.seconds)),
        });

        timeline.to(cursor, {
          left: () => {
            const option = optionRefs.current[item.correctIndex];
            return option ? getElementCenter(stage, option).left : 140;
          },
          top: () => {
            const option = optionRefs.current[item.correctIndex];
            return option ? getElementCenter(stage, option).top : 200;
          },
          opacity: 1,
          duration: 0.6,
          ease: DEMO_GSAP_EASE,
        });

        appendClickRipple(timeline, cursor);
        timeline.call(() => setSelectedOption(item.correctIndex));

        timeline.to(timerRef.current, {
          seconds: "-=6",
          duration: 0.85,
          ease: "none",
          onUpdate: () => setTimeRemaining(Math.round(timerRef.current.seconds)),
        });

        if (index < QUESTIONS.length - 1) {
          timeline.to(cursor, {
            left: () => {
              const next = nextButtonRef.current;
              return next ? getElementCenter(stage, next).left : 300;
            },
            top: () => {
              const next = nextButtonRef.current;
              return next ? getElementCenter(stage, next).top : 380;
            },
            duration: 0.55,
            ease: DEMO_GSAP_EASE,
          });
          appendClickRipple(timeline, cursor);
          timeline.to({}, { duration: 0.25 });
        } else {
          timeline.to(cursor, {
            opacity: 0,
            duration: 0.3,
            ease: "power1.out",
          });
        }
      }
    }, stage);

    return () => {
      context.revert();
    };
  }, [prefersReducedMotion]);

  return (
    <DemoStage
      className={clsx(
        bleed
          ? "min-h-[520px] rounded-none bg-[#f6f7f9] ring-0 shadow-none"
          : "rounded-[1.25rem] bg-white shadow-[0_22px_70px_rgba(10,41,65,0.15)] ring-1 ring-black/[0.08]",
      )}
    >
      <div ref={stageRef} className="relative h-full min-h-0">
        <UcatExamShell
          sectionTitle="Verbal Reasoning"
          sectionTitleRight={
            <span className="block text-right font-[Tahoma] leading-tight">
              <span className="block tabular-nums">
                Time Remaining {formatClock(timeRemaining)}
              </span>
              <span className="block tabular-nums">
                Question {question.number} of {TOTAL_QUESTIONS}
              </span>
            </span>
          }
          toolLeft={
            <span className="inline-flex items-center gap-1">
              <Calculator className="size-4" aria-hidden />
              <span className="text-[13pt]">
                <span className="underline">C</span>alculator
              </span>
            </span>
          }
          toolRight={
            <span className="inline-flex items-center gap-1">
              <Flag className="size-4" aria-hidden />
              <span className="text-[13pt]">
                <span className="underline">F</span>lag for Review
              </span>
            </span>
          }
          footerRight={
            <>
              {question.number > 1 ? (
                <UcatExamActionButton icon={<ArrowLeft className="size-4" />}>
                  <span className="text-[14pt]">
                    <span className="underline">P</span>revious
                  </span>
                </UcatExamActionButton>
              ) : null}
              <UcatExamActionButton icon={<Navigation className="size-4" />}>
                <span className="text-[14pt]">
                  Na<span className="underline">v</span>igator
                </span>
              </UcatExamActionButton>
              <span
                ref={nextButtonRef}
                data-simulator-next=""
                className="inline-flex"
              >
                <UcatExamActionButton
                  variant="highlight"
                  icon={<ArrowRight className="size-4" />}
                  iconRight
                >
                  <span className="text-[14pt]">
                    <span className="underline">N</span>ext
                  </span>
                </UcatExamActionButton>
              </span>
            </>
          }
        >
          <div
            key={question.number}
            className="flex h-full min-h-0 gap-4 font-[Arial] text-[11pt] leading-relaxed animate-in fade-in duration-300"
          >
            <article className="h-full min-w-0 flex-[3] overflow-y-auto border-r-[6px] border-[#2f608e] py-4 pr-4 sm:py-5">
              {question.passage.map((paragraph) => (
                <p key={paragraph.slice(0, 48)} className="mt-3 first:mt-0">
                  {paragraph}
                </p>
              ))}
            </article>

            <section className="h-full min-w-0 flex-[2] overflow-y-auto py-4 pl-2 pr-1 sm:py-5">
              <p className="font-medium text-[12pt]">{question.prompt}</p>
              <div className="mt-3 space-y-2 pl-0 sm:pl-6">
                {question.options.map((option, index) => {
                  const selected = selectedOption === index;
                  return (
                    <label
                      key={option}
                      ref={(element) => {
                        optionRefs.current[index] = element;
                      }}
                      data-simulator-option={index}
                      className="flex items-start gap-2"
                    >
                      <input
                        type="radio"
                        name="marketing-ucat-question"
                        checked={selected}
                        readOnly
                        tabIndex={-1}
                        className="mt-1 size-4"
                      />
                      <span className="flex min-w-0">
                        <span className="inline-block w-6 shrink-0 sm:w-8">
                          {String.fromCharCode(65 + index)}.
                        </span>
                        <span className="ml-0 min-w-0 sm:ml-4">{option}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </section>
          </div>
        </UcatExamShell>

        {prefersReducedMotion ? null : <DemoCursor cursorRef={cursorRef} />}
      </div>
    </DemoStage>
  );
}
