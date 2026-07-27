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
import { DemoCursor, DemoStage, DEMO_EASE } from "./demo-stage";

type SyllogismChoice = "yes" | "no";

type SyllogismConclusion = {
  id: string;
  text: string;
  correct: SyllogismChoice;
};

/**
 * Real Decision Making syllogism from production
 * (stem_id 475e65d9-2a30-435b-9159-f28051244983).
 */
const STEM =
  "Many foods, such as bread, potatoes, and spaghetti, contain high levels of starch. An enzyme in saliva, known as amylase, converts starch to sugar.";

const PROMPT =
  "Select Yes if the conclusion follows from the information. Select No if it does not follow.";

const CONCLUSIONS: SyllogismConclusion[] = [
  {
    id: "c1",
    text: "Spaghetti is high in starch.",
    correct: "yes",
  },
  {
    id: "c2",
    text: "A piece of bread held in the mouth for a long time becomes sweet.",
    correct: "no",
  },
  {
    id: "c3",
    text: "Amylase is a component of saliva.",
    correct: "yes",
  },
  {
    id: "c4",
    text: "Placing spaghetti in the mouth leads to the flow of saliva.",
    correct: "no",
  },
];

const START_SECONDS = 18 * 60 + 42;
const TOTAL_QUESTIONS = 29;
const QUESTION_NUMBER = 8;
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

function SyllogismToken({ choice }: { choice: SyllogismChoice }) {
  return (
    <span className="flex h-9 w-20 items-center justify-center rounded border border-black bg-white text-[11pt] font-medium">
      {choice === "yes" ? "Yes" : "No"}
    </span>
  );
}

function DraggingGhost({
  cursorRef,
  choice,
}: {
  cursorRef: React.RefObject<HTMLDivElement | null>;
  choice: SyllogismChoice;
}) {
  const [pos, setPos] = useState({ left: 0, top: 0 });

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const cursor = cursorRef.current;
      if (cursor) {
        setPos({
          left: Number.parseFloat(cursor.style.left || "0"),
          top: Number.parseFloat(cursor.style.top || "0"),
        });
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [cursorRef]);

  return (
    <span
      className="pointer-events-none absolute z-[60] opacity-95"
      style={{
        left: pos.left,
        top: pos.top,
        transform: "translate(-50%, calc(-100% - 10px))",
      }}
    >
      <SyllogismToken choice={choice} />
    </span>
  );
}

export function UcatSyllogismSimulatorPreview() {
  const stageRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [answers, setAnswers] = useState<
    Partial<Record<string, SyllogismChoice>>
  >({});
  const [draggingChoice, setDraggingChoice] = useState<SyllogismChoice | null>(
    null,
  );
  const [timeRemaining, setTimeRemaining] = useState(START_SECONDS);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncPreference = () => setPrefersReducedMotion(mediaQuery.matches);
    syncPreference();
    mediaQuery.addEventListener("change", syncPreference);
    return () => mediaQuery.removeEventListener("change", syncPreference);
  }, []);

  // Real one-second countdown; resets when the drag loop restarts.
  useEffect(() => {
    if (prefersReducedMotion) {
      setTimeRemaining(START_SECONDS);
      return;
    }
    const id = window.setInterval(() => {
      setTimeRemaining((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [prefersReducedMotion]);

  useEffect(() => {
    if (prefersReducedMotion) {
      const filled: Partial<Record<string, SyllogismChoice>> = {};
      for (const conclusion of CONCLUSIONS) {
        filled[conclusion.id] = conclusion.correct;
      }
      setAnswers(filled);
      setDraggingChoice(null);
      return;
    }

    const stage = stageRef.current;
    const cursor = cursorRef.current;
    if (!stage || !cursor) return;

    const context = gsap.context(() => {
      gsap.set(cursor, { opacity: 0, left: 80, top: 100 });
      const timeline = gsap.timeline({
        repeat: -1,
        repeatDelay: 0.8,
        onRepeat: () => {
          setAnswers({});
          setDraggingChoice(null);
          setTimeRemaining(START_SECONDS);
        },
      });

      timeline.call(() => {
        setAnswers({});
        setDraggingChoice(null);
        setTimeRemaining(START_SECONDS);
      });

      timeline.to({}, { duration: 0.6 });

      for (const conclusion of CONCLUSIONS) {
        const tokenSelector =
          conclusion.correct === "yes"
            ? "[data-syllogism-token='yes']"
            : "[data-syllogism-token='no']";
        const dropSelector = `[data-syllogism-drop='${conclusion.id}']`;

        timeline.to(cursor, {
          left: () => {
            const token = stage.querySelector<HTMLElement>(tokenSelector);
            return token ? getElementCenter(stage, token).left : 200;
          },
          top: () => {
            const token = stage.querySelector<HTMLElement>(tokenSelector);
            return token ? getElementCenter(stage, token).top : 160;
          },
          opacity: 1,
          duration: 0.55,
          ease: DEMO_GSAP_EASE,
        });

        timeline.call(() => setDraggingChoice(conclusion.correct));
        timeline.to({}, { duration: 0.2 });

        timeline.to(cursor, {
          left: () => {
            const drop = stage.querySelector<HTMLElement>(dropSelector);
            return drop ? getElementCenter(stage, drop).left : 280;
          },
          top: () => {
            const drop = stage.querySelector<HTMLElement>(dropSelector);
            return drop ? getElementCenter(stage, drop).top : 200;
          },
          duration: 0.75,
          ease: DEMO_GSAP_EASE,
        });

        timeline.call(() => {
          setDraggingChoice(null);
          setAnswers((previous) => ({
            ...previous,
            [conclusion.id]: conclusion.correct,
          }));
        });
        timeline.to({}, { duration: 0.45 });
      }

      timeline.to(cursor, { opacity: 0, duration: 0.3 });
      timeline.to({}, { duration: 1.4 });
    }, stage);

    return () => context.revert();
  }, [prefersReducedMotion]);

  return (
    <DemoStage className="h-full min-h-0 overflow-hidden rounded-[1rem] bg-white shadow-[0_16px_40px_rgba(10,41,65,0.12)] ring-1 ring-black/[0.08]">
      <div ref={stageRef} className="relative h-full min-h-0">
        <UcatExamShell
          sectionTitle="Decision Making"
          sectionTitleRight={
            <span className="block text-right font-[Tahoma] leading-tight">
              <span className="block tabular-nums">
                Time Remaining {formatClock(timeRemaining)}
              </span>
              <span className="block tabular-nums">
                Question {QUESTION_NUMBER} of {TOTAL_QUESTIONS}
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
              <UcatExamActionButton icon={<ArrowLeft className="size-4" />}>
                <span className="text-[14pt]">
                  <span className="underline">P</span>revious
                </span>
              </UcatExamActionButton>
              <UcatExamActionButton icon={<Navigation className="size-4" />}>
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
          {/*
            Decision Making uses sectionDisplayColumns = 1 in ucat-web:
            stem stacked above the prompt / conclusions / Yes–No bank.
          */}
          <div className="h-full overflow-hidden font-[Arial] text-[11pt] leading-relaxed [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="space-y-3 px-1 py-3 sm:space-y-4 sm:py-4">
              <article>
                <p>{STEM}</p>
              </article>

              <section className="space-y-3">
                <p className="font-medium text-[12pt]">{PROMPT}</p>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
                  <div className="min-w-0 flex-1 space-y-2.5">
                    {CONCLUSIONS.map((conclusion) => {
                      const choice = answers[conclusion.id] ?? null;
                      return (
                        <div
                          key={conclusion.id}
                          className="flex items-stretch gap-2 sm:gap-3"
                        >
                          <div className="flex min-h-[44px] min-w-0 flex-1 items-center justify-center rounded border border-black bg-white px-2.5 text-center text-[10pt] leading-snug sm:px-3 sm:text-[11pt]">
                            {conclusion.text}
                          </div>
                          <div
                            data-syllogism-drop={conclusion.id}
                            className="flex h-11 w-[4.75rem] shrink-0 items-center justify-center rounded border border-dashed border-[#4b5563] bg-slate-50 sm:h-12 sm:w-24"
                          >
                            {choice ? <SyllogismToken choice={choice} /> : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="w-full shrink-0 rounded border border-black bg-[#dfdfdf] px-1.5 py-2 sm:mt-0.5 sm:w-[139px] sm:px-2">
                    <div className="flex flex-row items-center justify-center gap-2 sm:flex-col">
                      <span data-syllogism-token="yes">
                        <SyllogismToken choice="yes" />
                      </span>
                      <span data-syllogism-token="no">
                        <SyllogismToken choice="no" />
                      </span>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </UcatExamShell>

        {prefersReducedMotion ? null : (
          <>
            <DemoCursor cursorRef={cursorRef} />
            {draggingChoice ? (
              <DraggingGhost cursorRef={cursorRef} choice={draggingChoice} />
            ) : null}
          </>
        )}
      </div>
    </DemoStage>
  );
}
