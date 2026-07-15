"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@altitutor/ui";
import {
  ArrowRight,
  Calculator,
  Check,
  Flag,
  ListChecks,
  Sparkles,
} from "lucide-react";
import { QuestionEnginePage } from "@/features/question-engine/components/question-engine-page";
import { UCAT_QUESTION_ENGINE_TOUR } from "@/features/onboarding/config/tour-steps";
import { useCompleteOnboardingTour } from "@/features/onboarding/hooks/use-onboarding-progress";
import {
  UCAT_GUIDED_SAMPLER_COMPLETED,
  UCAT_GUIDED_SAMPLER_DECIDED,
} from "@/features/onboarding/lib/activation-milestones";
import { patchSignupProgress } from "@/features/signup-onboarding/api/signup-progress";
import type { UcatFamiliarity } from "@/features/signup-onboarding/components/steps/sampler-step";
import { SIGNUP_STEP } from "@/features/signup-onboarding/lib/steps";
import { GUIDED_SAMPLER_SECTIONS } from "@/features/signup-onboarding/lib/guided-sampler-questions";
import { cn } from "@/lib/utils";

type SeenControl = "calculator" | "flag" | "navigator" | "previous";

function parseFamiliarity(value: string | null): UcatFamiliarity | null {
  return value === "new" || value === "familiar" || value === "experienced"
    ? value
    : null;
}

function coachPrompt(
  sectionKey: (typeof GUIDED_SAMPLER_SECTIONS)[number]["key"],
  familiarity: UcatFamiliarity,
): string {
  if (familiarity === "experienced") {
    return "Answer naturally. The real UCAT controls are available if you need them.";
  }
  if (sectionKey === "vr") {
    return familiarity === "new"
      ? "Choose an answer, use Next, then try Previous once before you finish."
      : "Use Next and Previous to move between the two questions.";
  }
  if (sectionKey === "dm") {
    return familiarity === "new"
      ? "Flag a question, then open the Navigator to see how review works."
      : "Try Flag or Navigator before you finish the section.";
  }
  if (sectionKey === "qr") {
    return familiarity === "new"
      ? "Open Calculator (Alt+C), calculate 18 × 4, then close it and answer."
      : "Calculator is available from the toolbar or with Alt+C.";
  }
  return familiarity === "new"
    ? "Notice that Situational Judgement asks about appropriateness and importance. Review both answers before finishing."
    : "Read the response scale carefully before choosing.";
}

function FamiliarityEntry({
  onChoose,
}: {
  onChoose: (value: UcatFamiliarity) => void;
}) {
  return (
    <main className="grid min-h-dvh place-items-center bg-slate-950 px-4 py-10 text-white">
      <div className="w-full max-w-3xl rounded-3xl border border-white/10 bg-white/[0.05] p-6 shadow-2xl sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">
          Guided UCAT sampler
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          Let’s get you ready for your first UCAT session
        </h1>
        <p className="mt-3 max-w-2xl text-white/65">
          Answer two questions from each section while we show you the exam
          controls. About 6 minutes.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {(
            [
              ["new", "Completely new", "Show every essential control."],
              ["familiar", "Know the format", "Give me short prompts."],
              ["experienced", "Already practising", "Keep guidance minimal."],
            ] as const
          ).map(([value, title, description]) => (
            <button
              key={value}
              type="button"
              onClick={() => onChoose(value)}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left transition hover:border-sky-300/50 hover:bg-sky-300/10"
            >
              <span className="font-semibold">{title}</span>
              <span className="mt-1 block text-sm text-white/55">
                {description}
              </span>
            </button>
          ))}
        </div>
        <p className="mt-5 text-sm text-white/45">
          The sampler is not scored, does not create Attempt evidence, and does
          not use quota.
        </p>
      </div>
    </main>
  );
}

export function GuidedSamplerPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [familiarity, setFamiliarity] = useState<UcatFamiliarity | null>(() =>
    parseFamiliarity(searchParams.get("familiarity")),
  );
  const [sectionIndex, setSectionIndex] = useState(0);
  const [seenControls, setSeenControls] = useState<Set<SeenControl>>(
    () => new Set(),
  );
  const [showReadout, setShowReadout] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const completeMilestone = useCompleteOnboardingTour();
  const afterPlan = searchParams.get("afterPlan") === "1";
  const replay = searchParams.get("replay") === "1";
  const section = GUIDED_SAMPLER_SECTIONS[sectionIndex];

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      const control = target?.closest<HTMLElement>("[data-tour]")?.dataset.tour;
      const next =
        control === "question-engine-calculator"
          ? "calculator"
          : control === "question-engine-flag"
            ? "flag"
            : control === "question-engine-navigator"
              ? "navigator"
              : control === "question-engine-previous"
                ? "previous"
                : null;
      if (!next) return;
      setSeenControls((current) => new Set(current).add(next));
    };
    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, []);

  const destination = useMemo(() => {
    if (replay) return "/dashboard";
    if (afterPlan) return "/getting-started";
    return "/signup/complete";
  }, [afterPlan, replay]);

  async function persistDecision(completed: boolean) {
    setPending(true);
    setError(null);
    try {
      await completeMilestone.mutateAsync(UCAT_GUIDED_SAMPLER_DECIDED);
      await completeMilestone.mutateAsync(UCAT_QUESTION_ENGINE_TOUR);
      if (completed) {
        await completeMilestone.mutateAsync(UCAT_GUIDED_SAMPLER_COMPLETED);
      }
      if (!afterPlan && !replay) {
        await patchSignupProgress({ step: SIGNUP_STEP.PLAN });
      }
      router.replace(destination);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not save your progress.",
      );
      setPending(false);
    }
  }

  if (!familiarity) {
    return <FamiliarityEntry onChoose={setFamiliarity} />;
  }

  if (showReadout) {
    return (
      <main className="grid min-h-dvh place-items-center bg-slate-950 px-4 py-10 text-white">
        <div className="w-full max-w-2xl rounded-3xl border border-emerald-300/20 bg-white/[0.05] p-6 shadow-2xl sm:p-9">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-400/15 text-emerald-300">
            <Sparkles className="h-5 w-5" aria-hidden />
          </span>
          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
            Ready for real practice
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            You’ve explored the whole UCAT experience
          </h1>
          <p className="mt-3 text-white/60">
            This was a controls walkthrough, not a diagnostic. Your Study plan
            will calibrate from real completed work.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              ["4", "sections explored"],
              ["8", "sample items completed"],
              [String(seenControls.size), "controls tried"],
            ].map(([value, label]) => (
              <div
                key={label}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
              >
                <p className="text-2xl font-semibold">{value}</p>
                <p className="mt-1 text-sm text-white/50">{label}</p>
              </div>
            ))}
          </div>
          {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}
          <div className="mt-7 flex justify-end">
            <Button
              onClick={() => void persistDecision(true)}
              disabled={pending}
            >
              {pending
                ? "Saving…"
                : afterPlan
                  ? "Build my Study plan"
                  : replay
                    ? "Back to dashboard"
                    : "Choose how to continue"}
              {!pending ? (
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
              ) : null}
            </Button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <div className="flex h-dvh min-h-0 flex-col bg-slate-950">
      <div className="shrink-0 border-b border-white/10 bg-slate-950 px-3 py-3 text-white sm:px-5">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div
              className="flex gap-1.5"
              aria-label={`Section ${sectionIndex + 1} of 4`}
            >
              {GUIDED_SAMPLER_SECTIONS.map((item, index) => (
                <span
                  key={item.key}
                  className={cn(
                    "h-2 w-7 rounded-full",
                    index < sectionIndex && "bg-emerald-400",
                    index === sectionIndex && "bg-sky-300",
                    index > sectionIndex && "bg-white/15",
                  )}
                />
              ))}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">
                {section.name}{" "}
                <span className="font-normal text-white/45">
                  · {sectionIndex + 1} of 4
                </span>
              </p>
              <p className="truncate text-xs text-white/55">
                {coachPrompt(section.key, familiarity)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-white/55">
            {seenControls.has("calculator") ? (
              <Calculator
                className="h-3.5 w-3.5 text-emerald-300"
                aria-label="Calculator tried"
              />
            ) : null}
            {seenControls.has("flag") ? (
              <Flag
                className="h-3.5 w-3.5 text-emerald-300"
                aria-label="Flag tried"
              />
            ) : null}
            {seenControls.has("navigator") ? (
              <ListChecks
                className="h-3.5 w-3.5 text-emerald-300"
                aria-label="Navigator tried"
              />
            ) : null}
            {seenControls.has("previous") ? (
              <Check
                className="h-3.5 w-3.5 text-emerald-300"
                aria-label="Previous tried"
              />
            ) : null}
            {familiarity === "experienced" ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 text-white/60 hover:bg-white/10 hover:text-white"
                onClick={() => void persistDecision(false)}
                disabled={pending}
              >
                Skip sampler
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1">
        <QuestionEnginePage
          key={section.key}
          mode="questions"
          sourceId={`guided-sampler-${section.key}`}
          standaloneQuestions={section.questions}
          disableQuestionAttemptLogging
          tutorialMode
          tutorialFinishLabel={
            sectionIndex === GUIDED_SAMPLER_SECTIONS.length - 1
              ? "See my readiness"
              : `Continue to ${GUIDED_SAMPLER_SECTIONS[sectionIndex + 1]?.shortName}`
          }
          onTutorialComplete={() => {
            if (sectionIndex === GUIDED_SAMPLER_SECTIONS.length - 1) {
              setShowReadout(true);
              return;
            }
            setSectionIndex((current) => current + 1);
          }}
        />
      </div>

      {error ? (
        <div className="fixed bottom-3 left-1/2 z-[70] -translate-x-1/2 rounded-xl bg-red-950 px-4 py-2 text-sm text-red-100 shadow-xl">
          {error}
        </div>
      ) : null}
    </div>
  );
}
