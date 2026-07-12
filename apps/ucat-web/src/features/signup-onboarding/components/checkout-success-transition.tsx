"use client";

import { useEffect, useState, type ComponentType } from "react";
import {
  BarChart3,
  BookOpen,
  BrainCircuit,
  Check,
  Sparkles,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { MARKETING_TOKENS } from "@altitutor/shared";
import { Button } from "@/components/ui/button";
import { NoiseOverlay } from "@/features/landing/components/marketing/noise-overlay";

const { typography: typo } = MARKETING_TOKENS;

const BENEFITS: ReadonlyArray<{
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
}> = [
  {
    title: "Practise without limits",
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

export type CheckoutSuccessTransitionPhase = "confirming" | "welcome";

type CheckoutSuccessTransitionProps = {
  phase: CheckoutSuccessTransitionPhase;
  isTakingLonger: boolean;
  error: string | null;
  onRetry: () => void;
  onComplete: () => void;
};

export function CheckoutSuccessTransition({
  phase,
  isTakingLonger,
  error,
  onRetry,
  onComplete,
}: CheckoutSuccessTransitionProps) {
  const reduceMotion = useReducedMotion();
  const [benefitIndex, setBenefitIndex] = useState(0);

  useEffect(() => {
    if (phase !== "confirming" || reduceMotion) return;

    const timer = window.setInterval(() => {
      setBenefitIndex((current) => (current + 1) % BENEFITS.length);
    }, 1_350);

    return () => window.clearInterval(timer);
  }, [phase, reduceMotion]);

  useEffect(() => {
    if (phase !== "welcome") return;

    const timer = window.setTimeout(onComplete, reduceMotion ? 700 : 2_700);
    return () => window.clearTimeout(timer);
  }, [onComplete, phase, reduceMotion]);

  const benefit = BENEFITS[benefitIndex];
  const BenefitIcon = benefit.icon;

  return (
    <div className="relative flex min-h-dvh overflow-hidden bg-marketing-charcoal text-marketing-cream">
      <NoiseOverlay />

      <motion.div
        aria-hidden
        className="absolute -left-36 top-[-12rem] h-[30rem] w-[30rem] rounded-full bg-marketing-primary/60 blur-3xl"
        animate={
          reduceMotion
            ? undefined
            : { x: [0, 80, 20], y: [0, 35, 0], scale: [1, 1.12, 1] }
        }
        transition={{ duration: 8, ease: "easeInOut", repeat: Infinity }}
      />
      <motion.div
        aria-hidden
        className="absolute -bottom-48 -right-28 h-[28rem] w-[28rem] rounded-full bg-marketing-accent/15 blur-3xl"
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
                className="absolute inset-0 rounded-full border border-marketing-accent/25 border-t-marketing-accent"
                animate={reduceMotion ? undefined : { rotate: 360 }}
                transition={{ duration: 2.8, ease: "linear", repeat: Infinity }}
              />
              <motion.div
                aria-hidden
                className="absolute inset-2 rounded-full border border-dashed border-marketing-cream/20"
                animate={reduceMotion ? undefined : { rotate: -360 }}
                transition={{ duration: 7, ease: "linear", repeat: Infinity }}
              />
              <motion.div
                className="flex h-14 w-14 items-center justify-center rounded-full bg-marketing-accent text-marketing-charcoal shadow-[0_0_50px_rgba(146,185,198,0.35)]"
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
              className={`text-xs font-bold uppercase tracking-[0.24em] text-marketing-accent ${typo.dataMono}`}
            >
              Your plan is unlocking
            </p>
            <h1
              className={`mt-3 text-3xl font-bold sm:text-4xl ${typo.headingSans}`}
            >
              Building your UCAT workspace
            </h1>
            <p
              className={`mt-3 max-w-md text-marketing-cream/60 ${typo.secondarySans}`}
            >
              Your payment is complete. We’re preparing everything included in
              your plan.
            </p>

            <div
              className="mt-9 w-full overflow-hidden rounded-3xl border border-marketing-cream/10 bg-marketing-cream/[0.06] p-5 text-left shadow-2xl backdrop-blur-sm sm:p-6"
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
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-marketing-accent/15 text-marketing-accent">
                    <BenefitIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className={`font-semibold ${typo.headingSans}`}>
                      {benefit.title}
                    </h2>
                    <p
                      className={`mt-1 text-sm leading-relaxed text-marketing-cream/55 ${typo.secondarySans}`}
                    >
                      {benefit.description}
                    </p>
                  </div>
                </motion.div>
              </AnimatePresence>

              <div className="mt-5 grid grid-cols-3 gap-2" aria-hidden>
                {BENEFITS.map((item, index) => (
                  <div
                    key={item.title}
                    className="h-1 overflow-hidden rounded-full bg-marketing-cream/10"
                  >
                    <motion.div
                      className="h-full origin-left rounded-full bg-marketing-accent"
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
                  className="mt-3 border-marketing-cream/20 bg-transparent text-marketing-cream hover:bg-marketing-cream/10 hover:text-marketing-cream"
                >
                  Try again
                </Button>
              </div>
            ) : isTakingLonger ? (
              <p
                className={`mt-5 text-sm text-marketing-cream/50 ${typo.secondarySans}`}
                role="status"
              >
                Payment received — your subscription details are taking a little
                longer than usual to arrive.
              </p>
            ) : (
              <p
                className={`mt-5 text-sm text-marketing-cream/40 ${typo.secondarySans}`}
                role="status"
              >
                Finishing the last few details…
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
              className="absolute left-1/2 top-1/2 -z-10 h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full bg-marketing-primary"
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
              className="flex h-24 w-24 items-center justify-center rounded-full bg-marketing-accent text-marketing-charcoal shadow-[0_0_70px_rgba(146,185,198,0.45)]"
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
                className={`text-xs font-bold uppercase tracking-[0.24em] text-marketing-accent ${typo.dataMono}`}
              >
                Thank you for joining us
              </p>
              <h1
                className={`mt-3 text-4xl font-bold sm:text-6xl ${typo.headingSans}`}
              >
                Welcome to Alti UCAT prep
              </h1>
              <p
                className={`mt-4 text-marketing-cream/60 ${typo.secondarySans}`}
              >
                Your plan is ready. Opening your dashboard…
              </p>
            </motion.div>
          </motion.main>
        )}
      </AnimatePresence>
    </div>
  );
}
