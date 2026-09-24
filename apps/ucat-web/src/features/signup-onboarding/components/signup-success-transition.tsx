"use client";

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentType,
} from "react";
import {
  BarChart3,
  BookOpen,
  BrainCircuit,
  CalendarCheck2,
  Check,
  ListChecks,
  Sparkles,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { MARKETING_TOKENS } from "@altitutor/shared";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { NoiseOverlay } from "@/features/landing/components/marketing/noise-overlay";
import { DashboardDataPreloader } from "@/features/dashboard/components/dashboard-data-preloader";
import { UCAT_PRODUCT_NAME } from "@/lib/ucat-brand";

const { typography: typo } = MARKETING_TOKENS;

export type SignupSuccessJourney = "free" | "paid";
export type SignupSuccessOccasion = "signup" | "upgrade";

type SignupBenefit = {
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
};

const PAID_BENEFITS: ReadonlyArray<SignupBenefit> = [
  {
    title: "Practice without limits",
    description: "Every UCAT section, mock and skill trainer is ready for you.",
    icon: BrainCircuit,
  },
  {
    title: "See progress clearly",
    description: "Track your scores, timing and improvement in one place.",
    icon: BarChart3,
  },
  {
    title: "Know what to do next",
    description: "Your learning and practice tools adapt as you improve.",
    icon: BookOpen,
  },
];

const FREE_BENEFITS: ReadonlyArray<SignupBenefit> = [
  {
    title: "Start practicing straight away",
    description: "Explore UCAT questions and begin building a steady routine.",
    icon: BrainCircuit,
  },
  {
    title: "See progress clearly",
    description: "Track your scores, timing and improvement in one place.",
    icon: BarChart3,
  },
  {
    title: "Know what to do next",
    description: "Use your learning and practice tools to keep moving forward.",
    icon: BookOpen,
  },
];

const STUDY_PLAN_BENEFITS: ReadonlyArray<SignupBenefit> = [
  {
    title: "Your Study plan is ready",
    description:
      "Your target, UCAT year and realistic weekly rhythm are saved.",
    icon: CalendarCheck2,
  },
  {
    title: "Your first tasks are prepared",
    description:
      "Your dashboard will open with a clear recommendation for what to do first.",
    icon: ListChecks,
  },
  {
    title: "Your plan will keep adapting",
    description:
      "As you complete real work, your results will sharpen what comes next.",
    icon: BarChart3,
  },
];

export type SignupSuccessTransitionPhase = "confirming" | "welcome";
export type StudyPlanCompletionStatus = "created" | "skipped";

type SignupSuccessTransitionProps = {
  journey: SignupSuccessJourney;
  occasion: SignupSuccessOccasion;
  phase: SignupSuccessTransitionPhase;
  isTakingLonger: boolean;
  error: string | null;
  onRetry: () => void;
  onComplete: () => void;
  studyPlanStatus?: StudyPlanCompletionStatus;
  preloadDashboard?: boolean;
};

export function SignupSuccessTransition({
  journey,
  occasion,
  phase,
  isTakingLonger,
  error,
  onRetry,
  onComplete,
  studyPlanStatus,
  preloadDashboard = false,
}: SignupSuccessTransitionProps) {
  const reduceMotion = useReducedMotion();
  const [benefitIndex, setBenefitIndex] = useState(0);
  const [dashboardDataSettled, setDashboardDataSettled] =
    useState(!preloadDashboard);
  const [welcomeMinimumElapsed, setWelcomeMinimumElapsed] = useState(false);
  // Parents often pass an inline onComplete; without this, welcome-phase
  // re-renders spam router.replace and trip Safari's history rate limit.
  const completionFiredRef = useRef(false);
  const isPaidJourney = journey === "paid";
  const isUpgrade = occasion === "upgrade";
  const isStudyPlanCompletion = studyPlanStatus != null;
  const benefits =
    studyPlanStatus === "created"
      ? STUDY_PLAN_BENEFITS
      : isPaidJourney
        ? PAID_BENEFITS
        : FREE_BENEFITS;

  useEffect(() => {
    if (phase !== "confirming" || reduceMotion) return;

    const timer = window.setInterval(() => {
      setBenefitIndex((current) => (current + 1) % benefits.length);
    }, 1_350);

    return () => window.clearInterval(timer);
  }, [benefits, phase, reduceMotion]);

  const markDashboardDataSettled = useCallback(
    () => setDashboardDataSettled(true),
    [],
  );

  useEffect(() => {
    if (phase !== "welcome") {
      setWelcomeMinimumElapsed(false);
      completionFiredRef.current = false;
      return;
    }

    const timer = window.setTimeout(
      () => setWelcomeMinimumElapsed(true),
      reduceMotion ? 700 : 2_700,
    );
    return () => window.clearTimeout(timer);
  }, [phase, reduceMotion]);

  useEffect(() => {
    if (phase !== "welcome" || !welcomeMinimumElapsed || !dashboardDataSettled) {
      return;
    }
    if (completionFiredRef.current) return;
    completionFiredRef.current = true;
    onComplete();
  }, [dashboardDataSettled, onComplete, phase, welcomeMinimumElapsed]);

  const benefit = benefits[benefitIndex];
  const BenefitIcon = benefit.icon;

  return (
    <div className="relative flex min-h-dvh overflow-hidden bg-background text-foreground transition-colors">
      {preloadDashboard ? (
        <DashboardDataPreloader onSettled={markDashboardDataSettled} />
      ) : null}
      <NoiseOverlay />
      <div className="fixed right-4 top-4 z-50 sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>

      <motion.div
        aria-hidden
        className="absolute -left-36 top-[-12rem] h-[30rem] w-[30rem] rounded-full bg-primary/15 blur-3xl dark:bg-primary/60"
        animate={
          reduceMotion
            ? undefined
            : { x: [0, 80, 20], y: [0, 35, 0], scale: [1, 1.12, 1] }
        }
        transition={{ duration: 8, ease: "easeInOut", repeat: Infinity }}
      />
      <motion.div
        aria-hidden
        className="absolute -bottom-48 -right-28 h-[28rem] w-[28rem] rounded-full bg-primary/10 blur-3xl dark:bg-accent/15"
        animate={
          reduceMotion
            ? undefined
            : { x: [0, -65, 0], y: [0, -30, 0], scale: [1, 1.18, 1] }
        }
        transition={{ duration: 9, ease: "easeInOut", repeat: Infinity }}
      />

      <AnimatePresence mode="wait" initial={false}>
        {phase === "confirming" ? (
          <motion.main
            key="confirming"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -18, scale: 0.98 }}
            transition={{ duration: reduceMotion ? 0 : 0.45 }}
            className="relative z-10 mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center px-5 py-12 text-center"
          >
            <div className="relative mb-9 flex h-24 w-24 items-center justify-center">
              <motion.div
                aria-hidden
                className="absolute inset-0 rounded-full border border-primary/25 border-t-primary dark:border-accent/25 dark:border-t-accent"
                animate={reduceMotion ? undefined : { rotate: 360 }}
                transition={{ duration: 2.8, ease: "linear", repeat: Infinity }}
              />
              <motion.div
                aria-hidden
                className="absolute inset-2 rounded-full border border-dashed border-foreground/20"
                animate={reduceMotion ? undefined : { rotate: -360 }}
                transition={{ duration: 7, ease: "linear", repeat: Infinity }}
              />
              <motion.div
                className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_0_50px_rgba(146,185,198,0.35)] dark:bg-accent dark:text-primary-foreground"
                animate={reduceMotion ? undefined : { scale: [1, 1.07, 1] }}
                transition={{
                  duration: 1.8,
                  ease: "easeInOut",
                  repeat: Infinity,
                }}
              >
                <Sparkles className="h-6 w-6" aria-hidden />
              </motion.div>
            </div>

            <p
              className={`text-xs font-bold uppercase tracking-[0.24em] text-primary dark:text-accent ${typo.dataMono}`}
            >
              {studyPlanStatus === "created"
                ? "Study plan saved"
                : studyPlanStatus === "skipped"
                  ? "Finishing your setup"
                  : isPaidJourney
                    ? "Your plan is unlocking"
                    : "Your UCAT journey starts here"}
            </p>
            <h1
              className={`mt-3 text-3xl font-bold sm:text-4xl ${typo.headingSans}`}
            >
              {isStudyPlanCompletion
                ? "Setting up your UCAT workspace"
                : isPaidJourney
                  ? "Building your UCAT workspace"
                  : "Personalising your UCAT workspace"}
            </h1>
            <p
              className={`mt-3 max-w-md text-muted-foreground ${typo.secondarySans}`}
            >
              {studyPlanStatus === "created"
                ? "Your Study plan is saved. We’re preparing your dashboard and first recommended tasks around it."
                : studyPlanStatus === "skipped"
                  ? "We’re preparing your dashboard now. You can build a Study plan later from Settings."
                  : isPaidJourney
                    ? "Your payment is complete. We’re preparing everything included in your plan."
                    : "Your Free plan is ready. We’re preparing a clear place to learn, practice and improve."}
            </p>

            <div
              className="mt-9 w-full overflow-hidden rounded-3xl border border-border bg-card/80 p-5 text-left shadow-2xl backdrop-blur-sm sm:p-6"
              aria-live="polite"
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={benefit.title}
                  initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduceMotion ? undefined : { opacity: 0, y: -10 }}
                  transition={{ duration: 0.28 }}
                  className="flex items-start gap-4"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary dark:bg-accent/15 dark:text-accent">
                    <BenefitIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className={`font-semibold ${typo.headingSans}`}>
                      {benefit.title}
                    </h2>
                    <p
                      className={`mt-1 text-sm leading-relaxed text-muted-foreground ${typo.secondarySans}`}
                    >
                      {benefit.description}
                    </p>
                  </div>
                </motion.div>
              </AnimatePresence>

              <div className="mt-5 grid grid-cols-3 gap-2" aria-hidden>
                {benefits.map((item, index) => (
                  <div
                    key={item.title}
                    className="h-1 overflow-hidden rounded-full bg-muted"
                  >
                    <motion.div
                      className="h-full origin-left rounded-full bg-primary dark:bg-accent"
                      animate={{ scaleX: index === benefitIndex ? 1 : 0 }}
                      transition={{ duration: reduceMotion ? 0 : 0.35 }}
                    />
                  </div>
                ))}
              </div>
            </div>

            {error ? (
              <div
                role="alert"
                className={`mt-5 w-full rounded-2xl border border-red-300/15 bg-red-400/10 p-4 text-sm text-red-100 ${typo.secondarySans}`}
              >
                <p>We couldn’t finish setting up your dashboard. {error}</p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={onRetry}
                  className="mt-3 bg-transparent"
                >
                  Try again
                </Button>
              </div>
            ) : !isStudyPlanCompletion && isPaidJourney && isTakingLonger ? (
              <p
                className={`mt-5 text-sm text-muted-foreground ${typo.secondarySans}`}
                role="status"
              >
                Payment received — your subscription details are taking a little
                longer than usual to arrive.
              </p>
            ) : (
              <p
                className={`mt-5 text-sm text-muted-foreground ${typo.secondarySans}`}
                role="status"
              >
                {studyPlanStatus === "created"
                  ? "Preparing your dashboard and first tasks…"
                  : studyPlanStatus === "skipped"
                    ? "Preparing your dashboard…"
                    : isPaidJourney
                      ? "Finishing the last few details…"
                      : "Preparing your dashboard…"}
              </p>
            )}
          </motion.main>
        ) : (
          <motion.main
            key="welcome"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.5 }}
            className="relative z-10 mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center overflow-visible px-5 py-12 text-center"
          >
            <motion.div
              aria-hidden
              className="absolute left-1/2 top-1/2 -z-10 h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary"
              initial={{ scale: 0, opacity: 0 }}
              animate={
                reduceMotion
                  ? { opacity: 0 }
                  : { scale: [0, 0, 18], opacity: [0, 0, 1] }
              }
              transition={{
                duration: 2.7,
                times: [0, 0.72, 1],
                ease: "easeIn",
              }}
            />

            <motion.div
              initial={{ scale: 0.45, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{
                duration: reduceMotion ? 0 : 0.55,
                type: "spring",
                bounce: 0.45,
              }}
              className="flex h-24 w-24 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_0_70px_rgba(146,185,198,0.45)] dark:bg-accent dark:text-primary-foreground"
            >
              <Check className="h-11 w-11 stroke-[2.5]" aria-hidden />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduceMotion ? 0 : 0.3, duration: 0.5 }}
              className="mt-8"
            >
              <p
                className={`text-xs font-bold uppercase tracking-[0.24em] text-primary dark:text-accent ${typo.dataMono}`}
              >
                {isUpgrade ? "Upgrade complete" : "Thank you for joining us"}
              </p>
              <h1
                className={`mt-3 text-4xl font-bold sm:text-6xl ${typo.headingSans}`}
              >
                {isUpgrade
                  ? "Your new plan is ready"
                  : `Welcome to ${UCAT_PRODUCT_NAME}`}
              </h1>
              <p className={`mt-4 text-muted-foreground ${typo.secondarySans}`}>
                {isUpgrade
                  ? "Your upgraded UCAT access is ready. Taking you back into the app…"
                  : "Your UCAT workspace is ready. Opening your dashboard…"}
              </p>
            </motion.div>
          </motion.main>
        )}
      </AnimatePresence>
    </div>
  );
}
