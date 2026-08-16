"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import clsx from "clsx";
import {
  EmbeddedCalculator,
  UcatExamActionButton,
  UcatExamShell,
  UcatFloatingPanel,
} from "@altitutor/ui";
import {
  ArrowLeft,
  ArrowRight,
  Calculator,
  Flag,
  MousePointer2,
  Navigation,
} from "lucide-react";
import { DemoStage, DEMO_EASE } from "./demo-stage";
import {
  SIMULATOR_CARD_DESIGN_HEIGHT,
  SIMULATOR_CARD_DESIGN_WIDTH,
  ScaleToFitFrame,
} from "./scale-to-fit-frame";

const CARD_CHROME =
  "rounded-[1.25rem] bg-white shadow-sm ring-1 ring-black/[0.055]";

const SPOTLIGHT_RING = "ring-1 ring-white/20";
const SPOTLIGHT_DIM = "shadow-[0_0_0_9999px_rgba(3,8,16,0.58)]";

const WALKTHROUGH_QR = {
  stem:
    "In April, a council's three air-quality monitoring teams collected 3,000 filter samples. Harbour collected 40% of all samples. Hillside collected 25% more samples than Riverside.",
  prompt: "How many samples did the Riverside team collect?",
  options: ["720", "800", "1,000", "1,200", "1,800"],
} as const;

const WALKTHROUGH_TOTAL_STEPS = 4;

const WALKTHROUGH_STEPS = [
  {
    title: "Open the calculator",
    body: "Open the calculator from the toolbar or press Alt+C.",
    spotlight: "calculator" as const,
    icon: Calculator,
  },
  {
    title: "Try the calculator",
    body: "Enter this calculation step by step on the calculator:",
    calculationLines: ["3000 − 1200 =", "1800 ÷ 2.25 ="],
    spotlight: "calculator-panel" as const,
    icon: Calculator,
  },
] as const;

const CALCULATOR_SEQUENCE = ["3000", "3000-", "3000-1200", "1800", "1800/", "1800/2.25", "800"];

function formatClock(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.max(0, totalSeconds % 60);
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

export function MarketingLearnGuidedWalkthroughPreview({
  animate,
}: {
  animate: boolean;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const [calcDisplay, setCalcDisplay] = useState("0");
  const step = WALKTHROUGH_STEPS[stepIndex] ?? WALKTHROUGH_STEPS[0];
  const StepIcon = step.icon;
  const progressPct = Math.round(
    ((stepIndex + 1) / WALKTHROUGH_TOTAL_STEPS) * 100,
  );
  const calculatorOpen = step.spotlight === "calculator-panel";

  useEffect(() => {
    if (!animate) return;
    const id = window.setInterval(() => {
      setStepIndex((value) => (value + 1) % WALKTHROUGH_STEPS.length);
    }, 3600);
    return () => window.clearInterval(id);
  }, [animate]);

  useEffect(() => {
    if (!animate || step.spotlight !== "calculator-panel") {
      setCalcDisplay("0");
      return;
    }

    let index = 0;
    setCalcDisplay(CALCULATOR_SEQUENCE[0] ?? "0");
    const id = window.setInterval(() => {
      index = (index + 1) % CALCULATOR_SEQUENCE.length;
      setCalcDisplay(CALCULATOR_SEQUENCE[index] ?? "0");
    }, 650);
    return () => window.clearInterval(id);
  }, [animate, step.spotlight]);

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-[1.25rem]">
      <ScaleToFitFrame
        designWidth={SIMULATOR_CARD_DESIGN_WIDTH}
        designHeight={SIMULATOR_CARD_DESIGN_HEIGHT}
        fitMode="contain"
        className="size-full"
      >
        <DemoStage className="size-full min-h-0 overflow-hidden rounded-none bg-white shadow-none ring-0">
          <div className="relative size-full min-h-0">
            <UcatExamShell
                sectionTitle="Quantitative Reasoning"
                sectionTitleRight={
                  <span className="block text-right font-[Tahoma] leading-tight">
                    <span className="block tabular-nums">
                      Time Remaining {formatClock(15 * 60 + 48)}
                    </span>
                    <span className="block tabular-nums">Question 3 of 36</span>
                  </span>
                }
                toolLeft={
                  <span
                    data-tour="question-engine-calculator"
                    className={clsx(
                      "inline-flex items-center gap-1",
                      step.spotlight !== undefined && "opacity-0",
                    )}
                  >
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
                <div className="flex h-full min-h-0 gap-4 font-[Arial] text-[11pt] leading-relaxed">
                  <article className="h-full min-w-0 flex-[3] overflow-hidden border-r-[6px] border-[#2f608e]/70 py-4 pr-4">
                    <p>{WALKTHROUGH_QR.stem}</p>
                  </article>
                  <section className="h-full min-w-0 flex-[2] overflow-hidden py-4 pl-2">
                    <p className="font-medium text-[12pt]">{WALKTHROUGH_QR.prompt}</p>
                    <div className="mt-3 space-y-2 pl-4">
                      {WALKTHROUGH_QR.options.map((option, index) => (
                        <label key={option} className="flex items-start gap-2">
                          <input
                            type="radio"
                            name="walkthrough-qr-option"
                            readOnly
                            tabIndex={-1}
                            className="mt-1 size-4"
                          />
                          <span className="flex min-w-0">
                            <span className="inline-block w-6 shrink-0">
                              {String.fromCharCode(65 + index)}.
                            </span>
                            <span className="ml-4 min-w-0">{option}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </section>
                </div>
              </UcatExamShell>

              {step.spotlight === "calculator" || calculatorOpen ? (
                <div className="absolute inset-0 z-40 pointer-events-none" aria-hidden>
                  {step.spotlight === "calculator" ? (
                    <div
                      className={clsx(
                        "absolute left-3 top-[3.35rem] inline-flex items-center gap-1 rounded-md bg-[#2f608e] px-1 py-0.5 text-white",
                        SPOTLIGHT_RING,
                        SPOTLIGHT_DIM,
                      )}
                    >
                      <Calculator className="size-4" aria-hidden />
                      <span className="text-[13pt]">
                        <span className="underline">C</span>alculator
                      </span>
                    </div>
                  ) : null}
                  {calculatorOpen ? (
                    <div
                      className={clsx(
                        "absolute right-3 top-[4.75rem] w-[280px] rounded-md",
                        SPOTLIGHT_RING,
                        SPOTLIGHT_DIM,
                      )}
                      data-tour="question-engine-calculator-panel"
                    >
                      <UcatFloatingPanel
                        title="Calculator"
                        titleIcon={<Calculator className="size-5" />}
                        className="w-full"
                      >
                        <EmbeddedCalculator
                          display={calcDisplay}
                          onKey={() => {}}
                          active
                          captureKeyboardAlways={false}
                        />
                      </UcatFloatingPanel>
                    </div>
                  ) : null}
                </div>
              ) : null}

            <div className="absolute bottom-3 left-3 z-50 w-[min(300px,calc(100%-1.5rem))]">
              <div
                className={clsx(
                  CARD_CHROME,
                  "relative overflow-hidden border-black/[0.08] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.28)]",
                )}
                role="dialog"
                aria-label={step.title}
              >
                <div className="absolute inset-x-4 top-0 h-0.5 overflow-hidden rounded-full bg-[#0a2941]/10">
                  <motion.div
                    className="h-full rounded-full bg-[#0a2941]"
                    animate={{ width: `${progressPct}%` }}
                    transition={{ duration: 0.3, ease: DEMO_EASE }}
                  />
                </div>

                <AnimatePresence mode="wait">
                  <motion.div
                    key={step.title}
                    initial={animate ? { opacity: 0, x: 8 } : false}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.2, ease: DEMO_EASE }}
                    className="pt-2"
                  >
                    <div className="flex items-start gap-2.5">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#0a2941]/10 text-[#0a2941]">
                        <StepIcon className="size-4" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0a2941]">
                          Step {stepIndex + 1} of {WALKTHROUGH_TOTAL_STEPS}
                        </p>
                        <h4 className="mt-0.5 text-base font-semibold leading-snug tracking-tight">
                          {step.title}
                        </h4>
                      </div>
                    </div>
                    <p className="mt-3 text-[13px] leading-relaxed text-black/70">
                      {step.body}
                    </p>
                    {"calculationLines" in step ? (
                      <div className="mt-3 space-y-1.5 rounded-lg bg-[#0a2941]/[0.07] px-3 py-2.5 font-mono text-[12px] font-semibold text-[#0a2941]">
                        {step.calculationLines.map((line) => (
                          <p key={line}>{line}</p>
                        ))}
                        <p className="pt-0.5 text-[11px] font-medium text-black/50">
                          Result: 800
                        </p>
                      </div>
                    ) : null}
                    <div className="mt-3 flex items-center gap-2 rounded-lg bg-[#0a2941]/[0.07] px-2.5 py-2 text-[12px] font-medium text-[#0a2941]">
                      <MousePointer2
                        className="size-3.5 shrink-0 motion-safe:animate-pulse"
                        aria-hidden
                      />
                      Use the highlighted control to continue
                    </div>
                    <div className="mt-3 flex items-center justify-end gap-2">
                      <span className="rounded-md bg-[#0a2941] px-2.5 py-1 text-[12px] font-medium text-white">
                        Next
                      </span>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </DemoStage>
      </ScaleToFitFrame>
    </div>
  );
}
