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
  Check,
  ChevronLeft,
  Flag,
  Lightbulb,
  Navigation,
} from "lucide-react";
import { DemoCursor, DemoStage } from "./demo-stage";

const REMOTE_WORK_PASSAGE =
  "A software company allowed one customer-support team to work from home for three months. The team answered roughly the same number of enquiries as before, while recorded sick days fell. However, several new employees said they found it harder to ask quick questions, and managers spent more time arranging formal check-ins. The company extended the trial rather than adopting the policy permanently. A second team working in a different office will take part next, using a shared online help channel.";

const PRACTICE_OPTIONS = [
  "The company has concluded remote work is a complete failure",
  "The company wants more evidence before making a permanent decision",
  "Managers will no longer arrange check-ins",
  "All employees prefer working from home",
] as const;

const CORRECT_OPTION_INDEX = 1;

/** Cosmetic page outline — only the first three map to real demo blocks. */
const PAGE_BLOCKS = [
  { id: "inference", label: "What is an inference question?" },
  { id: "chain", label: "Use an evidence chain" },
  { id: "practice", label: "Check your understanding" },
  { id: "hedges", label: "Spotting overstatement" },
  { id: "scope", label: "Scope shifts and soft language" },
  { id: "compare", label: "Compare competing inferences" },
  { id: "trap", label: "Common VR traps" },
  { id: "recap", label: "Lesson recap" },
] as const;

/** Progress mapped to the three real content blocks only. */
const BLOCK_PROGRESS = [18, 36, 52] as const;

export function UcatLearningPreview() {
  const reduceMotion = useReducedMotion();
  const stageRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const progressFillRef = useRef<HTMLDivElement>(null);
  const progressLabelRef = useRef<{ value: number }>({ value: BLOCK_PROGRESS[0] });
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [activeBlock, setActiveBlock] = useState(0);
  const [progressPercent, setProgressPercent] = useState<number>(
    BLOCK_PROGRESS[0],
  );

  useEffect(() => {
    if (reduceMotion) {
      setSelectedOption(CORRECT_OPTION_INDEX);
      setActiveBlock(2);
      setProgressPercent(52);
      return;
    }

    const stage = stageRef.current;
    const content = contentRef.current;
    const cursor = cursorRef.current;
    const progressFill = progressFillRef.current;
    if (!stage || !content || !cursor || !progressFill) return;

    const context = gsap.context(() => {
      const timeline = gsap.timeline({ repeat: -1 });
      timeline.set(cursor, { opacity: 0, left: 80, top: 120 });
      timeline.set(content, { y: 0 });
      timeline.set(progressFill, { width: `${BLOCK_PROGRESS[0]}%` });
      timeline.call(() => {
        setSelectedOption(null);
        setActiveBlock(0);
        progressLabelRef.current.value = BLOCK_PROGRESS[0];
        setProgressPercent(BLOCK_PROGRESS[0]);
      });

      // Scroll + progress share the same timeline slot so progress only moves while scrolling
      timeline.call(() => setActiveBlock(0));
      timeline.to(
        content,
        { y: -40, duration: 1.5, ease: "power1.inOut" },
        "scroll1",
      );
      timeline.to(
        progressLabelRef.current,
        {
          value: BLOCK_PROGRESS[1],
          duration: 1.5,
          ease: "none",
          onUpdate: () => {
            const next = Math.round(progressLabelRef.current.value);
            setProgressPercent(next);
            progressFill.style.width = `${next}%`;
          },
        },
        "scroll1",
      );
      timeline.call(() => setActiveBlock(1));
      timeline.to({}, { duration: 0.7 }); // pause — progress holds

      timeline.to(
        content,
        { y: -220, duration: 2.0, ease: "power1.inOut" },
        "scroll2",
      );
      timeline.to(
        progressLabelRef.current,
        {
          value: BLOCK_PROGRESS[2],
          duration: 2.0,
          ease: "none",
          onUpdate: () => {
            const next = Math.round(progressLabelRef.current.value);
            setProgressPercent(next);
            progressFill.style.width = `${next}%`;
          },
        },
        "scroll2",
      );
      timeline.call(() => setActiveBlock(2));
      timeline.to({}, { duration: 0.5 }); // pause before answering

      // Click correct option — progress stays put while paused on the question
      timeline.call(() => {
        const option = stage.querySelector<HTMLElement>(
          `[data-demo-learn-option="${CORRECT_OPTION_INDEX}"]`,
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
        const el = cursor.querySelector<HTMLElement>(
          "[data-demo-cursor-ripple]",
        );
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
      timeline.to({}, { duration: 2.0 }); // pause on answered question
      timeline.to(cursor, { opacity: 0, duration: 0.25 });
      timeline.to(content, { y: 0, duration: 0.7, ease: "power2.inOut" });
    }, stage);

    return () => context.revert();
  }, [reduceMotion]);

  return (
    <DemoStage>
      <div ref={stageRef} className="relative flex h-full overflow-hidden">
        <DemoCursor cursorRef={cursorRef} />

        <div className="mx-auto flex h-full w-full max-w-7xl gap-5 overflow-hidden p-4 sm:p-5">
          <div className="min-w-0 flex-1 overflow-hidden">
            <div ref={contentRef} className="will-change-transform">
              <header className="mb-4">
                <p className="flex flex-wrap items-center gap-1.5 text-xs text-black/45 sm:text-sm">
                  <ChevronLeft className="size-3.5" aria-hidden />
                  <span>Learn</span>
                  <span>/</span>
                  <span>Verbal Reasoning</span>
                  <span>/</span>
                  <span className="font-medium text-black/65">
                    Inference and the Limits of Evidence
                  </span>
                </p>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                  Inference and the Limits of Evidence
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-black/55 sm:text-base">
                  Learn to distinguish supported inference from possibility,
                  assumption and overstatement.
                </p>
              </header>

              <Card className="mb-4 rounded-[1.1rem] border-black/[0.06] shadow-sm">
                <CardContent className="space-y-4 p-5 text-sm leading-relaxed sm:p-6">
                  <div>
                    <h2 className="text-lg font-semibold tracking-tight">
                      What is an inference question?
                    </h2>
                    <p className="mt-2 text-sm text-black/58 sm:text-[15px]">
                      An inference is not copied word-for-word from the passage.
                      It is the conclusion best supported by the available
                      evidence.
                    </p>
                  </div>
                  <blockquote className="rounded-lg border-l-4 border-[#92b9c6] bg-[#f2f3f4] p-4 text-sm leading-relaxed text-black/60">
                    The city reduced bus fares at the beginning of September. In
                    the same week, two new routes began serving suburbs that
                    previously had limited public transport. Passenger numbers
                    were higher in September and October than during the same
                    months the previous year. Transport officials welcomed the
                    increase but said the available data could not show how much
                    was attributable to the fare reduction and how much to the
                    new routes.
                  </blockquote>
                  <p className="text-sm text-black/55">
                    VR asks for the option{" "}
                    <strong className="text-black/75">best supported</strong>,
                    not one that is merely imaginable.
                  </p>
                </CardContent>
              </Card>

              <Card className="mb-4 rounded-[1.1rem] border-black/[0.06] shadow-sm">
                <CardContent className="space-y-3 p-5 text-sm sm:p-6">
                  <h2 className="text-lg font-semibold tracking-tight">
                    Use an evidence chain
                  </h2>
                  <p className="text-sm text-black/55">
                    Weak conclusion: “Lower fares caused the entire increase.”
                  </p>
                  <ul className="list-disc space-y-1.5 pl-5 text-sm text-black/58">
                    <li>fares fell;</li>
                    <li>routes were added;</li>
                    <li>patronage increased;</li>
                    <li>
                      the passage does not isolate which change caused how much.
                    </li>
                  </ul>
                  <div className="flex items-start gap-2.5 rounded-lg bg-[#f2f3f4] p-3.5 text-sm text-black/58">
                    <Lightbulb
                      className="mt-0.5 size-4 shrink-0 text-[#0a2941]"
                      aria-hidden
                    />
                    The more you must add from outside the passage, the weaker
                    the option.
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-3">
                <h2 className="text-lg font-semibold tracking-tight">
                  Check your understanding
                </h2>
                <div className="h-[500px] overflow-hidden rounded-lg border border-black/10 bg-white">
                  <UcatExamShell
                    sectionTitle="Verbal Reasoning"
                    sectionTitleRight="Question 1 of 1"
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
                        <UcatExamActionButton
                          icon={<Navigation className="size-4" />}
                        >
                          <span className="text-[14pt]">
                            Na<span className="underline">v</span>igator
                          </span>
                        </UcatExamActionButton>
                        <UcatExamActionButton
                          variant="highlight"
                          icon={<ArrowRight className="size-4" />}
                          iconRight
                        >
                          <span className="text-[14pt]">
                            <span className="underline">N</span>ext
                          </span>
                        </UcatExamActionButton>
                      </>
                    }
                  >
                    <div className="flex h-full min-h-0 gap-4 font-[Arial] text-[11pt] leading-relaxed">
                      <article className="h-full min-w-0 flex-[3] overflow-hidden border-r-[6px] border-[#2f608e] py-4 pr-4 sm:py-5">
                        <p>{REMOTE_WORK_PASSAGE}</p>
                      </article>
                      <section className="h-full min-w-0 flex-[2] overflow-hidden py-4 pl-2 pr-1 sm:py-5">
                        <p className="font-medium text-[12pt]">
                          Which inference is best supported by the
                          company&apos;s decision to extend rather than
                          permanently adopt the policy?
                        </p>
                        <div className="mt-3 space-y-2 pl-0 sm:pl-4">
                          {PRACTICE_OPTIONS.map((option, index) => {
                            const selected = selectedOption === index;
                            return (
                              <div
                                key={option}
                                data-demo-learn-option={index}
                                className={`flex items-start gap-2 rounded-md px-1 py-1.5 ${
                                  selected ? "bg-[#e8eaed]" : ""
                                }`}
                              >
                                <span
                                  className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border ${
                                    selected
                                      ? "border-[#0a2941] bg-[#0a2941]"
                                      : "border-black/35"
                                  }`}
                                >
                                  {selected ? (
                                    <span className="size-1.5 rounded-full bg-white" />
                                  ) : null}
                                </span>
                                <span className="min-w-0 text-[11pt] leading-snug">
                                  <span className="mr-1.5 font-semibold">
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

          <aside className="hidden w-60 shrink-0 flex-col gap-3 lg:flex xl:w-72">
            <div className="rounded-[1.1rem] bg-white p-5 shadow-sm ring-1 ring-black/[0.055]">
              <p className="text-xs font-semibold uppercase tracking-wider text-black/45">
                Progress
              </p>
              <p className="mt-1 text-3xl font-bold tabular-nums">
                {progressPercent}%
              </p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#e8eaed]">
                <div
                  ref={progressFillRef}
                  className="h-full rounded-full bg-[#0a2941]"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <p className="mt-2 text-sm text-black/45">
                {progressPercent}% complete
              </p>
            </div>
            <div className="rounded-[1.1rem] bg-white p-5 shadow-sm ring-1 ring-black/[0.055]">
              <p className="text-xs font-semibold uppercase tracking-wider text-black/45">
                On this page
              </p>
              <ol className="mt-3 space-y-1.5">
                {PAGE_BLOCKS.map((block, index) => {
                  const isRealBlock = index < 3;
                  const complete =
                    (isRealBlock && index < activeBlock) ||
                    (index === 2 && selectedOption != null);
                  const current = isRealBlock && activeBlock === index;
                  return (
                    <li
                      key={block.id}
                      className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm ${
                        current
                          ? "bg-[#e8eaed] font-semibold text-[#0a2941]"
                          : "text-black/50"
                      }`}
                    >
                      {complete ? (
                        <Check
                          className="size-3.5 shrink-0 text-[#16855b]"
                          aria-hidden
                        />
                      ) : (
                        <span className="size-3.5 shrink-0 rounded-full border border-black/25" />
                      )}
                      <span className="leading-snug">{block.label}</span>
                    </li>
                  );
                })}
              </ol>
            </div>
          </aside>
        </div>
      </div>
    </DemoStage>
  );
}
