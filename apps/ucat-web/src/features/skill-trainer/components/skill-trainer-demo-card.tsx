"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import { motion } from "motion/react";
import { MousePointer2 } from "lucide-react";
import type { UcatSkillTrainerKey } from "@altitutor/shared";
import { UCAT_SURFACE_CARD } from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";

type DemoStep = {
  caption: string;
  target?: string;
  pressed?: boolean;
  typed?: string;
  activeKey?: string;
  durationMs?: number;
};

function calculatorKeySteps(
  prefix: string,
  entries: Array<{ key: string; typed: string }>,
): DemoStep[] {
  return entries.flatMap(({ key, typed }) => {
    const target = `${prefix}${key === "+" ? "plus" : key}`;
    return [
      {
        caption: "Enter the whole sequence in order.",
        target,
        durationMs: 450,
      },
      {
        caption: "Enter the whole sequence in order.",
        target,
        pressed: true,
        typed,
        activeKey: key,
        durationMs: 350,
      },
    ];
  });
}

const DEMO_STEPS: Record<UcatSkillTrainerKey, DemoStep[]> = {
  find_word: [
    { caption: "Select a keyword.", target: "keyword" },
    { caption: "Select a keyword.", target: "keyword", pressed: true },
    { caption: "Find the same word in the passage.", target: "passage-word" },
    {
      caption: "Click the matching word to place it.",
      target: "passage-word",
      pressed: true,
    },
    {
      caption: "The correctly placed word is confirmed.",
      target: "passage-word",
    },
  ],
  find_concept: [
    {
      caption: "Read the concept, then find every occurrence.",
      target: "concept",
    },
    {
      caption: "Click the first occurrence.",
      target: "concept-one",
    },
    {
      caption: "Click the first occurrence.",
      target: "concept-one",
      pressed: true,
    },
    { caption: "Continue looking through the passage.", target: "concept-two" },
    {
      caption: "Click the next occurrence.",
      target: "concept-two",
      pressed: true,
    },
    {
      caption: "Continue until every occurrence is selected.",
      target: "concept",
    },
  ],
  quick_syllogism: [
    { caption: "Read the premises and conclusion.", target: "syllogism" },
    { caption: "Decide whether the conclusion follows.", target: "no-answer" },
    {
      caption: "Select Yes or No to submit.",
      target: "no-answer",
      pressed: true,
    },
    {
      caption: "The next syllogism appears automatically.",
      target: "syllogism",
    },
  ],
  mental_maths: [
    { caption: "Work out the answer mentally.", target: "mental-question" },
    {
      caption: "Click the answer field.",
      target: "mental-answer",
      pressed: true,
    },
    {
      caption: "Type the answer.",
      target: "mental-answer",
      typed: "1",
      durationMs: 300,
    },
    {
      caption: "Type the answer.",
      target: "mental-answer",
      typed: "12",
      durationMs: 300,
    },
    {
      caption: "Type the answer.",
      target: "mental-answer",
      typed: "126",
      durationMs: 450,
    },
    { caption: "Select Submit to move on.", target: "mental-submit" },
    {
      caption: "Select Submit to move on.",
      target: "mental-submit",
      pressed: true,
    },
  ],
  calculator_maths: [
    {
      caption: "Click the question area to begin.",
      target: "calculator-question",
      pressed: true,
    },
    {
      caption: "Click the calculator to switch focus.",
      target: "calculator-display",
      durationMs: 600,
    },
    {
      caption: "Click the calculator to switch focus.",
      target: "calculator-display",
      pressed: true,
      durationMs: 400,
    },
    ...calculatorKeySteps("calculator-", [
      { key: "2", typed: "2" },
      { key: "4", typed: "24" },
      { key: "+", typed: "24+" },
      { key: "1", typed: "24+1" },
      { key: "2", typed: "24+12" },
    ]).map((step) => ({
      ...step,
      caption: "Type the calculation using the calculator.",
    })),
    {
      caption: "Enter the final answer below the question.",
      target: "calculator-answer",
      typed: "3",
      durationMs: 300,
    },
    {
      caption: "Enter the final answer below the question.",
      target: "calculator-answer",
      typed: "36",
      durationMs: 450,
    },
    { caption: "Select Submit to move on.", target: "calculator-submit" },
    {
      caption: "Select Submit to move on.",
      target: "calculator-submit",
      pressed: true,
    },
  ],
  numpad_speed: [
    {
      caption: "Read the target sum from left to right.",
      target: "numpad-target",
    },
    ...calculatorKeySteps("numpad-", [
      { key: "2", typed: "2" },
      { key: "3", typed: "23" },
      { key: "+", typed: "23+" },
      { key: "4", typed: "23+4" },
    ]),
    {
      caption: "Select Submit when the sequence is complete.",
      target: "numpad-submit",
    },
    {
      caption: "Select Submit when the sequence is complete.",
      target: "numpad-submit",
      pressed: true,
    },
  ],
};

function DemoButton({
  children,
  active,
  target,
}: {
  children: ReactNode;
  active?: boolean;
  target?: string;
}) {
  return (
    <div
      data-demo-target={target}
      data-demo-active={active || undefined}
      className={cn(
        "rounded-md border px-3 py-2 text-center text-sm font-medium transition-colors",
        active ? "bg-muted" : "bg-background",
      )}
    >
      {children}
    </div>
  );
}

function ResponsiveCursor({
  containerRef,
  target,
  pressed,
}: {
  containerRef: RefObject<HTMLDivElement>;
  target?: string;
  pressed?: boolean;
}) {
  const [position, setPosition] = useState({ x: 0, y: 0, visible: false });

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !target) {
      setPosition((current) => ({ ...current, visible: false }));
      return;
    }
    const update = () => {
      const element = container.querySelector<HTMLElement>(
        `[data-demo-target="${target}"]`,
      );
      if (!element) return;
      const containerRect = container.getBoundingClientRect();
      const targetRect =
        element.getClientRects()[0] ?? element.getBoundingClientRect();
      setPosition({
        x: targetRect.left - containerRect.left + targetRect.width / 2,
        y: targetRect.top - containerRect.top + targetRect.height / 2,
        visible: true,
      });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [containerRef, target]);

  return (
    <motion.div
      data-demo-cursor
      className="pointer-events-none absolute left-0 top-0 z-20 text-foreground drop-shadow-md"
      animate={{
        x: position.x,
        y: position.y,
        scale: pressed ? 0.72 : 1,
        opacity: position.visible ? 1 : 0,
      }}
      transition={{ duration: 0.25, ease: "easeInOut" }}
      style={{ translateX: "-2px", translateY: "-2px" }}
      aria-hidden="true"
    >
      <MousePointer2 className="h-7 w-7 fill-background" />
    </motion.div>
  );
}

function NumberPad({
  activeKey,
  prefix,
}: {
  activeKey?: string;
  prefix: string;
}) {
  return (
    <div className="grid grid-cols-3 gap-2 rounded-lg border bg-background p-3">
      {["7", "8", "9", "4", "5", "6", "1", "2", "3", ".", "0", "+"].map(
        (key) => (
          <DemoButton
            key={key}
            target={`${prefix}${key === "+" ? "plus" : key}`}
            active={key === activeKey}
          >
            {key}
          </DemoButton>
        ),
      )}
    </div>
  );
}

function TrainerDemo({
  trainerKey,
  step,
  stepIndex,
}: {
  trainerKey: UcatSkillTrainerKey;
  step: DemoStep;
  stepIndex: number;
}) {
  if (trainerKey === "find_word")
    return (
      <div className="grid min-h-64 gap-4 p-5 sm:grid-cols-[1fr_11rem]">
        <p className="rounded-lg border bg-background p-4 text-base leading-8">
          The library remained open throughout the summer so students could
          continue their research. The quiet{" "}
          <span
            data-demo-target="passage-word"
            className={cn(
              "rounded px-1",
              stepIndex >= 3 && "bg-muted",
            )}
          >
            library
          </span>{" "}
          overlooked the garden.
        </p>
        <div className="space-y-3 rounded-lg border bg-background p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Words to find
          </p>
          <DemoButton target="keyword" active={stepIndex >= 1}>
            library
          </DemoButton>
        </div>
      </div>
    );

  if (trainerKey === "find_concept")
    return (
      <div className="grid min-h-64 gap-4 p-5 sm:grid-cols-[1fr_12rem]">
        <p className="rounded-lg border bg-background p-4 text-base leading-8">
          The council chose to{" "}
          <span
            data-demo-target="concept-one"
            className={cn(
              "rounded px-1",
              stepIndex >= 2 && "bg-muted",
            )}
          >
            reduce waste
          </span>{" "}
          at public events. Its new bins should{" "}
          <span
            data-demo-target="concept-two"
            className={cn(
              "rounded px-1",
              stepIndex >= 4 && "bg-muted",
            )}
          >
            reduce waste
          </span>{" "}
          across the city.
        </p>
        <div
          data-demo-target="concept"
          className="rounded-lg border bg-background p-4"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Concept
          </p>
          <p className="mt-3 font-semibold">reduce waste</p>
          <p className="mt-4 text-xs text-muted-foreground">
            Found {stepIndex >= 4 ? 2 : stepIndex >= 2 ? 1 : 0} of 2
          </p>
        </div>
      </div>
    );

  if (trainerKey === "quick_syllogism")
    return (
      <div className="min-h-64 space-y-4 p-5">
        <div
          data-demo-target="syllogism"
          className="rounded-lg border bg-background p-4 text-sm"
        >
          <p>All painters are artists. Some artists are teachers.</p>
          <p className="mt-3 font-semibold">
            Conclusion: Some painters are teachers.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <DemoButton>Yes</DemoButton>
          <DemoButton target="no-answer" active={stepIndex >= 2}>
            No
          </DemoButton>
        </div>
      </div>
    );

  if (trainerKey === "mental_maths")
    return (
      <div className="flex min-h-64 flex-col items-center justify-center gap-5 p-5">
        <p
          data-demo-target="mental-question"
          className="text-3xl font-semibold"
        >
          18 × 7 = ?
        </p>
        <div
          data-demo-target="mental-answer"
          className="h-11 w-44 rounded-md border bg-background px-3 py-2 text-center text-lg"
        >
          {step.typed ?? (stepIndex > 4 ? "126" : "")}
        </div>
        <DemoButton target="mental-submit" active={step.pressed}>
          Submit
        </DemoButton>
      </div>
    );

  if (trainerKey === "calculator_maths") {
    const elapsedSteps = DEMO_STEPS.calculator_maths.slice(0, stepIndex + 1);
    const calculatorText =
      [...elapsedSteps].reverse().find((elapsed) => elapsed.activeKey)?.typed ??
      "";
    const answerText =
      [...elapsedSteps]
        .reverse()
        .find(
          (elapsed) => elapsed.target === "calculator-answer" && elapsed.typed,
        )?.typed ?? "";
    return (
      <div className="grid min-h-72 gap-4 p-5 sm:grid-cols-[1fr_15rem]">
        <div
          data-demo-target="calculator-question"
          className="flex flex-col rounded-lg border bg-background p-4"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Question
          </p>
          <p className="mt-4 text-lg font-semibold">
            A £24 item increases by £12. What is its new price?
          </p>
          <label className="mt-auto pt-5 text-xs font-medium text-muted-foreground">
            Answer
          </label>
          <div
            data-demo-target="calculator-answer"
            className="mt-1 h-10 rounded-md border px-3 py-2 text-base"
          >
            {answerText}
          </div>
          <div className="mt-3">
            <DemoButton
              target="calculator-submit"
              active={step.target === "calculator-submit" && step.pressed}
            >
              Submit
            </DemoButton>
          </div>
        </div>
        <div className="space-y-2">
          <div
            data-demo-target="calculator-display"
            className="h-11 rounded-md border bg-background px-3 py-2 text-right font-mono text-lg"
          >
            {calculatorText}
          </div>
          <NumberPad prefix="calculator-" activeKey={step.activeKey} />
        </div>
      </div>
    );
  }

  const entered =
    [...DEMO_STEPS.numpad_speed.slice(0, stepIndex + 1)]
      .reverse()
      .find((elapsed) => elapsed.activeKey)?.typed ?? "";
  return (
    <div className="grid min-h-72 gap-4 p-5 sm:grid-cols-[1fr_15rem]">
      <div className="flex flex-col rounded-lg border bg-background p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Target sequence
        </p>
        <p
          data-demo-target="numpad-target"
          className="mt-5 text-4xl font-semibold"
        >
          23+4
        </p>
        <p className="mt-5 text-xs font-medium text-muted-foreground">
          Your entry
        </p>
        <div className="mt-1 h-11 rounded-md border px-3 py-2 font-mono text-lg">
          {entered}
        </div>
        <div className="mt-auto pt-4">
          <DemoButton
            target="numpad-submit"
            active={step.target === "numpad-submit" && step.pressed}
          >
            Submit
          </DemoButton>
        </div>
      </div>
      <NumberPad prefix="numpad-" activeKey={step.activeKey} />
    </div>
  );
}

export function SkillTrainerDemoCard({
  trainerKey,
}: {
  trainerKey: UcatSkillTrainerKey;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const steps = DEMO_STEPS[trainerKey];
  const step = steps[stepIndex];

  useEffect(() => {
    setStepIndex(0);
  }, [trainerKey]);

  useEffect(() => {
    const timeout = window.setTimeout(
      () => setStepIndex((current) => (current + 1) % steps.length),
      step.durationMs ?? 1100,
    );
    return () => window.clearTimeout(timeout);
  }, [step.durationMs, stepIndex, steps.length]);

  return (
    <section
      data-demo-card
      data-demo-active-target={step.target}
      ref={containerRef}
      className={cn(
        "relative overflow-hidden rounded-ucatShell",
        UCAT_SURFACE_CARD,
      )}
    >
      <div className="border-b px-5 py-4">
        <h2 className="text-lg font-semibold">How to play</h2>
        <motion.p
          key={step.caption}
          initial={{ opacity: 0, y: 3 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-1 text-sm text-muted-foreground"
        >
          {step.caption}
        </motion.p>
      </div>
      <TrainerDemo trainerKey={trainerKey} step={step} stepIndex={stepIndex} />
      <ResponsiveCursor
        containerRef={containerRef}
        target={step.target}
        pressed={step.pressed}
      />
    </section>
  );
}
