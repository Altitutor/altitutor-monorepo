'use client';

import { useEffect, useState, type ComponentType } from 'react';
import {
  BookOpen,
  Calendar,
  Check,
  CreditCard,
  Sparkles,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Button } from '@altitutor/ui';
import { cn } from '@/shared/utils';

type WelcomeBenefit = {
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
};

const BENEFITS: ReadonlyArray<WelcomeBenefit> = [
  {
    title: 'Classes & timetable',
    description: 'See enrolments, draft bookings, and manage absences in one place.',
    icon: Calendar,
  },
  {
    title: 'Resources & flashcards',
    description: 'Browse subject notes and keep key concepts fresh with spaced review.',
    icon: BookOpen,
  },
  {
    title: 'Billing & payments',
    description: 'Keep a card on file, review invoices, and manage subscriptions.',
    icon: CreditCard,
  },
];

export type WelcomeSuccessPhase = 'confirming' | 'welcome';

type WelcomeSuccessTransitionProps = {
  phase: WelcomeSuccessPhase;
  error: string | null;
  onRetry: () => void;
  onComplete: () => void;
};

export function WelcomeSuccessTransition({
  phase,
  error,
  onRetry,
  onComplete,
}: WelcomeSuccessTransitionProps) {
  const reduceMotion = useReducedMotion();
  const [benefitIndex, setBenefitIndex] = useState(0);

  useEffect(() => {
    if (phase !== 'confirming' || reduceMotion) return;

    const timer = window.setInterval(() => {
      setBenefitIndex((current) => (current + 1) % BENEFITS.length);
    }, 1_350);

    return () => window.clearInterval(timer);
  }, [phase, reduceMotion]);

  useEffect(() => {
    if (phase !== 'welcome') return;

    const timer = window.setTimeout(onComplete, reduceMotion ? 700 : 2_700);
    return () => window.clearTimeout(timer);
  }, [onComplete, phase, reduceMotion]);

  const benefit = BENEFITS[benefitIndex];
  const BenefitIcon = benefit.icon;

  return (
    <div className="relative flex min-h-dvh overflow-hidden bg-background text-foreground">
      <motion.div
        aria-hidden
        className="absolute -left-36 top-[-12rem] h-[30rem] w-[30rem] rounded-full bg-brand-lightBlue/25 blur-3xl dark:bg-brand-lightBlue/15"
        animate={
          reduceMotion
            ? undefined
            : { x: [0, 80, 20], y: [0, 35, 0], scale: [1, 1.12, 1] }
        }
        transition={{ duration: 8, ease: 'easeInOut', repeat: Infinity }}
      />
      <motion.div
        aria-hidden
        className="absolute -bottom-48 -right-28 h-[28rem] w-[28rem] rounded-full bg-primary/10 blur-3xl dark:bg-primary/20"
        animate={
          reduceMotion
            ? undefined
            : { x: [0, -65, 0], y: [0, -30, 0], scale: [1, 1.18, 1] }
        }
        transition={{ duration: 9, ease: 'easeInOut', repeat: Infinity }}
      />

      <AnimatePresence mode="wait" initial={false}>
        {phase === 'confirming' ? (
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
                className="absolute inset-0 rounded-full border border-primary/25 border-t-primary"
                animate={reduceMotion ? undefined : { rotate: 360 }}
                transition={{ duration: 2.8, ease: 'linear', repeat: Infinity }}
              />
              <motion.div
                aria-hidden
                className="absolute inset-2 rounded-full border border-dashed border-muted-foreground/25"
                animate={reduceMotion ? undefined : { rotate: -360 }}
                transition={{ duration: 7, ease: 'linear', repeat: Infinity }}
              />
              <motion.div
                className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_0_40px_hsl(var(--primary)/0.25)]"
                animate={reduceMotion ? undefined : { scale: [1, 1.07, 1] }}
                transition={{
                  duration: 1.8,
                  ease: 'easeInOut',
                  repeat: Infinity,
                }}
              >
                <Sparkles className="h-6 w-6" aria-hidden />
              </motion.div>
            </div>

            <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">
              Your portal is almost ready
            </p>
            <h1 className="mt-3 text-3xl font-bold sm:text-4xl">
              Personalising your student workspace
            </h1>
            <p className="mt-3 max-w-md text-muted-foreground">
              We&apos;re lining up your classes, resources, and billing so everything
              is ready when you land on the dashboard.
            </p>

            <div
              className={cn(
                'mt-9 w-full overflow-hidden rounded-3xl p-5 text-left shadow-2xl sm:p-6',
                'border-0 bg-card ring-1 ring-black/[0.06] dark:ring-white/[0.08]',
              )}
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
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-lightBlue/20 text-brand-mediumBlue dark:bg-brand-lightBlue/25 dark:text-brand-lightBlue">
                    <BenefitIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="font-semibold">{benefit.title}</h2>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {benefit.description}
                    </p>
                  </div>
                </motion.div>
              </AnimatePresence>

              <div className="mt-5 grid grid-cols-3 gap-2" aria-hidden>
                {BENEFITS.map((item, index) => (
                  <div
                    key={item.title}
                    className="h-1 overflow-hidden rounded-full bg-muted"
                  >
                    <motion.div
                      className="h-full origin-left rounded-full bg-primary"
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
                className="mt-5 w-full rounded-2xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive"
              >
                <p>We couldn&apos;t finish setting up your portal. {error}</p>
                <Button type="button" variant="outline" onClick={onRetry} className="mt-3">
                  Try again
                </Button>
              </div>
            ) : (
              <p className="mt-5 text-sm text-muted-foreground" role="status">
                Preparing your dashboard…
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
              className="absolute left-1/2 top-1/2 -z-10 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-lightBlue/20 dark:bg-brand-lightBlue/15"
              initial={{ scale: 0, opacity: 0 }}
              animate={
                reduceMotion
                  ? { opacity: 0.4, scale: 4 }
                  : { scale: [0, 1.2, 6], opacity: [0, 0.45, 0] }
              }
              transition={{
                duration: 2.4,
                times: [0, 0.4, 1],
                ease: 'easeOut',
              }}
            />

            <motion.div
              initial={{ scale: 0.45, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{
                duration: reduceMotion ? 0 : 0.55,
                type: 'spring',
                bounce: 0.45,
              }}
              className="flex h-24 w-24 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_0_40px_hsl(var(--primary)/0.25)]"
            >
              <Check className="h-11 w-11 stroke-[2.5]" aria-hidden />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduceMotion ? 0 : 0.3, duration: 0.5 }}
              className="mt-8"
            >
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">
                You&apos;re all set
              </p>
              <h1 className="mt-3 text-4xl font-bold text-foreground sm:text-5xl">
                Welcome to Altitutor
              </h1>
              <p className="mt-4 text-muted-foreground">
                Your student portal is ready. Opening your dashboard…
              </p>
            </motion.div>
          </motion.main>
        )}
      </AnimatePresence>
    </div>
  );
}
