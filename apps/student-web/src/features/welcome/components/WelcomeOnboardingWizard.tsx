'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { Button } from '@altitutor/ui';
import { studentBtnOutline, studentBtnPrimary } from '@/shared/lib/student-visual';
import { cn } from '@/shared/utils';
import { WelcomeAnimatedStepPanel } from './WelcomeAnimatedStepPanel';
import { WelcomeStepIndicator } from './WelcomeStepIndicator';
import {
  WelcomeSuccessTransition,
  type WelcomeSuccessPhase,
} from './WelcomeSuccessTransition';
import { WelcomeIntroStep, type WelcomeSubject } from './steps/WelcomeIntroStep';
import {
  buildWelcomeInfoCards,
  WelcomeInfoStep,
} from './steps/WelcomeInfoStep';

const MIN_CONFIRMING_MS = 2_800;

type MacroStep = 'intro' | 'info';

type WelcomeOnboardingWizardProps = {
  open: boolean;
  onAcknowledge: () => Promise<void>;
  onDismiss: () => void;
  isSubmitting: boolean;
  studentFirstName: string | null;
  subjects: WelcomeSubject[];
  homeworkHelpTime: string | null;
  defaultClassHourlyRateCents: number | null;
  isContextLoading: boolean;
};

function headingFor(
  macroStep: MacroStep,
  studentFirstName: string | null,
): { kicker: string; title: string; desc: string } {
  switch (macroStep) {
    case 'intro':
      return {
        kicker: 'Step 1 of 2',
        title: `Welcome, ${studentFirstName ?? 'Student'}`,
        desc: 'A quick look at your enrolment and what happens next.',
      };
    case 'info':
      return {
        kicker: 'Step 2 of 2',
        title: 'Important information',
        desc: 'Billing, scheduling, location, and how to get the most from tutoring.',
      };
    default: {
      const _exhaustive: never = macroStep;
      throw new Error(`Unhandled welcome step: ${_exhaustive}`);
    }
  }
}

export function WelcomeOnboardingWizard({
  open,
  onAcknowledge,
  onDismiss,
  isSubmitting,
  studentFirstName,
  subjects,
  homeworkHelpTime,
  defaultClassHourlyRateCents,
  isContextLoading,
}: WelcomeOnboardingWizardProps) {
  const reduceMotion = useReducedMotion();
  const [macroStep, setMacroStep] = useState<MacroStep>('intro');
  const [direction, setDirection] = useState(1);
  const [successPhase, setSuccessPhase] = useState<WelcomeSuccessPhase | null>(
    null,
  );
  const [successError, setSuccessError] = useState<string | null>(null);
  const successStartedAt = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setMacroStep('intro');
    setDirection(1);
    setSuccessPhase(null);
    setSuccessError(null);
    successStartedAt.current = null;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const infoCards = useMemo(
    () =>
      buildWelcomeInfoCards({
        subjects,
        homeworkHelpTime,
        defaultClassHourlyRateCents,
      }),
    [subjects, homeworkHelpTime, defaultClassHourlyRateCents],
  );

  const heading = headingFor(macroStep, studentFirstName);
  const macroStepNumber = macroStep === 'intro' ? 1 : 2;

  const goMacro = (next: MacroStep, dir: number) => {
    setDirection(dir);
    setMacroStep(next);
  };

  const waitForMinimumConfirming = useCallback(async () => {
    const started = successStartedAt.current ?? Date.now();
    const elapsed = Date.now() - started;
    const remaining = Math.max(0, MIN_CONFIRMING_MS - elapsed);
    if (remaining > 0) {
      await new Promise<void>((resolve) => {
        window.setTimeout(
          resolve,
          reduceMotion ? Math.min(remaining, 200) : remaining,
        );
      });
    }
  }, [reduceMotion]);

  const runAcknowledge = useCallback(async () => {
    try {
      setSuccessError(null);
      await onAcknowledge();
      await waitForMinimumConfirming();
      setSuccessPhase('welcome');
    } catch (error) {
      setSuccessError(
        error instanceof Error ? error.message : 'Please try again.',
      );
    }
  }, [onAcknowledge, waitForMinimumConfirming]);

  const handleFinish = () => {
    successStartedAt.current = Date.now();
    setSuccessError(null);
    setSuccessPhase('confirming');
    void runAcknowledge();
  };

  const handleBack = () => {
    if (successPhase) return;
    if (macroStep === 'intro') return;
    goMacro('intro', -1);
  };

  const handleNext = () => {
    if (macroStep === 'intro') {
      goMacro('info', 1);
      return;
    }
    handleFinish();
  };

  if (!open) return null;

  if (successPhase) {
    return (
      <div
        className="fixed inset-0 z-[1200]"
        role="dialog"
        aria-modal="true"
        aria-label="Welcome onboarding"
      >
        <WelcomeSuccessTransition
          phase={successPhase}
          error={successError}
          onRetry={() => {
            successStartedAt.current = Date.now();
            setSuccessError(null);
            setSuccessPhase('confirming');
            void runAcknowledge();
          }}
          onComplete={onDismiss}
        />
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[1200] overflow-y-auto bg-background"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-onboarding-title"
    >
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -left-28 top-[-8rem] h-[24rem] w-[24rem] rounded-full bg-brand-lightBlue/25 blur-3xl dark:bg-brand-lightBlue/15"
        animate={
          reduceMotion
            ? undefined
            : { x: [0, 40, 0], y: [0, 24, 0], scale: [1, 1.08, 1] }
        }
        transition={{ duration: 10, ease: 'easeInOut', repeat: Infinity }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -right-20 h-[22rem] w-[22rem] rounded-full bg-primary/10 blur-3xl"
        animate={
          reduceMotion
            ? undefined
            : { x: [0, -36, 0], y: [0, -20, 0], scale: [1, 1.12, 1] }
        }
        transition={{ duration: 11, ease: 'easeInOut', repeat: Infinity }}
      />

      <main
        className={cn(
          'relative z-10 mx-auto flex min-h-dvh w-full flex-col px-4 py-10 sm:px-6 sm:py-14',
          macroStep === 'info' ? 'max-w-4xl' : 'max-w-3xl',
        )}
      >
        <WelcomeStepIndicator activeStep={macroStepNumber} totalSteps={2} />

        <WelcomeAnimatedStepPanel stepKey={macroStep} direction={direction}>
          <div className="space-y-6">
            <div>
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
                {heading.kicker}
              </span>
              <h1
                id="welcome-onboarding-title"
                className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl"
              >
                {heading.title}
              </h1>
              <p className="mt-2 text-muted-foreground">{heading.desc}</p>
            </div>

            {macroStep === 'intro' ? (
              <WelcomeIntroStep
                subjects={subjects}
                isContextLoading={isContextLoading}
              />
            ) : null}

            {macroStep === 'info' ? <WelcomeInfoStep cards={infoCards} /> : null}
          </div>
        </WelcomeAnimatedStepPanel>

        <div className="mt-10 flex items-center justify-between gap-3 pb-4">
          <Button
            type="button"
            variant="outline"
            onClick={handleBack}
            disabled={macroStep === 'intro' || isSubmitting}
            className={cn(studentBtnOutline)}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>

          <Button
            type="button"
            onClick={handleNext}
            disabled={
              isSubmitting || (macroStep === 'intro' && isContextLoading)
            }
            className={cn(studentBtnPrimary)}
          >
            {isSubmitting && macroStep === 'info' ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : macroStep === 'info' ? (
              'Finish'
            ) : (
              <>
                Continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </main>
    </div>
  );
}
