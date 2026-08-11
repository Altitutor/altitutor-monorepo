"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent } from "@altitutor/ui";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import {
  ArrowRight,
  ArrowLeft,
  BookOpenText,
  Calculator,
  Check,
  CheckCircle2,
  Flag,
  GraduationCap,
  HeartPulse,
  Lightbulb,
  ListChecks,
  Scale,
  Sigma,
  Stethoscope,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { NoiseOverlay } from "@/features/landing/components/marketing/noise-overlay";
import {
  QuestionEnginePage,
  type QuestionEngineTutorialControl,
  type QuestionEngineTutorialSnapshot,
} from "@/features/question-engine/components/question-engine-page";
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
  INACTIVITY_NUDGE_TITLE,
  inactivityHintLevel,
} from "@/features/signup-onboarding/lib/guided-sampler-questions";
import {
  UCAT_CARD_CHROME,
  UCAT_PRIMARY_ACTION_BUTTON,
} from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";
import { captureUcatEvent } from "@/lib/analytics/posthog";
import { navigateAfterAuth } from "@/features/auth/lib/navigate-after-auth";
import {
  pathWithReturnIntent,
  safePostAuthReturnPath,
} from "@/features/auth/lib/return-intent";

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
  awaitingAnswer?: boolean;
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

function OnboardingThemeToggle() {
  return (
    <div className="fixed right-4 top-4 z-[80] sm:right-6 sm:top-6">
      <ThemeToggle />
    </div>
  );
}

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
    awaitingAnswer: true,
    complete: hasAnswer,
  };
}

function readStemStep(body: string): CoachStep {
  return {
    title: "1. Read the stem first",
    body,
    target: '[data-tour="question-engine-stem"]',
    manual: true,
    spotlight: true,
  };
}

function coachSteps(snapshot: TutorialSnapshot): CoachStep[] {
  switch (snapshot.questionId) {
    case "sampler-vr-1":
      return [
        readStemStep(
          "Read the passage once to understand what it says about restoring urban rivers.",
        ),
        {
          title: "2. Read the question",
          body: "Now read the statement you need to judge. You are deciding whether it is True, False or Can’t tell.",
          target: '[data-tour="question-engine-question"]',
          manual: true,
          spotlight: true,
        },
        answerStep(
          snapshot,
          "Return to the passage, find the words ‘wildlife habitat’, then choose True, False or Can’t tell and Submit.",
        ),
      ];
    case "sampler-vr-2":
      return [
        {
          title: "Try the same method with less help",
          body: "Read the stem first, then read the question. Return to the passage and scan for words linked to monitoring or newly planted banks.",
          target: '[data-tour="question-engine-stem"]',
          manual: true,
        },
        answerStep(
          snapshot,
          "Choose the option the passage states most directly, then Submit.",
        ),
      ];
    case "sampler-dm-syllogism": {
      const answered = Object.keys(snapshot.syllogismSnapshot).length;
      return [
        readStemStep(
          "Read all three facts about the Cedar Club, cyclists, swimmers and musicians before testing any conclusion.",
        ),
        {
          title: "2. Drag Yes or No to every conclusion",
          body: `Drag a Yes or No tile from the tray into the box beside each conclusion. Choose Yes only when the conclusion must follow from the stem. You have completed ${answered} of 5.`,
          target: '[data-tour="question-engine-question"]',
          awaitingAnswer: true,
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
        readStemStep(
          "Read the admissions table and locate the number of adult admissions and the adult ticket price.",
        ),
        {
          title: "2. Open the UCAT calculator",
          body: "Select Calculator in the toolbar (or press Alt+C).",
          target: '[data-tour="question-engine-calculator"]',
          spotlight: true,
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
          title: "Read the stem first",
          body: "Read the admissions table first, then read the percentage question. Use part ÷ whole × 100 and round to the nearest whole percent.",
          target: '[data-tour="question-engine-stem"]',
          manual: true,
        },
        answerStep(snapshot, "Select the nearest whole percentage."),
      ];
    case "sampler-sjt-1":
      return [
        readStemStep(
          "Read the full scenario and identify what happened to the patient’s information and how the other student responded.",
        ),
        answerStep(
          snapshot,
          "Use the confidentiality risk and the student’s refusal to choose the most appropriate judgement.",
        ),
      ];
    case "sampler-sjt-2":
      return [
        {
          title: "Read the stem first",
          body: "Read the scenario again before deciding how much the 24-hour limit changes the duty to protect confidentiality.",
          target: '[data-tour="question-engine-stem"]',
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

/**
 * Pad the question body so students can scroll options above the fixed left
 * coach/feedback card instead of having it cover answers.
 */
function useScrollClearanceForBottomOverlay(
  active: boolean,
  overlayRef: React.RefObject<HTMLElement | null>,
  resetKey: string,
) {
  useEffect(() => {
    if (!active) return;

    const anchors = [
      document.querySelector<HTMLElement>(
        '[data-tour="question-engine-question"]',
      ),
      document.querySelector<HTMLElement>('[data-tour="question-engine-stem"]'),
    ].filter((node): node is HTMLElement => node != null);

    const scrollers = new Set<HTMLElement>();
    for (const anchor of anchors) {
      let node: HTMLElement | null = anchor;
      while (node && node !== document.body) {
        const { overflowY, overflow } = window.getComputedStyle(node);
        if (
          overflowY === "auto" ||
          overflowY === "scroll" ||
          overflow === "auto" ||
          overflow === "scroll"
        ) {
          scrollers.add(node);
          break;
        }
        node = node.parentElement;
      }
    }

    if (scrollers.size === 0) return;

    const previous = new Map<HTMLElement, string>();
    for (const scroller of scrollers) {
      previous.set(scroller, scroller.style.paddingBottom);
    }

    const apply = () => {
      const cardHeight = overlayRef.current?.offsetHeight ?? 0;
      // Card sits above exam footer; leave a little more room than card alone.
      const clearance = Math.max(cardHeight + 32, 280);
      for (const scroller of scrollers) {
        scroller.style.paddingBottom = `${clearance}px`;
      }
    };

    // Wait a frame so the newly mounted overlay has layout.
    const observer = new ResizeObserver(apply);
    const frame = window.requestAnimationFrame(() => {
      apply();
      if (overlayRef.current) observer.observe(overlayRef.current);
    });
    window.addEventListener("resize", apply);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", apply);
      for (const [scroller, value] of previous) {
        scroller.style.paddingBottom = value;
      }
    };
  }, [active, overlayRef, resetKey]);
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
  const overlayRef = useRef<HTMLDivElement>(null);
  useScrollClearanceForBottomOverlay(
    true,
    overlayRef,
    `${stepNumber}-${step.title}`,
  );

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
        ref={overlayRef}
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
  const overlayRef = useRef<HTMLDivElement>(null);
  useScrollClearanceForBottomOverlay(
    true,
    overlayRef,
    `${feedback.kind}-${feedback.title}-${feedback.questionId ?? "control"}`,
  );

  return (
    <motion.div
      ref={overlayRef}
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
    <main className="relative grid min-h-dvh place-items-center overflow-hidden bg-background px-4 py-10 text-foreground transition-colors">
      <NoiseOverlay />
      <OnboardingThemeToggle />
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-3xl rounded-3xl border border-border bg-card/80 p-6 shadow-2xl backdrop-blur sm:p-8"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary dark:text-accent">
          Guided UCAT sample questions
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
          Let’s get you ready for your first UCAT session
        </h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Work through two easy, realistic questions from each section.
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
                "Already practicing",
                "Keep it minimal and skippable.",
              ],
            ] as const
          ).map(([value, title, description]) => (
            <button
              key={value}
              type="button"
              onClick={() => onChoose(value)}
              className="rounded-2xl border border-border bg-background/50 p-4 text-left text-foreground transition-colors hover:border-primary/40 hover:bg-muted/70 dark:hover:border-accent/40"
            >
              <span className="font-semibold">{title}</span>
              <span className="mt-1 block text-sm text-muted-foreground">
                {description}
              </span>
            </button>
          ))}
        </div>
        <p className="mt-5 text-sm text-muted-foreground">
          We’ll check each answer and coach you to the right reasoning. It is
          not a diagnostic, creates no Attempt evidence and uses no quota.
        </p>
      </motion.div>
    </main>
  );
}

const UCAT_INFO_SLIDES = [
  {
    kicker: "First, the big picture",
    title: "What is the UCAT?",
    body: "The University Clinical Aptitude Test is a computer-based admissions test.",
    points: [
      "Universities use it when selecting students for medicine, dentistry, oral health and related clinical programs.",
      "It assesses reasoning and problem-solving rather than knowledge recalled from a school subject.",
    ],
    visual: "purpose",
  },
  {
    kicker: "Four separately timed sections",
    title: "Each section tests a different skill",
    body: "You will move through four sections of questions.",
    points: [
      "Section 1: Verbal Reasoning - tests your ability to read and comprehend written information.",
      "Section 2: Decision Making - tests your logic and problem-solving.",
      "Section 3: Quantitative Reasoning - tests your ability to solve mathematical problems.",
      "Section 4: Situational Judgement - tests your professionalism and ethics.",
    ],
    visual: "sections",
  },
  {
    kicker: "How your result is reported",
    title: "Scoring",
    body: "Your main UCAT total comes from Sections 1–3, while Situational Judgement is reported separately.",
    points: [
      "Verbal Reasoning, Decision Making and Quantitative Reasoning sections are each scaled from 300–900.",
      "Those three scores are added to give a total UCAT score from 900–2700.",
      "Situational Judgement is reported separately: as a 300–900 score in UCAT ANZ and a band in UCAT UK.",
      "Universities use Situational Judgement differently, so check each course’s admissions criteria.",
    ],
    visual: "scoring",
  },
  {
    kicker: "How the test feels",
    title: "Fast, focused and fully on screen",
    body: "The standard UCAT is designed to test quick, focused decision-making.",
    points: [
      "The computer-based test takes just under two hours.",
      "Each section is timed separately, and you cannot pause once the test begins.",
      "These sample questions are untimed so you can learn the question styles and controls before pace matters.",
    ],
    visual: "format",
  },
] as const;

const SECTION_VISUALS = [
  {
    short: "VR",
    name: "Verbal Reasoning",
    skill: "Evaluate written information",
    Icon: BookOpenText,
  },
  {
    short: "DM",
    name: "Decision Making",
    skill: "Use logic and complex information",
    Icon: Scale,
  },
  {
    short: "QR",
    name: "Quantitative Reasoning",
    skill: "Solve problems with numerical data",
    Icon: Sigma,
  },
  {
    short: "SJ",
    name: "Situational Judgement",
    skill: "Identify appropriate professional behaviour",
    Icon: HeartPulse,
  },
] as const;

const SECTION_BRIEFINGS = {
  vr: {
    questions:
      "You’ll answer two questions from one passage: a True, False or Can’t tell statement, then a multiple-choice question.",
    approach:
      "Read the stem first to understand the passage. Then read the question, return to the relevant sentence, and answer only from what the passage states.",
    watchOut:
      "Do not use outside knowledge. Choose Can’t tell when the passage does not give enough evidence either way.",
  },
  dm: {
    questions:
      "You’ll complete a five-part syllogism, then solve one question about the order of four talks.",
    approach:
      "Read the stem first, then turn each fact into a simple rule. For the syllogism, choose Yes only when a conclusion must be true. For the ordering question, place the fixed items first.",
    watchOut:
      "Do not reverse a rule such as ‘all A are B’, and do not treat something that could be true as something that must be true.",
  },
  qr: {
    questions:
      "You’ll answer two questions from one admissions table: one revenue calculation and one percentage calculation.",
    approach:
      "Read the stem first, then identify exactly which numbers the question needs. Set up one calculation and use the on-screen calculator to check it.",
    watchOut:
      "Use the correct row and denominator. Read the rounding instruction before choosing an answer.",
  },
  sjt: {
    questions:
      "You’ll answer two questions about one healthcare scenario: first how appropriate an action is, then how important one fact is.",
    approach:
      "Read the stem first and identify the professional duty at risk. Then judge whether the action protects the patient and is proportionate to the situation.",
    watchOut:
      "Answer the exact scale being asked.",
  },
} as const;

const FAMILIARITY_BRIEFING = {
  new: "We’ll coach you through the method and keep you on each question until you reach the correct answer.",
  familiar:
    "Use these questions to practice the method. We’ll give feedback after you submit and step in with a hint if needed.",
  experienced:
    "Treat these as a quick technique check. Coaching stays minimal, but feedback and hints are available if you need them.",
} as const satisfies Record<UcatFamiliarity, string>;

function SectionBriefing({
  sectionIndex,
  familiarity,
  onContinue,
}: {
  sectionIndex: number;
  familiarity: UcatFamiliarity;
  onContinue: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const section = GUIDED_SAMPLER_SECTIONS[sectionIndex];
  const briefing = SECTION_BRIEFINGS[section.key];
  const visual = SECTION_VISUALS.find(
    (item) => item.short === section.shortName,
  );
  const Icon = visual?.Icon ?? BookOpenText;

  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden bg-background px-4 py-10 text-foreground transition-colors">
      <NoiseOverlay />
      <OnboardingThemeToggle />
      <motion.div
        initial={
          reduceMotion ? { opacity: 1 } : { opacity: 0, y: 18, scale: 0.985 }
        }
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{
          duration: reduceMotion ? 0 : 0.3,
          ease: [0.22, 1, 0.36, 1],
        }}
        className="relative z-10 w-full max-w-4xl overflow-hidden rounded-3xl border border-border bg-card/80 shadow-2xl backdrop-blur"
      >
        <div className="grid md:grid-cols-[1fr_0.72fr]">
          <div className="flex flex-col p-6 sm:p-9">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary dark:text-accent">
              Section {sectionIndex + 1} of {GUIDED_SAMPLER_SECTIONS.length} ·{" "}
              {section.shortName}
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              {section.name}
            </h1>
            <p className="mt-3 text-base leading-relaxed text-muted-foreground">
              {FAMILIARITY_BRIEFING[familiarity]}
            </p>

            <dl className="mt-7 space-y-4 text-sm leading-relaxed">
              <div>
                <dt className="font-semibold text-foreground">
                  What you’ll do
                </dt>
                <dd className="mt-1 text-muted-foreground">
                  {briefing.questions}
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-foreground">
                  How to approach it
                </dt>
                <dd className="mt-1 text-muted-foreground">
                  {briefing.approach}
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-foreground">Watch out for</dt>
                <dd className="mt-1 text-muted-foreground">
                  {briefing.watchOut}
                </dd>
              </div>
            </dl>

            <div className="mt-8 flex justify-end">
              <Button
                type="button"
                onClick={onContinue}
                className={UCAT_PRIMARY_ACTION_BUTTON}
              >
                Start 2 {section.shortName} questions
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
              </Button>
            </div>
          </div>

          <div className="relative grid min-h-64 place-items-center overflow-hidden border-t border-border bg-primary/[0.04] p-8 md:border-l md:border-t-0 dark:bg-accent/[0.06]">
            <motion.div
              aria-hidden
              className="absolute h-64 w-64 rounded-full bg-marketing-primary/35 blur-3xl"
              animate={reduceMotion ? undefined : { scale: [0.9, 1.08, 0.9] }}
              transition={{ duration: 4, repeat: Infinity }}
            />
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, scale: 0.86 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: reduceMotion ? 0 : 0.12 }}
              className="relative text-center"
            >
              <span className="mx-auto flex h-24 w-24 items-center justify-center rounded-3xl bg-primary text-primary-foreground shadow-[0_0_55px_rgba(146,185,198,0.3)] dark:bg-accent">
                <Icon className="h-10 w-10" aria-hidden />
              </span>
              <p className="mt-5 text-2xl font-semibold text-foreground">
                2 sample questions
              </p>
              <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
                Untimed. Submit each answer to get feedback before moving on.
              </p>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </main>
  );
}

function UcatInfoVisual({
  visual,
}: {
  visual: (typeof UCAT_INFO_SLIDES)[number]["visual"];
}) {
  if (visual === "sections") {
    return (
      <div className="mx-auto grid w-full max-w-sm gap-2 sm:grid-cols-2">
        {SECTION_VISUALS.map(({ short, name, skill, Icon }, index) => (
          <motion.div
            key={short}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.07 }}
            className="rounded-2xl border border-border bg-card/70 p-3"
          >
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary dark:bg-accent/15 dark:text-accent">
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              <div>
                <p className="text-xs font-bold text-primary dark:text-accent">
                  {short}
                </p>
                <p className="text-sm font-semibold text-foreground">{name}</p>
              </div>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              {skill}
            </p>
          </motion.div>
        ))}
      </div>
    );
  }

  if (visual === "format") {
    return (
      <div className="relative mx-auto flex h-64 w-full max-w-md items-center justify-center">
        <motion.div
          className="absolute h-44 w-44 rounded-full border border-dashed border-primary/30 dark:border-accent/30"
          animate={{ rotate: 360 }}
          transition={{ duration: 18, ease: "linear", repeat: Infinity }}
          aria-hidden
        />
        <div className="relative grid h-36 w-36 place-items-center rounded-full border border-border bg-card/80 text-center shadow-[0_0_55px_rgba(146,185,198,0.12)]">
          <div>
            <p className="text-3xl font-semibold text-foreground">~2h</p>
            <p className="mt-1 text-xs text-muted-foreground">
              separately timed
            </p>
          </div>
        </div>
        {[Calculator, Flag, ListChecks].map((Icon, index) => (
          <motion.span
            key={index}
            className="absolute flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-background text-primary shadow-xl dark:text-accent"
            style={{
              left: `${10 + index * 40}%`,
              top: index === 1 ? "9%" : "70%",
            }}
            animate={{ y: [0, -5, 0] }}
            transition={{
              duration: 2.2,
              delay: index * 0.2,
              repeat: Infinity,
            }}
          >
            <Icon className="h-4 w-4" aria-hidden />
          </motion.span>
        ))}
      </div>
    );
  }

  if (visual === "scoring") {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-2">
          {["VR", "DM", "QR"].map((section, index) => (
            <React.Fragment key={section}>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="rounded-2xl border border-border bg-card/70 px-2 py-4 text-center"
              >
                <p className="text-xs font-semibold text-primary dark:text-accent">
                  {section}
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  300–900
                </p>
              </motion.div>
              {index < 2 ? (
                <motion.span
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 + index * 0.1 }}
                  className="text-primary dark:text-accent"
                  aria-hidden
                >
                  +
                </motion.span>
              ) : null}
            </React.Fragment>
          ))}
        </div>
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
          className="rounded-2xl bg-primary p-4 text-center text-primary-foreground shadow-[0_0_45px_rgba(146,185,198,0.2)] dark:bg-accent dark:text-primary-foreground"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.16em]">
            UCAT Score
          </p>
          <p className="mt-1 text-3xl font-semibold">900–2700</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
          className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card/70 px-4 py-3"
        >
          <div>
            <p className="text-sm font-semibold text-foreground">
              Situational Judgement
            </p>
            <p className="text-xs text-muted-foreground">Reported separately</p>
          </div>
          <span className="rounded-full bg-muted px-3 py-1.5 text-xs font-semibold text-primary dark:text-accent">
            Score or band
          </span>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="relative mx-auto flex h-64 w-full max-w-md items-center justify-center">
      <motion.div
        className="absolute h-40 w-40 rounded-full bg-primary/10 blur-2xl dark:bg-accent/10"
        animate={{ scale: [0.9, 1.15, 0.9] }}
        transition={{ duration: 3.2, repeat: Infinity }}
        aria-hidden
      />
      <span className="relative flex h-24 w-24 items-center justify-center rounded-3xl bg-primary text-primary-foreground shadow-[0_0_55px_rgba(146,185,198,0.3)] dark:bg-accent dark:text-primary-foreground">
        <Stethoscope className="h-10 w-10" aria-hidden />
      </span>
      {["Aptitude", "Admissions", "No subject recall"].map((label, index) => (
        <motion.span
          key={label}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1, y: [0, -3, 0] }}
          transition={{
            delay: index * 0.12,
            y: { duration: 2.4, repeat: Infinity },
          }}
          className={cn(
            "absolute whitespace-nowrap rounded-full border border-border bg-background px-4 py-2 text-xs text-muted-foreground shadow-xl",
            index === 0 && "left-0 top-[18%]",
            index === 1 && "right-0 top-[30%]",
            index === 2 && "bottom-[14%] left-[12%]",
          )}
        >
          {label}
        </motion.span>
      ))}
    </div>
  );
}

function UcatInfoSlideshow({ onComplete }: { onComplete: () => void }) {
  const reduceMotion = useReducedMotion();
  const [slideIndex, setSlideIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const slide = UCAT_INFO_SLIDES[slideIndex];
  const isLast = slideIndex === UCAT_INFO_SLIDES.length - 1;

  function goToSlide(nextIndex: number) {
    if (nextIndex === slideIndex) return;
    setDirection(nextIndex > slideIndex ? 1 : -1);
    setSlideIndex(nextIndex);
  }

  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden bg-background px-4 py-10 text-foreground transition-colors">
      <NoiseOverlay />
      <OnboardingThemeToggle />
      <motion.div
        layout={!reduceMotion}
        layoutDependency={slideIndex}
        initial={
          reduceMotion ? { opacity: 1 } : { opacity: 0, y: 18, scale: 0.985 }
        }
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{
          duration: reduceMotion ? 0 : 0.3,
          ease: [0.22, 1, 0.36, 1],
          layout: reduceMotion
            ? { duration: 0 }
            : { type: "spring", stiffness: 270, damping: 30, mass: 0.85 },
        }}
        className="relative z-10 w-full max-w-4xl overflow-hidden rounded-3xl border border-border bg-card/80 shadow-2xl backdrop-blur"
      >
        <div className="grid min-h-[530px] w-full md:block">
          <motion.div
            layout={!reduceMotion}
            layoutDependency={slideIndex}
            transition={{
              layout: reduceMotion
                ? { duration: 0 }
                : { type: "spring", stiffness: 270, damping: 30, mass: 0.85 },
            }}
            className="relative flex flex-col p-6 sm:p-9 md:w-[52.5%]"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary dark:text-accent">
              UCAT essentials · {slideIndex + 1} of {UCAT_INFO_SLIDES.length}
            </p>
            <AnimatePresence
              mode="popLayout"
              initial={false}
              custom={direction}
            >
              <motion.div
                key={slide.title}
                initial={
                  reduceMotion ? { opacity: 1, x: 0 } : { opacity: 0, x: 20 }
                }
                animate={{ opacity: 1, x: 0 }}
                exit={
                  reduceMotion ? { opacity: 0, x: 0 } : { opacity: 0, x: -20 }
                }
                transition={{
                  duration: reduceMotion ? 0 : 0.28,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="my-auto py-8"
              >
                <p className="text-sm font-medium text-primary dark:text-accent">
                  {slide.kicker}
                </p>
                <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                  {slide.title}
                </h1>
                <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
                  {slide.body}
                </p>
                <ul className="mt-5 space-y-2.5 text-sm leading-relaxed text-muted-foreground">
                  {slide.points.map((point) => (
                    <li key={point} className="flex gap-3">
                      <span
                        className="mt-[0.55em] h-1.5 w-1.5 shrink-0 rounded-full bg-primary dark:bg-accent"
                        aria-hidden
                      />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            </AnimatePresence>

            <div className="flex items-center justify-between gap-4">
              <div
                className="flex gap-2"
                aria-label="UCAT introduction progress"
              >
                {UCAT_INFO_SLIDES.map((item, index) => (
                  <button
                    key={item.title}
                    type="button"
                    onClick={() => goToSlide(index)}
                    aria-label={`Go to slide ${index + 1}`}
                    aria-current={index === slideIndex ? "step" : undefined}
                    className={cn(
                      "h-2 rounded-full transition-all",
                      index === slideIndex
                        ? "w-8 bg-primary dark:bg-accent"
                        : "w-2 bg-muted-foreground/25 hover:bg-muted-foreground/45",
                    )}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                {slideIndex > 0 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => goToSlide(slideIndex - 1)}
                    className="text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <ArrowLeft className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                    Back
                  </Button>
                ) : null}
                <Button
                  type="button"
                  onClick={() =>
                    isLast ? onComplete() : goToSlide(slideIndex + 1)
                  }
                  className={UCAT_PRIMARY_ACTION_BUTTON}
                >
                  {isLast ? "Start sample questions" : "Next"}
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
                </Button>
              </div>
            </div>
          </motion.div>

          <div className="relative grid min-w-0 w-full place-items-center self-stretch overflow-hidden border-t border-border bg-primary/[0.04] p-6 sm:p-9 md:absolute md:inset-y-0 md:right-0 md:w-[47.5%] md:border-l md:border-t-0 dark:bg-accent/[0.06]">
            <motion.div
              aria-hidden
              className="absolute h-72 w-72 rounded-full bg-marketing-primary/35 blur-3xl"
              animate={{ x: [-20, 25, -20], y: [10, -20, 10] }}
              transition={{ duration: 8, repeat: Infinity }}
            />
            <AnimatePresence
              mode="popLayout"
              initial={false}
              custom={direction}
            >
              <motion.div
                key={slide.visual}
                custom={direction}
                initial={
                  reduceMotion
                    ? { opacity: 1 }
                    : { opacity: 0, scale: 0.96, x: direction * 18 }
                }
                animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
                exit={
                  reduceMotion
                    ? { opacity: 0 }
                    : { opacity: 0, scale: 0.97, x: direction * -18 }
                }
                transition={{
                  duration: reduceMotion ? 0 : 0.28,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="relative grid h-full w-full place-items-center"
              >
                <UcatInfoVisual visual={slide.visual} />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </main>
  );
}

export function GuidedSamplerPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialFamiliarity = parseFamiliarity(searchParams.get("familiarity"));
  const [familiarity, setFamiliarity] = useState<UcatFamiliarity | null>(
    () => initialFamiliarity,
  );
  const [sectionIndex, setSectionIndex] = useState(0);
  const [samplerStarted, setSamplerStarted] = useState(
    initialFamiliarity !== "new",
  );
  const [showSectionBriefing, setShowSectionBriefing] = useState(true);
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
  const inactivityAnchorMsRef = useRef(Date.now());
  const lastInactivityLevelRef = useRef(-1);
  const completeMilestone = useCompleteOnboardingTour();
  const afterPlan = searchParams.get("afterPlan") === "1";
  const replay = searchParams.get("replay") === "1";
  const returnTo = safePostAuthReturnPath(searchParams.get("redirect"));
  const section = GUIDED_SAMPLER_SECTIONS[sectionIndex];
  const steps = coachSteps(snapshot);
  const activeCoachStep = steps[guideStepIndex] ?? null;
  const inactivityNudgesEnabled =
    familiarity === "experienced" || Boolean(activeCoachStep?.awaitingAnswer);
  const lockedQuestionIds = useMemo(
    () => [...correctQuestionIds],
    [correctQuestionIds],
  );
  const currentQuestionIsCorrect = Boolean(
    snapshot.questionId && correctQuestionIds.has(snapshot.questionId),
  );
  const showCorrectNext =
    feedback?.kind === "correct" && feedback.questionId === snapshot.questionId;

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

  // Reset the inactivity clock whenever the student engages with an answer.
  useEffect(() => {
    inactivityAnchorMsRef.current = Date.now();
    lastInactivityLevelRef.current = -1;
  }, [
    inactivityNudgesEnabled,
    snapshot.questionId,
    snapshot.selectedOptionId,
    snapshot.syllogismSnapshot,
  ]);

  // Escalate inactivity hints at 1×, 1.5×, 2×… section exam seconds-per-question.
  useEffect(() => {
    if (!inactivityNudgesEnabled) return;
    const questionId = snapshot.questionId;
    if (!questionId || correctQuestionIds.has(questionId)) return;
    const timePerQuestion = section.timePerQuestionSeconds;
    if (timePerQuestion <= 0) return;
    const questionFeedback = GUIDED_SAMPLER_FEEDBACK[questionId];
    if (!questionFeedback?.hints.length) return;

    const tick = () => {
      setFeedback((current) => {
        // Never interrupt submit feedback, control coaching, or other focus prompts.
        if (
          current &&
          !(
            current.kind === "focus" && current.title === INACTIVITY_NUDGE_TITLE
          )
        ) {
          return current;
        }

        const level = inactivityHintLevel(
          Date.now() - inactivityAnchorMsRef.current,
          timePerQuestion,
        );
        if (level == null || level <= lastInactivityLevelRef.current) {
          return current;
        }

        const hintIndex = Math.min(level, questionFeedback.hints.length - 1);
        lastInactivityLevelRef.current = level;
        return {
          kind: "focus",
          title: INACTIVITY_NUDGE_TITLE,
          body:
            hintIndex === 0
              ? "You’re doing fine. Use this clue, then keep working through the current question."
              : "Still working it out? Here’s a clearer clue.",
          hint: questionFeedback.hints[hintIndex],
          questionId,
        };
      });
    };

    const timer = window.setInterval(tick, 400);
    tick();
    return () => window.clearInterval(timer);
  }, [
    correctQuestionIds,
    inactivityNudgesEnabled,
    section.timePerQuestionSeconds,
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
        if (familiarity === "experienced") return true;
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
          body: "Choose an answer before moving on. These sample questions will keep you here until you have worked it through.",
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
        if (familiarity === "experienced") return true;
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

      if (familiarity === "experienced") {
        return control !== "navigator";
      }

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
          body: "Navigator lets you jump between questions in a full session. These sample questions keep you focused on one question at a time, so answer this one before moving on.",
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
    [familiarity, sectionIndex],
  );

  const destination = useMemo(() => {
    if (replay) return "/dashboard";
    if (afterPlan) return returnTo;
    return pathWithReturnIntent("/signup/complete", returnTo, {
      sampler: "complete",
    });
  }, [afterPlan, replay, returnTo]);

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
    if (!familiarity) return;
    setPending(true);
    setError(null);
    try {
      await patchSignupProgress({ familiarity });
      await completeMilestone.mutateAsync(UCAT_GUIDED_SAMPLER_DECIDED);
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
      // Soft-nav to /dashboard races middleware signup-complete gate.
      if (destination.startsWith("/dashboard")) {
        navigateAfterAuth(destination);
        return;
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
    return (
      <FamiliarityEntry
        onChoose={(value) => {
          setFamiliarity(value);
          setSamplerStarted(value !== "new");
        }}
      />
    );
  }

  if (!samplerStarted) {
    return <UcatInfoSlideshow onComplete={() => setSamplerStarted(true)} />;
  }

  if (showSectionBriefing) {
    return (
      <SectionBriefing
        sectionIndex={sectionIndex}
        familiarity={familiarity}
        onContinue={() => setShowSectionBriefing(false)}
      />
    );
  }

  if (showReadout) {
    return (
      <main className="relative grid min-h-dvh place-items-center overflow-hidden bg-background px-4 py-10 text-foreground transition-colors">
        <NoiseOverlay />
        <OnboardingThemeToggle />
        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: 18 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="relative z-10 w-full max-w-2xl rounded-3xl border border-primary/20 bg-card/80 p-6 shadow-2xl backdrop-blur dark:border-accent/20 sm:p-9"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary dark:bg-accent/15 dark:text-accent">
            <Sparkles className="h-5 w-5" aria-hidden />
          </span>
          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-primary dark:text-accent">
            Ready for real practice
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
            You’ve explored the whole UCAT experience
          </h1>
          <p className="mt-3 text-muted-foreground">
            You worked every question through to the correct answer.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {GUIDED_SAMPLER_SECTIONS.map((item) => {
              const correctCount = item.questions.filter((question) =>
                correctQuestionIds.has(question.id),
              ).length;
              const total = item.questions.length;
              return (
                <div
                  key={item.key}
                  className="rounded-2xl border border-border bg-background/50 p-4"
                >
                  <p className="text-2xl font-semibold text-foreground">
                    {correctCount}/{total}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {item.shortName} · {item.name}
                  </p>
                </div>
              );
            })}
          </div>
          {error ? (
            <p className="mt-4 text-sm text-destructive-foreground">{error}</p>
          ) : null}
          <div className="mt-7 flex justify-end">
            <Button
              onClick={() => void persistDecision(true)}
              disabled={pending}
              className={UCAT_PRIMARY_ACTION_BUTTON}
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
            <ThemeToggle />
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8"
              onClick={() => void persistDecision(false)}
              disabled={pending}
            >
              Skip sample questions
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
          tutorialPrimaryActionLabel={showCorrectNext ? "Next" : "Submit"}
          tutorialHidePrimaryAction={
            currentQuestionIsCorrect && !showCorrectNext
          }
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
            setShowSectionBriefing(true);
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
        ) : familiarity !== "experienced" && activeCoachStep ? (
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
