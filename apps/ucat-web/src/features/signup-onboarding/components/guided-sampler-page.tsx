"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent } from "@altitutor/ui";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Calculator,
  Check,
  CheckCircle2,
  Flag,
  GraduationCap,
  Lightbulb,
  ListChecks,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { NoiseOverlay } from "@/features/landing/components/marketing/noise-overlay";
import {
  QuestionEnginePage,
  type QuestionEngineTutorialControl,
  type QuestionEngineTutorialSnapshot,
} from "@/features/question-engine/components/question-engine-page";
import { UCAT_QUESTION_ENGINE_TOUR } from "@/features/onboarding/config/tour-steps";
import { useCompleteOnboardingTour } from "@/features/onboarding/hooks/use-onboarding-progress";
import {
  UCAT_GUIDED_SAMPLER_COMPLETED,
  UCAT_GUIDED_SAMPLER_DECIDED,
} from "@/features/onboarding/lib/activation-milestones";
import { patchSignupProgress } from "@/features/signup-onboarding/api/signup-progress";
import type { UcatFamiliarity } from "@/features/signup-onboarding/components/steps/sampler-step";
import { SIGNUP_STEP } from "@/features/signup-onboarding/lib/steps";
import {
  GUIDED_SAMPLER_FEEDBACK,
  GUIDED_SAMPLER_SECTIONS,
} from "@/features/signup-onboarding/lib/guided-sampler-questions";
import { UCAT_CARD_CHROME } from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";
import { captureUcatEvent } from "@/lib/analytics/posthog";

type SeenControl =
  | "calculator"
  | "flag"
  | "navigator"
  | "previous"
  | "syllogismChoice";

type TutorialSnapshot = QuestionEngineTutorialSnapshot;

type CoachStep = {
  title: string;
  body: string;
  target: string;
  manual?: boolean;
  complete?: boolean;
  spotlight?: boolean;
};

type SamplerFeedbackState = {
  kind: "correct" | "incorrect" | "focus" | "control";
  title: string;
  body: string;
  hint?: string;
  details?: Array<{ label: string; hint: string }>;
  questionId?: string;
};

const EMPTY_SNAPSHOT: TutorialSnapshot = {
  questionId: null,
  questionIndex: 0,
  selectedOptionId: null,
  syllogismSnapshot: {},
  flagged: false,
  showCalculator: false,
  showNavigator: false,
  calculatorDisplay: "0",
};

function parseFamiliarity(value: string | null): UcatFamiliarity | null {
  return value === "new" || value === "familiar" || value === "experienced"
    ? value
    : null;
}

const SAMPLER_QUESTIONS = GUIDED_SAMPLER_SECTIONS.flatMap(
  (section) => section.questions,
);

function snapshotIsAnswered(snapshot: TutorialSnapshot): boolean {
  if (snapshot.selectedOptionId) return true;
  const question = SAMPLER_QUESTIONS.find(
    (candidate) => candidate.id === snapshot.questionId,
  );
  return (
    question?.questionType === "syllogism" &&
    Object.keys(snapshot.syllogismSnapshot).length === question.options.length
  );
}

function snapshotIsCorrect(snapshot: TutorialSnapshot): boolean {
  const question = SAMPLER_QUESTIONS.find(
    (candidate) => candidate.id === snapshot.questionId,
  );
  if (!question) return false;
  if (question.questionType === "syllogism") {
    return question.options.every(
      (option) =>
        snapshot.syllogismSnapshot[option.id] === Boolean(option.isAnswer),
    );
  }
  return question.options.some(
    (option) =>
      option.id === snapshot.selectedOptionId && Boolean(option.isAnswer),
  );
}

function answerSignature(snapshot: TutorialSnapshot): string {
  if (snapshot.selectedOptionId) return snapshot.selectedOptionId;
  return Object.entries(snapshot.syllogismSnapshot)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, value]) => `${id}:${value ? "yes" : "no"}`)
    .join("|");
}

function correctSyllogismOptionIds(snapshot: TutorialSnapshot): string[] {
  const question = SAMPLER_QUESTIONS.find(
    (candidate) => candidate.id === snapshot.questionId,
  );
  if (question?.questionType !== "syllogism") return [];
  return question.options
    .filter(
      (option) =>
        snapshot.syllogismSnapshot[option.id] === Boolean(option.isAnswer),
    )
    .map((option) => option.id);
}

function wrongSyllogismOptionIds(snapshot: TutorialSnapshot): string[] {
  const correct = new Set(correctSyllogismOptionIds(snapshot));
  const question = SAMPLER_QUESTIONS.find(
    (candidate) => candidate.id === snapshot.questionId,
  );
  return question?.questionType === "syllogism"
    ? question.options
        .filter((option) => !correct.has(option.id))
        .map((option) => option.id)
    : [];
}

function answerStep(snapshot: TutorialSnapshot, body: string): CoachStep {
  const hasAnswer =
    snapshot.selectedOptionId !== null ||
    Object.keys(snapshot.syllogismSnapshot).length === 5;
  return {
    title: "Choose your answer",
    body,
    target: '[data-tour="question-engine-question"]',
    complete: hasAnswer,
  };
}

function coachSteps(snapshot: TutorialSnapshot): CoachStep[] {
  switch (snapshot.questionId) {
    case "sampler-vr-1":
      return [
        {
          title: "1. Read the question first",
          body: "Read the statement before the passage. You are deciding whether it is True, False or Can’t tell.",
          target: '[data-tour="question-engine-question"]',
          manual: true,
          spotlight: true,
        },
        {
          title: "2. Scan for matching evidence",
          body: "Now scan for the distinctive words ‘wildlife habitat’. You do not need to read every line. Tip: you can drag the divider between the passage and question.",
          target: '[data-tour="question-engine-stem"]',
          manual: true,
          spotlight: true,
        },
        answerStep(
          snapshot,
          "Use the matching sentence to choose True, False or Can’t tell, then Submit your answer.",
        ),
      ];
    case "sampler-vr-2":
      return [
        {
          title: "Try the same method with less help",
          body: "Read the statement, then scan the final part of the passage for whether restoration suits every location.",
          target: '[data-tour="question-engine-question"]',
          manual: true,
        },
        answerStep(
          snapshot,
          "Decide whether the statement is True, False or Can’t tell.",
        ),
      ];
    case "sampler-dm-syllogism": {
      const answered = Object.keys(snapshot.syllogismSnapshot).length;
      return [
        {
          title: "Translate the facts, not the story",
          body: "Translate each statement into a simple rule. Use only what is certain, and never reverse an ‘all’ statement.",
          target: '[data-tour="question-engine-stem"]',
          manual: true,
        },
        {
          title: "Test every conclusion for certainty",
          body: `Assign Yes or No to all five conclusions. You have completed ${answered} of 5.`,
          target: '[data-tour="question-engine-question"]',
          complete: answered === 5,
        },
      ];
    }
    case "sampler-dm-logic":
      return [
        {
          title: "Build the fixed block first",
          body: "Science is immediately after History, so treat them as the block H–S. Travel must be fourth. The H–S block can only occupy positions 1–2, making Science second.",
          target: '[data-tour="question-engine-stem"]',
          manual: true,
        },
        answerStep(
          snapshot,
          "Choose the talk that must occupy the second position.",
        ),
      ];
    case "sampler-qr-1":
      return [
        {
          title: "Identify the required rows",
          body: "The question asks only for adult revenue. Find the number of adult admissions and the adult ticket price.",
          target: '[data-tour="question-engine-question"]',
          manual: true,
        },
        {
          title: "Open the UCAT calculator",
          body: "Select Calculator in the toolbar (or press Alt+C).",
          target: '[data-tour="question-engine-calculator"]',
          complete: snapshot.showCalculator,
        },
        {
          title: "Calculate, then move the panel",
          body: "Enter 40 × 12, then drag the calculator by its title bar so you know how to reposition it in a real session.",
          target: '[data-tour="question-engine-calculator-panel"]',
          manual: true,
        },
        answerStep(snapshot, "Select the result of your calculation."),
      ];
    case "sampler-qr-2":
      return [
        {
          title: "Set up the percentage",
          body: "Use part ÷ whole × 100, then round to the nearest whole percent.",
          target: '[data-tour="question-engine-question"]',
          manual: true,
        },
        answerStep(snapshot, "Select the nearest whole percentage."),
      ];
    case "sampler-sjt-1":
      return [
        {
          title: "Name the professional duty",
          body: "Identify the professional duty at risk, then judge whether Mina’s response is proportionate.",
          target: '[data-tour="question-engine-stem"]',
          manual: true,
        },
        answerStep(snapshot, "Choose the most appropriate judgement."),
      ];
    case "sampler-sjt-2":
      return [
        {
          title: "Focus on what changes the duty",
          body: "Ask how much the 24-hour limit changes the underlying duty to protect confidentiality.",
          target: '[data-tour="question-engine-question"]',
          manual: true,
        },
        answerStep(
          snapshot,
          "Choose how important that fact is to the decision.",
        ),
      ];
    default:
      return [];
  }
}

function useTargetRect(selector: string | undefined) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!selector) {
      setRect(null);
      return;
    }
    const target = document.querySelector<HTMLElement>(selector);
    if (!target) {
      setRect(null);
      return;
    }
    const update = () => setRect(target.getBoundingClientRect());
    update();
    const observer = new ResizeObserver(update);
    observer.observe(target);
    window.addEventListener("resize", update);
    document.addEventListener("scroll", update, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
      document.removeEventListener("scroll", update, true);
    };
  }, [selector]);

  return rect;
}

function SamplerCoach({
  step,
  stepNumber,
  totalSteps,
  onContinue,
}: {
  step: CoachStep;
  stepNumber: number;
  totalSteps: number;
  onContinue: () => void;
}) {
  const rect = useTargetRect(step.target);
  return (
    <>
      {rect && step.spotlight ? (
        <motion.div
          layoutId="guided-sampler-spotlight"
          className="pointer-events-none fixed z-[65] rounded-xl ring-1 ring-white/20 shadow-[0_0_0_9999px_rgba(3,8,16,0.58)]"
          initial={false}
          animate={{
            left: Math.max(4, rect.left - 6),
            top: Math.max(4, rect.top - 6),
            width: rect.width + 12,
            height: rect.height + 12,
          }}
          transition={{ type: "spring", stiffness: 330, damping: 32 }}
          aria-hidden
        />
      ) : null}
      <motion.div
        key={`${stepNumber}-${step.title}`}
        initial={{ opacity: 0, y: 14, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.985 }}
        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
        className="fixed bottom-3 left-3 z-[70] w-[min(390px,calc(100vw-1.5rem))]"
      >
        <Card className={cn(UCAT_CARD_CHROME, "border-primary/30 shadow-2xl")}>
          <CardContent className="p-4">
          <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5 font-medium text-primary">
              <GraduationCap className="h-3.5 w-3.5" aria-hidden />
              Guided practice
            </span>
            <span>
              {stepNumber} of {totalSteps}
            </span>
          </div>
          <h2 className="mt-2 font-semibold">{step.title}</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            {step.body}
          </p>
          {step.manual ? (
            <div className="mt-3 flex justify-end">
              <Button size="sm" onClick={onContinue}>
                Next
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" aria-hidden />
              </Button>
            </div>
          ) : null}
          </CardContent>
        </Card>
      </motion.div>
    </>
  );
}

function SamplerFeedbackCard({
  feedback,
  onDismiss,
  onNext,
}: {
  feedback: SamplerFeedbackState;
  onDismiss: () => void;
  onNext?: () => void;
}) {
  const correct = feedback.kind === "correct";
  const incorrect = feedback.kind === "incorrect";
  const Icon = correct ? CheckCircle2 : incorrect ? RotateCcw : Lightbulb;

  return (
    <motion.div
      key={`${feedback.kind}-${feedback.title}-${feedback.questionId ?? "control"}`}
      initial={{ opacity: 0, y: 16, scale: 0.975 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.98 }}
      transition={{ type: "spring", stiffness: 390, damping: 30 }}
      className="fixed bottom-3 left-3 z-[75] w-[min(440px,calc(100vw-1.5rem))]"
    >
      {correct ? (
        <div className="pointer-events-none absolute -inset-5" aria-hidden>
          {Array.from({ length: 7 }).map((_, index) => (
            <motion.span
              key={index}
              className="absolute left-10 top-7 h-2 w-2 rounded-full bg-emerald-400"
              initial={{ opacity: 0.9, scale: 0 }}
              animate={{
                opacity: 0,
                scale: [0, 1, 0.7],
                x: Math.cos((index / 7) * Math.PI * 2) * (55 + index * 4),
                y: Math.sin((index / 7) * Math.PI * 2) * (35 + index * 3),
              }}
              transition={{ duration: 0.8, delay: index * 0.035 }}
            />
          ))}
        </div>
      ) : null}
      <Card
        className={cn(
          UCAT_CARD_CHROME,
          "shadow-2xl",
          correct && "border-emerald-500/45",
          incorrect && "border-amber-500/45",
          !correct && !incorrect && "border-primary/35",
        )}
        role="status"
        aria-live="polite"
      >
        <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
              correct && "bg-emerald-500/12 text-emerald-600",
              incorrect && "bg-amber-500/12 text-amber-600",
              !correct && !incorrect && "bg-primary/10 text-primary",
            )}
          >
            <motion.span
              initial={correct ? { scale: 0.5, rotate: -16 } : false}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 460, damping: 21 }}
            >
              <Icon className="h-4 w-4" aria-hidden />
            </motion.span>
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold">{feedback.title}</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {feedback.body}
            </p>
            {feedback.hint ? (
              <div className="mt-3 rounded-xl bg-muted/60 px-3 py-2.5 text-sm">
                <span className="font-medium">Hint: </span>
                {feedback.hint}
              </div>
            ) : null}
            {feedback.details?.length ? (
              <div className="mt-3 space-y-2">
                {feedback.details.map((detail) => (
                  <div
                    key={detail.label}
                    className="rounded-xl bg-muted/60 px-3 py-2.5 text-sm"
                  >
                    <span className="font-medium">{detail.label}: </span>
                    {detail.hint}
                  </div>
                ))}
              </div>
            ) : null}
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                {correct
                  ? "Continue when you’re ready."
                  : incorrect
                    ? "Change your answer, then Submit again."
                    : "Stay with the current question when you’re ready."}
              </p>
              {correct && onNext ? (
                <Button size="sm" onClick={onNext}>
                  Next
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5" aria-hidden />
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={onDismiss}>
                  Back to question
                </Button>
              )}
            </div>
          </div>
        </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function FamiliarityEntry({
  onChoose,
}: {
  onChoose: (value: UcatFamiliarity) => void;
}) {
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden bg-marketing-charcoal px-4 py-10">
      <NoiseOverlay />
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-3xl rounded-3xl border border-white/10 bg-white/[0.05] p-6 shadow-2xl backdrop-blur sm:p-8"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-marketing-accent">
          Guided UCAT sampler
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-marketing-cream">
          Let’s get you ready for your first UCAT session
        </h1>
        <p className="mt-3 max-w-2xl text-marketing-cream/65">
          Work through two easy, representative questions from each section.
          We’ll match the amount of coaching to your experience. About 6
          minutes.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {(
            [
              ["new", "Completely new", "Coach me step by step."],
              [
                "familiar",
                "Know the format",
                "Let me solve them independently.",
              ],
              [
                "experienced",
                "Already practising",
                "Keep it minimal and skippable.",
              ],
            ] as const
          ).map(([value, title, description]) => (
            <button
              key={value}
              type="button"
              onClick={() => onChoose(value)}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left text-marketing-cream transition-colors hover:border-marketing-accent/50 hover:bg-marketing-accent/10"
            >
              <span className="font-semibold">{title}</span>
              <span className="mt-1 block text-sm text-marketing-cream/55">
                {description}
              </span>
            </button>
          ))}
        </div>
        <p className="mt-5 text-sm text-marketing-cream/45">
          We’ll check each answer and coach you to the right reasoning. It is
          not a diagnostic, creates no Attempt evidence and uses no quota.
        </p>
      </motion.div>
    </main>
  );
}

const FAMILIARITY_INTRO_COPY: Record<UcatFamiliarity, string> = {
  new: "We’ll coach you through the method and controls step by step, then gradually give you more space.",
  familiar:
    "We’ll give you a quick orientation to Alti UCAT, then keep the guidance brief unless you get stuck.",
  experienced:
    "We’ll keep guidance minimal so you can focus on how the Alti UCAT controls feel.",
};

const SAMPLER_INTRO_FEATURES = [
  {
    Icon: ListChecks,
    title: "See every section",
    body: "Meet the question formats without starting a real Attempt.",
  },
  {
    Icon: Calculator,
    title: "Try the controls",
    body: "Use Navigator, Flag and the calculator in context.",
  },
  {
    Icon: Lightbulb,
    title: "Learn as you answer",
    body: "Get explanations and progressively clearer hints when needed.",
  },
] as const;

function SamplerIntroduction({
  familiarity,
  pending,
  error,
  onStart,
  onSkip,
}: {
  familiarity: UcatFamiliarity;
  pending: boolean;
  error: string | null;
  onStart: () => void;
  onSkip: () => void;
}) {
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden bg-marketing-charcoal px-4 py-10">
      <NoiseOverlay />
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="relative z-10 w-full max-w-3xl rounded-3xl border border-white/10 bg-white/[0.05] p-6 shadow-2xl backdrop-blur sm:p-8"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-marketing-accent">
          Guided UCAT sampler
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-marketing-cream sm:text-4xl">
          Get familiar with the Alti UCAT system
        </h1>
        <p className="mt-3 max-w-2xl leading-relaxed text-marketing-cream/65">
          Try two approachable questions from each UCAT section using the same
          controls you’ll see in practice and mocks. We’ll mark each answer as
          you go—this is a guided tour, not a test.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {SAMPLER_INTRO_FEATURES.map(({ Icon, title, body }) => (
            <div
              key={title}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
            >
              <Icon className="h-5 w-5 text-marketing-accent" aria-hidden />
              <h2 className="mt-3 font-semibold text-marketing-cream">
                {title}
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-marketing-cream/50">
                {body}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-2xl border border-marketing-accent/20 bg-marketing-accent/[0.08] px-4 py-3 text-sm leading-relaxed text-marketing-cream/70">
          {FAMILIARITY_INTRO_COPY[familiarity]}
        </div>

        {error ? (
          <p className="mt-4 text-sm text-red-200" role="alert">
            {error}
          </p>
        ) : null}

        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={onSkip}
            disabled={pending}
            className="text-marketing-cream/60 hover:bg-white/[0.06] hover:text-marketing-cream"
          >
            {pending ? "Skipping…" : "Skip for now"}
          </Button>
          <Button
            type="button"
            onClick={onStart}
            className="bg-marketing-accent text-marketing-charcoal hover:bg-marketing-accent/90"
          >
            Start sampler
            <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
          </Button>
        </div>
      </motion.div>
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
  const [samplerStarted, setSamplerStarted] = useState(false);
  const [seenControls, setSeenControls] = useState<Set<SeenControl>>(
    () => new Set(),
  );
  const [showReadout, setShowReadout] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<TutorialSnapshot>(EMPTY_SNAPSHOT);
  const [guideStepIndex, setGuideStepIndex] = useState(0);
  const [attemptsByQuestion, setAttemptsByQuestion] = useState<
    Record<string, number>
  >({});
  const [correctQuestionIds, setCorrectQuestionIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [correctSyllogismRows, setCorrectSyllogismRows] = useState<
    Record<string, string[]>
  >({});
  const [feedback, setFeedback] = useState<SamplerFeedbackState | null>(null);
  const snapshotRef = useRef<TutorialSnapshot>(EMPTY_SNAPSHOT);
  const lastSubmittedAnswerRef = useRef<Record<string, string>>({});
  const tutorialAdvanceRef = useRef<() => void>(() => undefined);
  const previousQuestionId = useRef<string | null>(null);
  const completeMilestone = useCompleteOnboardingTour();
  const afterPlan = searchParams.get("afterPlan") === "1";
  const replay = searchParams.get("replay") === "1";
  const section = GUIDED_SAMPLER_SECTIONS[sectionIndex];
  const steps = coachSteps(snapshot);
  const activeCoachStep = steps[guideStepIndex] ?? null;
  const lockedQuestionIds = useMemo(
    () => [...correctQuestionIds],
    [correctQuestionIds],
  );
  const currentQuestionIsCorrect = Boolean(
    snapshot.questionId && correctQuestionIds.has(snapshot.questionId),
  );

  const handleTutorialStateChange = useCallback(
    (nextSnapshot: TutorialSnapshot) => {
      const previousSnapshot = snapshotRef.current;
      const answerChanged =
        previousSnapshot.questionId !== nextSnapshot.questionId ||
        previousSnapshot.selectedOptionId !== nextSnapshot.selectedOptionId ||
        JSON.stringify(previousSnapshot.syllogismSnapshot) !==
          JSON.stringify(nextSnapshot.syllogismSnapshot);
      snapshotRef.current = nextSnapshot;
      setSnapshot(nextSnapshot);
      setFeedback((current) => {
        if (!current || current.kind === "correct") return current;
        if (
          current.questionId &&
          current.questionId !== nextSnapshot.questionId
        ) {
          return null;
        }
        if (answerChanged && current.kind === "incorrect") return null;
        if (answerChanged && current.kind === "focus" && current.hint)
          return null;
        return current;
      });
    },
    [],
  );

  useEffect(() => {
    if (snapshot.questionId === previousQuestionId.current) return;
    previousQuestionId.current = snapshot.questionId;
    setGuideStepIndex(0);
    if (snapshot.questionId && correctQuestionIds.has(snapshot.questionId)) {
      setFeedback({
        kind: "correct",
        title: "Already correct",
        body:
          GUIDED_SAMPLER_FEEDBACK[snapshot.questionId]?.explanation ??
          "You answered this question correctly.",
        questionId: snapshot.questionId,
      });
    } else {
      setFeedback(null);
    }
  }, [correctQuestionIds, snapshot.questionId]);

  useEffect(() => {
    if (!activeCoachStep?.complete) return;
    setGuideStepIndex((current) => Math.min(current + 1, steps.length - 1));
  }, [activeCoachStep?.complete, steps.length]);

  useEffect(() => {
    const questionId = snapshot.questionId;
    if (!questionId || feedback || correctQuestionIds.has(questionId)) return;
    const delay =
      familiarity === "new" ? 18_000 : familiarity === "familiar" ? 28_000 : 40_000;
    const timer = window.setTimeout(() => {
      const questionFeedback = GUIDED_SAMPLER_FEEDBACK[questionId];
      setFeedback((current) =>
        current
          ? current
          : {
              kind: "focus",
              title: "Need a nudge?",
              body: "You’re doing fine. Use this clue, then keep working through the current question.",
              hint: questionFeedback?.hints[0],
              questionId,
            },
      );
    }, delay);
    return () => window.clearTimeout(timer);
  }, [
    correctQuestionIds,
    familiarity,
    feedback,
    snapshot.questionId,
    snapshot.selectedOptionId,
    snapshot.syllogismSnapshot,
  ]);

  const handleTutorialRequestNext = useCallback(
    (nextSnapshot: TutorialSnapshot): boolean => {
      const questionId = nextSnapshot.questionId;
      if (!questionId) return false;
      const questionFeedback = GUIDED_SAMPLER_FEEDBACK[questionId];

      if (correctQuestionIds.has(questionId)) {
        if (
          feedback?.kind === "correct" &&
          feedback.questionId === questionId
        ) {
          setFeedback(null);
          return true;
        }
        setFeedback({
          kind: "correct",
          title: "That’s correct",
          body:
            questionFeedback?.explanation ??
            "You used the information correctly.",
          questionId,
        });
        return false;
      }

      if (!snapshotIsAnswered(nextSnapshot)) {
        setFeedback({
          kind: "focus",
          title: "Answer this question first",
          body: "Choose an answer before moving on. The sampler will keep you here until you have worked it through.",
          questionId,
        });
        return false;
      }

      if (snapshotIsCorrect(nextSnapshot)) {
        setCorrectQuestionIds((current) => new Set(current).add(questionId));
        if (Object.keys(nextSnapshot.syllogismSnapshot).length) {
          setCorrectSyllogismRows((current) => ({
            ...current,
            [questionId]: correctSyllogismOptionIds(nextSnapshot),
          }));
        }
        setFeedback({
          kind: "correct",
          title: "That’s correct",
          body:
            questionFeedback?.explanation ??
            "You used the information correctly.",
          questionId,
        });
        return false;
      }

      const signature = answerSignature(nextSnapshot);
      const answerChangedSinceSubmit =
        lastSubmittedAnswerRef.current[questionId] !== signature;
      const previousAttempt = attemptsByQuestion[questionId] ?? 0;
      const attempt = answerChangedSinceSubmit
        ? previousAttempt + 1
        : Math.max(previousAttempt, 1);
      lastSubmittedAnswerRef.current[questionId] = signature;
      if (answerChangedSinceSubmit) {
        setAttemptsByQuestion((current) => ({
          ...current,
          [questionId]: attempt,
        }));
      }
      const hintDelay = familiarity === "experienced" ? 1 : 0;
      const hintIndex = Math.min(
        Math.max(attempt - 1 - hintDelay, 0),
        (questionFeedback?.hints.length ?? 1) - 1,
      );
      const showHint = familiarity !== "experienced" || attempt > 1;
      const selectedOptionFeedback = nextSnapshot.selectedOptionId
        ? questionFeedback?.optionFeedback?.[nextSnapshot.selectedOptionId]
        : undefined;
      const wrongSyllogismRows = wrongSyllogismOptionIds(nextSnapshot);
      const newlyCorrectRows = correctSyllogismOptionIds(nextSnapshot);
      if (newlyCorrectRows.length) {
        setCorrectSyllogismRows((current) => ({
          ...current,
          [questionId]: Array.from(
            new Set([...(current[questionId] ?? []), ...newlyCorrectRows]),
          ),
        }));
      }
      const syllogismHintIndex = Math.min(Math.max(attempt - 1, 0), 1);
      setFeedback({
        kind: "incorrect",
        title: answerChangedSinceSubmit
          ? "Not quite—try again"
          : "Try selecting a different answer",
        body:
          selectedOptionFeedback ??
          (wrongSyllogismRows.length
            ? `${newlyCorrectRows.length} of 5 judgements are correct and now locked. Rework only the remaining ${wrongSyllogismRows.length}.`
            : familiarity === "new"
              ? "That answer is not fully supported. Use the hint, change your answer and check it again."
              : "Recheck the information and try another answer."),
        hint: showHint ? questionFeedback?.hints[hintIndex] : undefined,
        details: wrongSyllogismRows.map((optionId) => {
          const question = SAMPLER_QUESTIONS.find(
            (candidate) => candidate.id === questionId,
          );
          const option = question?.options.find((item) => item.id === optionId);
          return {
            label: option?.text ?? "This conclusion",
            hint:
              questionFeedback?.syllogismHints?.[optionId]?.[
                syllogismHintIndex
              ] ?? "Test whether this conclusion must be true.",
          };
        }),
        questionId,
      });
      return false;
    },
    [attemptsByQuestion, correctQuestionIds, familiarity, feedback],
  );

  const handleTutorialControl = useCallback(
    (
      control: QuestionEngineTutorialControl,
      controlSnapshot: TutorialSnapshot,
    ): boolean => {
      setSeenControls((current) => new Set(current).add(control));
      const currentSection = GUIDED_SAMPLER_SECTIONS[sectionIndex];

      if (control === "calculator") {
        if (currentSection?.key === "vr") {
          setFeedback({
            kind: "focus",
            title: "Stay with the passage",
            body: "You found the calculator. You will use it in Quantitative Reasoning; for Verbal Reasoning, return to the question and scan the passage for evidence.",
            questionId: controlSnapshot.questionId ?? undefined,
          });
          return false;
        }
        if (currentSection?.key !== "qr") {
          setFeedback({
            kind: "focus",
            title: "You won’t need the calculator here",
            body: "Keep your attention on the information in this question. The guided calculator step comes in Quantitative Reasoning.",
            questionId: controlSnapshot.questionId ?? undefined,
          });
          return false;
        }
        return true;
      }

      if (control === "flag") {
        setFeedback({
          kind: "control",
          title: controlSnapshot.flagged
            ? "Flag removed"
            : "You found the flag",
          body: "In a real UCAT session, Flag for Review marks a question to revisit without changing your answer. Keep working on this one for now.",
          questionId: controlSnapshot.questionId ?? undefined,
        });
        return true;
      }

      if (control === "navigator") {
        setFeedback({
          kind: "control",
          title: "You found the Navigator",
          body: "Navigator lets you jump between questions in a full session. The sampler keeps you focused on one question at a time, so answer this one before moving on.",
          questionId: controlSnapshot.questionId ?? undefined,
        });
        return false;
      }

      if (control === "syllogismChoice") {
        setFeedback({
          kind: "control",
          title: "Drag the Yes or No tile",
          body: "The UCAT syllogism interface uses drag and drop. Drag a Yes or No tile from the tray into the box beside each conclusion.",
          questionId: controlSnapshot.questionId ?? undefined,
        });
        return false;
      }

      return true;
    },
    [sectionIndex],
  );

  const destination = useMemo(() => {
    if (replay) return "/dashboard";
    if (afterPlan) return "/study-plan/setup?activation=1";
    return "/signup/complete?sampler=complete";
  }, [afterPlan, replay]);

  const dismissFeedback = useCallback(() => {
    setFeedback((current) => {
      const questionId = current?.questionId;
      if (
        current?.kind !== "correct" &&
        questionId &&
        correctQuestionIds.has(questionId)
      ) {
        return {
          kind: "correct",
          title: "That’s correct",
          body:
            GUIDED_SAMPLER_FEEDBACK[questionId]?.explanation ??
            "You used the information correctly.",
          questionId,
        };
      }
      return null;
    });
  }, [correctQuestionIds]);

  async function persistDecision(completed: boolean) {
    setPending(true);
    setError(null);
    try {
      await completeMilestone.mutateAsync(UCAT_GUIDED_SAMPLER_DECIDED);
      await completeMilestone.mutateAsync(UCAT_QUESTION_ENGINE_TOUR);
      if (completed) {
        await completeMilestone.mutateAsync(UCAT_GUIDED_SAMPLER_COMPLETED);
        captureUcatEvent("first_value_reached", {
          value_type: "guided_sampler_completed",
          familiarity,
          after_plan: afterPlan,
          replay,
        });
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

  if (!samplerStarted) {
    return (
      <SamplerIntroduction
        familiarity={familiarity}
        pending={pending}
        error={error}
        onStart={() => setSamplerStarted(true)}
        onSkip={() => void persistDecision(false)}
      />
    );
  }

  if (showReadout) {
    return (
      <main className="relative grid min-h-dvh place-items-center overflow-hidden bg-marketing-charcoal px-4 py-10">
        <NoiseOverlay />
        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: 18 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="relative z-10 w-full max-w-2xl rounded-3xl border border-marketing-accent/20 bg-white/[0.05] p-6 shadow-2xl backdrop-blur sm:p-9"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-marketing-accent/15 text-marketing-accent">
            <Sparkles className="h-5 w-5" aria-hidden />
          </span>
          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-marketing-accent">
            Ready for real practice
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-marketing-cream">
            You’ve explored the whole UCAT experience
          </h1>
          <p className="mt-3 text-marketing-cream/60">
            You worked every question through to the correct answer.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              [
                `${
                  GUIDED_SAMPLER_SECTIONS.slice(0, 3)
                    .flatMap((item) => item.questions)
                    .filter((question) => correctQuestionIds.has(question.id))
                    .length
                }/6`,
                "cognitive questions correct",
              ],
              [
                `${GUIDED_SAMPLER_SECTIONS.find((item) => item.key === "sjt")?.questions.filter((question) => correctQuestionIds.has(question.id)).length ?? 0}/2`,
                "SJT judgements completed",
              ],
              [String(seenControls.size), "controls tried"],
            ].map(([value, label]) => (
              <div
                key={label}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
              >
                <p className="text-2xl font-semibold text-marketing-cream">
                  {value}
                </p>
                <p className="mt-1 text-sm text-marketing-cream/50">{label}</p>
              </div>
            ))}
          </div>
          {error ? (
            <p className="mt-4 text-sm text-destructive-foreground">{error}</p>
          ) : null}
          <div className="mt-7 flex justify-end">
            <Button
              onClick={() => void persistDecision(true)}
              disabled={pending}
              className="bg-marketing-accent text-marketing-charcoal hover:bg-marketing-accent/90"
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
        </motion.div>
      </main>
    );
  }

  return (
    <div className="flex h-dvh min-h-0 flex-col bg-background text-foreground">
      <div className="shrink-0 border-b bg-card px-3 py-3 shadow-sm sm:px-5">
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
                    index < sectionIndex && "bg-primary/45",
                    index === sectionIndex && "bg-primary",
                    index > sectionIndex && "bg-muted",
                  )}
                />
              ))}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">
                {section.name}{" "}
                <span className="font-normal text-muted-foreground">
                  · {sectionIndex + 1} of 4
                </span>
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {familiarity === "new"
                  ? "Follow the coach, then use the real exam controls."
                  : section.purpose}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {seenControls.has("calculator") ? (
              <Calculator
                className="h-3.5 w-3.5 text-primary"
                aria-label="Calculator tried"
              />
            ) : null}
            {seenControls.has("flag") ? (
              <Flag
                className="h-3.5 w-3.5 text-primary"
                aria-label="Flag tried"
              />
            ) : null}
            {seenControls.has("navigator") ? (
              <ListChecks
                className="h-3.5 w-3.5 text-primary"
                aria-label="Navigator tried"
              />
            ) : null}
            {seenControls.has("previous") ? (
              <Check
                className="h-3.5 w-3.5 text-primary"
                aria-label="Previous tried"
              />
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8"
              onClick={() => void persistDecision(false)}
              disabled={pending}
            >
              Skip sampler
            </Button>
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
          tutorialCalculatorDraggable
          tutorialSequential
          tutorialHidePrevious
          tutorialSyllogismDragOnly
          tutorialPrimaryActionLabel="Submit"
          tutorialHidePrimaryAction={currentQuestionIsCorrect}
          tutorialLockedQuestionIds={lockedQuestionIds}
          tutorialLockedSyllogismOptionIds={correctSyllogismRows}
          tutorialCorrectSyllogismOptionIds={correctSyllogismRows}
          tutorialHighlightText={
            feedback?.questionId === snapshot.questionId &&
            (feedback.hint || feedback.details?.length)
              ? GUIDED_SAMPLER_FEEDBACK[snapshot.questionId ?? ""]
                  ?.highlightText
              : undefined
          }
          onTutorialStateChange={handleTutorialStateChange}
          onTutorialRequestNext={handleTutorialRequestNext}
          onTutorialControl={handleTutorialControl}
          onRegisterTutorialAdvance={(advance) => {
            tutorialAdvanceRef.current = advance;
          }}
          onTutorialComplete={() => {
            if (sectionIndex === GUIDED_SAMPLER_SECTIONS.length - 1) {
              setShowReadout(true);
              return;
            }
            setSnapshot(EMPTY_SNAPSHOT);
            setFeedback(null);
            previousQuestionId.current = null;
            setSectionIndex((current) => current + 1);
          }}
        />
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {feedback ? (
          <SamplerFeedbackCard
            key={`feedback-${feedback.kind}-${feedback.title}`}
            feedback={feedback}
            onDismiss={dismissFeedback}
            onNext={
              feedback.kind === "correct"
                ? () => tutorialAdvanceRef.current()
                : undefined
            }
          />
        ) : familiarity === "new" && activeCoachStep ? (
          <SamplerCoach
            key={`coach-${snapshot.questionId}-${guideStepIndex}`}
            step={activeCoachStep}
            stepNumber={guideStepIndex + 1}
            totalSteps={steps.length}
            onContinue={() =>
              setGuideStepIndex((current) =>
                Math.min(current + 1, steps.length - 1),
              )
            }
          />
        ) : null}
      </AnimatePresence>

      {error ? (
        <div className="fixed bottom-3 left-1/2 z-[80] -translate-x-1/2 rounded-xl bg-destructive px-4 py-2 text-sm text-destructive-foreground shadow-xl">
          {error}
        </div>
      ) : null}
    </div>
  );
}
