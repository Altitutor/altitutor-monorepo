"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { gsap } from "gsap";
import {
  Card,
  CardContent,
  UcatExamActionButton,
  UcatExamShell,
} from "@altitutor/ui";
import {
  ArrowRight,
  Calculator,
  ChevronLeft,
  Flag,
  Lightbulb,
  Navigation,
} from "lucide-react";
import { DemoCursor } from "./demo-stage";

const REMOTE_WORK_PASSAGE =
  "A software company allowed one customer-support team to work from home for three months. The team answered roughly the same number of enquiries as before, while recorded sick days fell. However, several new employees said they found it harder to ask quick questions, and managers spent more time arranging formal check-ins. The company extended the trial rather than adopting the policy permanently. A second team working in a different office will take part next, using a shared online help channel.";

const PRACTICE_OPTIONS = [
  "The company has concluded remote work is a complete failure",
  "The company wants more evidence before making a permanent decision",
  "Managers will no longer arrange check-ins",
  "All employees prefer working from home",
] as const;

const CORRECT_OPTION_INDEX = 1;

const SCROLL_STOPS = [-40, -220] as const;

type UcatLearningCardPreviewProps = {
  animate: boolean;
};

export function UcatLearningCardPreview({ animate }: UcatLearningCardPreviewProps) {
  const reduceMotion = useReducedMotion();
  const stageRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);

  useEffect(() => {
    if (!animate || reduceMotion) {
      setSelectedOption(CORRECT_OPTION_INDEX);
      return;
    }

    const stage = stageRef.current;
    const content = contentRef.current;
    const cursor = cursorRef.current;
    if (!stage || !content || !cursor) return;

    const context = gsap.context(() => {
      const timeline = gsap.timeline({ repeat: -1 });
      timeline.set(cursor, { opacity: 0, left: 80, top: 120 });
      timeline.set(content, { y: 0 });
      timeline.call(() => setSelectedOption(null));

      timeline.to(content, { y: SCROLL_STOPS[0], duration: 1.5, ease: "power1.inOut" });
      timeline.to({}, { duration: 0.7 });

      timeline.to(content, { y: SCROLL_STOPS[1], duration: 2.0, ease: "power1.inOut" });
      timeline.to({}, { duration: 0.5 });

      timeline.call(() => {
        const option = stage.querySelector<HTMLElement>(
          `[data-demo-learn-card-option="${CORRECT_OPTION_INDEX}"]`,
        );
        if (!option) return;
        const stageRect = stage.getBoundingClientRect();
        const optionRect = option.getBoundingClientRect();
        gsap.set(cursor, {
          left: optionRect.left - stageRect.left + optionRect.width / 2 - 4,
          top: optionRect.top - stageRect.top + optionRect.height / 2 - 2,
          opacity: 1,
        });
      });
      timeline.to(cursor, { opacity: 1, duration: 0.2 });
      timeline.call(() => {
        const el = cursor.querySelector<HTMLElement>("[data-demo-cursor-ripple]");
        if (!el) return;
        gsap
          .timeline()
          .set(el, { opacity: 0.85, scale: 0.35 })
          .to(el, {
            opacity: 0,
            scale: 2.2,
            duration: 0.35,
            ease: "power2.out",
          });
      });
      timeline.call(() => setSelectedOption(CORRECT_OPTION_INDEX));
      timeline.to({}, { duration: 2.0 });
      timeline.to(cursor, { opacity: 0, duration: 0.25 });
      timeline.to(content, { y: 0, duration: 0.7, ease: "power2.inOut" });
    }, stage);

    return () => context.revert();
  }, [animate, reduceMotion]);

  return (
    <div
      ref={stageRef}
      className="ucat-product-ui pointer-events-none relative min-w-0 select-none overflow-hidden bg-[#f4f5f7] text-[#1a1a1a]"
      aria-hidden
    >
      <DemoCursor cursorRef={cursorRef} />

      <div className="relative h-[22rem] overflow-hidden sm:h-[24rem]">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-10 h-14 bg-gradient-to-b from-[#f4f5f7] via-[#f4f5f7]/85 to-transparent sm:h-16"
          aria-hidden
        />

        <div ref={contentRef} className="will-change-transform">
          <div className="px-5 pb-4 pt-3 sm:px-6 sm:pt-4">
            <header className="mb-3">
              <p className="flex flex-wrap items-center gap-1 text-[11px] text-black/45 sm:text-xs">
                <ChevronLeft className="size-3" aria-hidden />
                <span>Learn</span>
                <span>/</span>
                <span>Verbal Reasoning</span>
                <span>/</span>
                <span className="font-medium text-black/65">
                  Inference and the Limits of Evidence
                </span>
              </p>
              <h3 className="mt-1.5 text-lg font-semibold tracking-tight sm:text-xl">
                Inference and the Limits of Evidence
              </h3>
              <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-black/55 sm:text-sm">
                Learn to distinguish supported inference from possibility,
                assumption and overstatement.
              </p>
            </header>

            <Card className="mb-3 rounded-[1rem] border-black/[0.06] shadow-sm">
              <CardContent className="space-y-3 p-4 text-xs leading-relaxed sm:p-4 sm:text-sm">
                <div>
                  <h4 className="text-base font-semibold tracking-tight">
                    What is an inference question?
                  </h4>
                  <p className="mt-1.5 text-black/58">
                    An inference is not copied word-for-word from the passage. It
                    is the conclusion best supported by the available evidence.
                  </p>
                </div>
                <blockquote className="rounded-lg border-l-4 border-[#92b9c6] bg-[#eef0f3] p-3 text-xs leading-relaxed text-black/60 sm:text-sm">
                  The city reduced bus fares at the beginning of September. In
                  the same week, two new routes began serving suburbs that
                  previously had limited public transport. Passenger numbers were
                  higher in September and October than during the same months the
                  previous year.
                </blockquote>
              </CardContent>
            </Card>

            <Card className="mb-3 rounded-[1rem] border-black/[0.06] shadow-sm">
              <CardContent className="space-y-2.5 p-4 text-xs sm:p-4 sm:text-sm">
                <h4 className="text-base font-semibold tracking-tight">
                  Use an evidence chain
                </h4>
                <p className="text-black/55">
                  Weak conclusion: &ldquo;Lower fares caused the entire
                  increase.&rdquo;
                </p>
                <div className="flex items-start gap-2 rounded-lg bg-[#eef0f3] p-3 text-black/58">
                  <Lightbulb
                    className="mt-0.5 size-3.5 shrink-0 text-[#0a2941]"
                    aria-hidden
                  />
                  The more you must add from outside the passage, the weaker the
                  option.
                </div>
              </CardContent>
            </Card>

            <div className="space-y-3">
              <h4 className="text-base font-semibold tracking-tight">
                Check your understanding
              </h4>
              <div className="h-[17.5rem] overflow-hidden rounded-lg border border-black/10 bg-white sm:h-[19rem]">
                <UcatExamShell
                  sectionTitle="Verbal Reasoning"
                  sectionTitleRight="Question 1 of 1"
                  toolLeft={
                    <span className="inline-flex items-center gap-1">
                      <Calculator className="size-3.5" aria-hidden />
                      <span className="text-[11pt]">
                        <span className="underline">C</span>alculator
                      </span>
                    </span>
                  }
                  toolRight={
                    <span className="inline-flex items-center gap-1">
                      <Flag className="size-3.5" aria-hidden />
                      <span className="text-[11pt]">
                        <span className="underline">F</span>lag for Review
                      </span>
                    </span>
                  }
                  footerRight={
                    <>
                      <UcatExamActionButton icon={<Navigation className="size-3.5" />}>
                        <span className="text-[12pt]">
                          Na<span className="underline">v</span>igator
                        </span>
                      </UcatExamActionButton>
                      <UcatExamActionButton
                        variant="highlight"
                        icon={<ArrowRight className="size-3.5" />}
                        iconRight
                      >
                        <span className="text-[12pt]">
                          <span className="underline">N</span>ext
                        </span>
                      </UcatExamActionButton>
                    </>
                  }
                >
                  <div className="flex h-full min-h-0 gap-3 font-[Arial] text-[10pt] leading-relaxed sm:gap-4 sm:text-[11pt]">
                    <article className="h-full min-w-0 flex-[3] overflow-hidden border-r-[5px] border-[#2f608e] py-3 pr-3 sm:py-4 sm:pr-4">
                      <p>{REMOTE_WORK_PASSAGE}</p>
                    </article>
                    <section className="h-full min-w-0 flex-[2] overflow-hidden py-3 pl-1 pr-2 sm:py-4">
                      <p className="font-medium text-[11pt]">
                        Which inference is best supported by the company&apos;s
                        decision to extend rather than permanently adopt the policy?
                      </p>
                      <div className="mt-2 space-y-1.5 pl-0 sm:pl-2">
                        {PRACTICE_OPTIONS.map((option, index) => {
                          const selected = selectedOption === index;
                          return (
                            <div
                              key={option}
                              data-demo-learn-card-option={index}
                              className={`flex items-start gap-1.5 rounded-md px-1 py-1 ${
                                selected ? "bg-[#e8eaed]" : ""
                              }`}
                            >
                              <span
                                className={`mt-0.5 grid size-3.5 shrink-0 place-items-center rounded-full border sm:size-4 ${
                                  selected
                                    ? "border-[#0a2941] bg-[#0a2941]"
                                    : "border-black/35"
                                }`}
                              >
                                {selected ? (
                                  <span className="size-1 rounded-full bg-white" />
                                ) : null}
                              </span>
                              <span className="min-w-0 text-[10pt] leading-snug sm:text-[11pt]">
                                <span className="mr-1 font-semibold">
                                  {String.fromCharCode(65 + index)}.
                                </span>
                                {option}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  </div>
                </UcatExamShell>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
