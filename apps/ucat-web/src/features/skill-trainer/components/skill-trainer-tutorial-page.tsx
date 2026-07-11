"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import {
  ArrowLeft,
  Check,
  Keyboard,
  MousePointer2,
  Play,
  RotateCcw,
} from "lucide-react";
import { trainerKeyToSlug } from "@altitutor/shared";
import type { UcatSkillTrainerKey } from "@altitutor/shared";
import { Button } from "@/components/ui/button";
import { UcatPageHeader } from "@/features/layout";
import { useCompleteOnboardingTour } from "@/features/onboarding";
import { getSkillTrainerTutorialId } from "@/features/onboarding/lib/skill-trainer-tutorial";
import { skillTrainerApi } from "@/features/skill-trainer/api/skill-trainer-api";
import { useActiveSkillTrainerAttempt } from "@/features/skill-trainer/context/active-skill-trainer-attempt-context";
import { SKILL_TRAINER_INSTRUCTIONS } from "@/features/skill-trainer/lib/instructions";
import {
  UCAT_PRIMARY_ACTION_BUTTON,
  UCAT_SURFACE_CARD,
} from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";

const TRAINER_NAMES: Record<UcatSkillTrainerKey, string> = {
  find_word: "Find a Word",
  find_concept: "Find the Concept",
  quick_syllogism: "Quick Syllogism",
  mental_maths: "Mental Maths",
  calculator_maths: "Calculator Maths",
  numpad_speed: "Numpad Speed",
};

const DEMO_CAPTIONS: Record<UcatSkillTrainerKey, string[]> = {
  find_word: [
    "Select a keyword.",
    "Find the same word in the passage.",
    "Click the word to place it.",
  ],
  find_concept: [
    "Read the concept you need to find.",
    "Click each place where it appears.",
    "Continue until every occurrence is selected.",
  ],
  quick_syllogism: [
    "Read the premises and conclusion.",
    "Decide whether the conclusion follows.",
    "Select Yes or No to submit.",
  ],
  mental_maths: [
    "Work out the answer mentally.",
    "Type the answer in the field.",
    "Press Enter or select Submit.",
  ],
  calculator_maths: [
    "Read the question and plan the calculation.",
    "Use the on-screen calculator.",
    "Enter the final answer and submit.",
  ],
  numpad_speed: [
    "Read the target sequence from left to right.",
    "Press the matching calculator keys in order.",
    "Press Enter or select Submit.",
  ],
};

function DemoPointer({
  x,
  y,
  pressed = false,
}: {
  x: number;
  y: number;
  pressed?: boolean;
}) {
  return (
    <motion.div
      className="pointer-events-none absolute z-20 text-foreground drop-shadow-md"
      animate={{ x, y, scale: pressed ? 0.78 : 1 }}
      transition={{ type: "spring", stiffness: 190, damping: 22 }}
      aria-hidden="true"
    >
      <MousePointer2 className="h-7 w-7 fill-background" />
    </motion.div>
  );
}

function DemoButton({
  children,
  active,
}: {
  children: ReactNode;
  active?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-md border px-3 py-2 text-center text-sm font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "bg-background",
      )}
    >
      {children}
    </div>
  );
}

function TrainerDemo({
  trainerKey,
  phase,
}: {
  trainerKey: UcatSkillTrainerKey;
  phase: number;
}) {
  if (trainerKey === "find_word") {
    return (
      <div className="relative grid min-h-64 gap-4 p-5 sm:grid-cols-[1fr_11rem]">
        <p className="rounded-lg border bg-background p-4 text-base leading-8">
          The library remained open throughout the summer so students could
          continue their research. The quiet{" "}
          <span
            className={cn(
              "rounded px-1",
              phase >= 2 && "bg-primary text-primary-foreground",
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
          <DemoButton active={phase >= 1}>library</DemoButton>
        </div>
        <DemoPointer
          x={phase === 0 ? 260 : phase === 1 ? 330 : 145}
          y={phase === 0 ? 190 : phase === 1 ? 86 : 137}
          pressed={phase === 1 || phase === 2}
        />
      </div>
    );
  }

  if (trainerKey === "find_concept") {
    return (
      <div className="relative grid min-h-64 gap-4 p-5 sm:grid-cols-[1fr_12rem]">
        <p className="rounded-lg border bg-background p-4 text-base leading-8">
          The council chose to{" "}
          <span
            className={cn(
              "rounded px-1",
              phase >= 1 && "bg-primary text-primary-foreground",
            )}
          >
            reduce waste
          </span>{" "}
          at public events. Its new bins should{" "}
          <span
            className={cn(
              "rounded px-1",
              phase >= 2 && "bg-primary text-primary-foreground",
            )}
          >
            reduce waste
          </span>{" "}
          across the city.
        </p>
        <div className="rounded-lg border bg-background p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Concept
          </p>
          <p className="mt-3 font-semibold">reduce waste</p>
          <p className="mt-4 text-xs text-muted-foreground">
            Found {Math.max(0, phase)} of 2
          </p>
        </div>
        <DemoPointer
          x={phase < 2 ? 120 : 280}
          y={phase < 2 ? 88 : 137}
          pressed={phase > 0}
        />
      </div>
    );
  }

  if (trainerKey === "quick_syllogism") {
    return (
      <div className="relative min-h-64 space-y-4 p-5">
        <div className="rounded-lg border bg-background p-4 text-sm">
          <p>All painters are artists. Some artists are teachers.</p>
          <p className="mt-3 font-semibold">
            Conclusion: Some painters are teachers.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <DemoButton>Yes</DemoButton>
          <DemoButton active={phase >= 2}>No</DemoButton>
        </div>
        <DemoPointer
          x={phase < 2 ? 250 : 390}
          y={phase < 2 ? 70 : 190}
          pressed={phase >= 2}
        />
      </div>
    );
  }

  if (trainerKey === "mental_maths") {
    return (
      <div className="relative flex min-h-64 flex-col items-center justify-center gap-5 p-5">
        <p className="text-3xl font-semibold">18 × 7 = ?</p>
        <div className="h-11 w-44 rounded-md border bg-background px-3 py-2 text-center text-lg">
          {phase >= 1 ? "126" : ""}
        </div>
        <DemoButton active={phase >= 2}>Submit</DemoButton>
        <DemoPointer
          x={phase < 2 ? 280 : 285}
          y={phase < 2 ? 120 : 185}
          pressed={phase >= 2}
        />
      </div>
    );
  }

  const sequence =
    trainerKey === "calculator_maths"
      ? ["2", "4", "×", "1", ".", "5"]
      : ["7", "2", "9", "+"];
  const activeKey =
    phase === 1 ? sequence[0] : phase === 2 ? sequence[1] : null;
  return (
    <div className="relative grid min-h-64 gap-4 p-5 sm:grid-cols-[1fr_15rem]">
      <div className="rounded-lg border bg-background p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {trainerKey === "calculator_maths" ? "Question" : "Target sequence"}
        </p>
        <p className="mt-5 text-2xl font-semibold">
          {trainerKey === "calculator_maths"
            ? "A £24 item increases by 50%. What is its new price?"
            : "7  2  9  +"}
        </p>
      </div>
      <div className="grid grid-cols-3 gap-2 rounded-lg border bg-background p-3">
        {["7", "8", "9", "4", "5", "6", "1", "2", "3", ".", "0", "+"].map(
          (key) => (
            <DemoButton key={key} active={key === activeKey}>
              {key}
            </DemoButton>
          ),
        )}
      </div>
      <DemoPointer
        x={phase === 0 ? 120 : phase === 1 ? 365 : 455}
        y={phase === 0 ? 80 : phase === 1 ? 70 : 165}
        pressed={phase > 0}
      />
    </div>
  );
}

export function SkillTrainerTutorialPage({
  trainerKey,
}: {
  trainerKey: UcatSkillTrainerKey;
}) {
  const router = useRouter();
  const { setLocal } = useActiveSkillTrainerAttempt();
  const completeTour = useCompleteOnboardingTour();
  const [phase, setPhase] = useState(0);
  const [replayKey, setReplayKey] = useState(0);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const slug = trainerKeyToSlug(trainerKey);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setPhase((current) => (current + 1) % 3);
    }, 1800);
    return () => window.clearInterval(interval);
  }, [replayKey]);

  async function startTrainer() {
    setStarting(true);
    setError(null);
    try {
      await completeTour.mutateAsync(getSkillTrainerTutorialId(trainerKey));
      const state = await skillTrainerApi.startAttempt(trainerKey);
      setLocal(state);
      router.replace(
        `/skill-trainer/${slug}/play?attemptId=${state.attempt.id}`,
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not start the trainer.",
      );
      setStarting(false);
    }
  }

  return (
    <div className="space-y-6">
      <UcatPageHeader
        title={`${TRAINER_NAMES[trainerKey]} tutorial`}
        description="Watch the example, then start when you are ready. No timer is running during this tutorial."
        backHref={`/skill-trainer/${slug}`}
        backLabel={`Back to ${TRAINER_NAMES[trainerKey]}`}
      />

      <section
        className={cn("overflow-hidden rounded-ucatShell", UCAT_SURFACE_CARD)}
      >
        <div className="border-b px-5 py-4">
          <p className="text-sm font-semibold">How to play</p>
          <motion.p
            key={`${replayKey}-${phase}`}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-1 text-sm text-muted-foreground"
          >
            {DEMO_CAPTIONS[trainerKey][phase]}
          </motion.p>
        </div>
        <TrainerDemo key={replayKey} trainerKey={trainerKey} phase={phase} />
        <div className="flex items-center justify-between border-t px-5 py-3">
          <div
            className="flex gap-1.5"
            aria-label={`Animation step ${phase + 1} of 3`}
          >
            {[0, 1, 2].map((step) => (
              <span
                key={step}
                className={cn(
                  "h-1.5 w-8 rounded-full",
                  step === phase ? "bg-primary" : "bg-muted",
                )}
              />
            ))}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setPhase(0);
              setReplayKey((key) => key + 1);
            }}
          >
            <RotateCcw className="mr-2 h-4 w-4" /> Replay animation
          </Button>
        </div>
      </section>

      <section className={cn("rounded-ucatShell p-5", UCAT_SURFACE_CARD)}>
        <h2 className="flex items-center gap-2 font-semibold">
          <Keyboard className="h-4 w-4" /> Remember
        </h2>
        <ol className="mt-3 space-y-2">
          {SKILL_TRAINER_INSTRUCTIONS[trainerKey].map((instruction) => (
            <li
              key={instruction}
              className="flex gap-2 text-sm text-muted-foreground"
            >
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              {instruction}
            </li>
          ))}
        </ol>
      </section>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(`/skill-trainer/${slug}`)}
          disabled={starting}
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <Button
          type="button"
          className={UCAT_PRIMARY_ACTION_BUTTON}
          onClick={() => void startTrainer()}
          disabled={starting}
        >
          <Play className="mr-2 h-4 w-4" />
          {starting ? "Starting…" : "Start trainer"}
        </Button>
      </div>
    </div>
  );
}
