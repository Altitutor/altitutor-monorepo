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
  /** Quick syllogism: tile being dragged with the cursor */
  draggingChoice?: "yes" | "no";
  /** Quick syllogism: tile currently in the drop box */
  droppedChoice?: "yes" | "no";
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
    {
      caption: "Drag Yes or No into the answer box.",
      target: "yes-answer",
      durationMs: 700,
    },
    {
      caption: "Drag Yes or No into the answer box.",
      target: "yes-answer",
      pressed: true,
      draggingChoice: "yes",
      durationMs: 400,
    },
    {
      caption: "Drag Yes or No into the answer box.",
      target: "drop-box",
      pressed: true,
      draggingChoice: "yes",
      durationMs: 900,
    },
    {
      caption: "Drop to submit your answer.",
      target: "drop-box",
      droppedChoice: "yes",
      durationMs: 650,
    },
    {
      caption: "The next syllogism appears automatically.",
      target: "syllogism",
      droppedChoice: "yes",
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
        "inline-flex shrink-0 items-center justify-center rounded-md border px-3 py-2 text-center text-sm font-medium transition-colors",
        active ? "bg-muted" : "bg-background",
      )}
    >
      {children}
    </div>
  );
}

function SyllogismAnswerTile({
  choice,
  target,
  faded,
}: {
  choice: "yes" | "no";
  target?: string;
  faded?: boolean;
}) {
  return (
    <span
      data-demo-target={target}
      className={cn(
        "flex h-9 w-20 items-center justify-center rounded border border-border bg-card text-sm font-medium text-card-foreground shadow-sm transition-opacity",
        faded && "opacity-40",
      )}
    >
      {choice === "yes" ? "Yes" : "No"}
    </span>
  );
}

function ResponsiveCursor({
  containerRef,
  target,
  pressed,
  draggingChoice,
}: {
  containerRef: RefObject<HTMLDivElement>;
  target?: string;
  pressed?: boolean;
  draggingChoice?: "yes" | "no";
}) {
  const [position, setPosition] = useState({ x: 0, y: 0, visible: false });
  const isDragging = Boolean(draggingChoice);

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
        // Keep tip size stable while dragging so the tile doesn’t “pop”
        scale: pressed && !isDragging ? 0.72 : 1,
        opacity: position.visible ? 1 : 0,
      }}
      transition={{
        x: { duration: isDragging ? 0.85 : 0.28, ease: "easeInOut" },
        y: { duration: isDragging ? 0.85 : 0.28, ease: "easeInOut" },
        scale: { duration: 0.18, ease: "easeOut" },
        opacity: { duration: 0.15 },
      }}
      style={{ translateX: "-2px", translateY: "-2px" }}
      aria-hidden="true"
    >
      {/* Ghost tile offset from the tip so the pointer position stays stable */}
      {draggingChoice ? (
        <motion.span
          className="absolute left-0 top-0"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.15 }}
          style={{
            translateX: "-50%",
            translateY: "calc(-100% - 10px)",
            pointerEvents: "none",
          }}
        >
          <SyllogismAnswerTile choice={draggingChoice} />
        </motion.span>
      ) : null}
      <MousePointer2 className="relative h-7 w-7 fill-background" />
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
    <div className="grid grid-cols-3 gap-2">
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
      <div className="flex min-h-64 flex-col gap-4 p-5 md:flex-row">
        <p className="min-w-0 flex-1 text-base leading-8">
          The library remained open throughout the summer so students could
          continue their research. The quiet{" "}
          <span
            data-demo-target="passage-word"
            className={cn("rounded px-1", stepIndex >= 3 && "bg-muted")}
          >
            library
          </span>{" "}
          overlooked the garden.
        </p>
        <div className="flex w-full flex-col gap-3 md:w-44 md:shrink-0">
          <p className="text-sm font-medium text-muted-foreground">Keywords</p>
          <DemoButton target="keyword" active={stepIndex >= 1}>
            library
          </DemoButton>
        </div>
      </div>
    );

  if (trainerKey === "find_concept")
    return (
      <div className="flex min-h-64 flex-col gap-4 p-5 md:flex-row">
        <p className="min-w-0 flex-1 text-base leading-8">
          The council chose to{" "}
          <span
            data-demo-target="concept-one"
            className={cn("rounded px-1", stepIndex >= 2 && "bg-muted")}
          >
            reduce waste
          </span>{" "}
          at public events. Its new bins should{" "}
          <span
            data-demo-target="concept-two"
            className={cn("rounded px-1", stepIndex >= 4 && "bg-muted")}
          >
            reduce waste
          </span>{" "}
          across the city.
        </p>
        <div
          data-demo-target="concept"
          className="flex w-full flex-col gap-2 md:w-48 md:shrink-0"
        >
          <p className="text-sm font-medium">Find: reduce waste</p>
          <p className="text-xs text-muted-foreground">
            Found {stepIndex >= 4 ? 2 : stepIndex >= 2 ? 1 : 0} of 2
          </p>
        </div>
      </div>
    );

  if (trainerKey === "quick_syllogism")
    return (
      <div className="mx-auto flex min-h-64 max-w-3xl flex-col items-center justify-center gap-6 p-5 text-center">
        <div
          data-demo-target="syllogism"
          className="space-y-3 text-base leading-7"
        >
          <p>All surgeons are doctors.</p>
          <p>All doctors have medical training.</p>
          <p className="text-lg font-medium">
            Conclusion: All surgeons have medical training.
          </p>
        </div>
        <div className="flex items-start justify-center gap-3">
          <div
            data-demo-target="drop-box"
            className={cn(
              "flex h-14 w-28 shrink-0 items-center justify-center rounded border border-dashed border-muted-foreground/50 bg-muted/30",
              (step.draggingChoice || step.droppedChoice) &&
                step.target === "drop-box" &&
                "border-primary bg-primary/10",
            )}
          >
            {step.droppedChoice && !step.draggingChoice ? (
              <SyllogismAnswerTile choice={step.droppedChoice} />
            ) : (
              <span className="text-xs text-muted-foreground">Drop answer</span>
            )}
          </div>
          <div className="w-[92px] rounded border border-border bg-muted/50 px-2 py-2">
            <div className="flex flex-col items-center gap-2">
              <SyllogismAnswerTile
                choice="yes"
                target="yes-answer"
                faded={Boolean(
                  step.draggingChoice === "yes" || step.droppedChoice === "yes",
                )}
              />
              <SyllogismAnswerTile choice="no" />
            </div>
          </div>
        </div>
      </div>
    );

  if (trainerKey === "mental_maths")
    return (
      <div className="mx-auto flex min-h-64 max-w-md flex-col items-center justify-center gap-4 p-5 text-center">
        <p
          data-demo-target="mental-question"
          className="text-2xl font-medium"
        >
          18 × 7 = ?
        </p>
        <div className="flex w-full items-stretch gap-2">
          <div
            data-demo-target="mental-answer"
            className="flex h-10 min-w-0 flex-1 items-center rounded-md border px-3 text-left text-lg"
          >
            {step.typed ?? (stepIndex > 4 ? "126" : "")}
          </div>
          <DemoButton
            target="mental-submit"
            active={step.target === "mental-submit" && step.pressed}
          >
            Submit
          </DemoButton>
        </div>
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
      <div className="flex min-h-72 flex-col gap-4 p-5 md:flex-row">
        <div
          data-demo-target="calculator-question"
          className="flex min-w-0 flex-1 flex-col items-center justify-center gap-4 text-center"
        >
          <p className="max-w-lg text-lg font-medium">
            A £24 item increases by £12. What is its new price?
          </p>
          <div className="flex w-full max-w-sm items-stretch gap-2">
            <div
              data-demo-target="calculator-answer"
              className="flex h-10 min-w-0 flex-1 items-center rounded-md border px-3 text-left text-base"
            >
              {answerText}
            </div>
            <DemoButton
              target="calculator-submit"
              active={step.target === "calculator-submit" && step.pressed}
            >
              Submit
            </DemoButton>
          </div>
        </div>
        <div className="w-full space-y-2 md:w-52 md:shrink-0">
          <div
            data-demo-target="calculator-display"
            className="h-11 rounded-md border px-3 py-2 text-right font-mono text-lg"
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
    <div className="flex min-h-72 flex-col gap-4 p-5 md:flex-row">
      <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-4 text-center">
        <div className="space-y-2">
          <p className="text-sm font-medium">Target sequence</p>
          <p
            data-demo-target="numpad-target"
            className="text-4xl font-semibold tracking-wide"
          >
            23+4
          </p>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">Your entry</p>
          <div className="flex min-h-10 min-w-[8rem] items-center justify-center font-mono text-lg">
            {entered || (
              <span className="text-sm text-muted-foreground">…</span>
            )}
          </div>
        </div>
        <DemoButton
          target="numpad-submit"
          active={step.target === "numpad-submit" && step.pressed}
        >
          Submit
        </DemoButton>
      </div>
      <div className="w-full md:w-52 md:shrink-0">
        <NumberPad prefix="numpad-" activeKey={step.activeKey} />
      </div>
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
        draggingChoice={step.draggingChoice}
      />
    </section>
  );
}
