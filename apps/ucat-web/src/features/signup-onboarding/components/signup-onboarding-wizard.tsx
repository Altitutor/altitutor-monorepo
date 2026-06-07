"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { MARKETING_TOKENS } from "@altitutor/shared";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@altitutor/ui";
import { motion, useReducedMotion } from "motion/react";
import { AnimatedStepPanel } from "@/features/signup-onboarding/components/animated-step-panel";
import { SignupStepIndicator } from "@/features/signup-onboarding/components/signup-step-indicator";
import { patchSignupProgress } from "@/features/signup-onboarding/api/signup-progress";
import { markSignupOnboardingTourPending } from "@/features/signup-onboarding/lib/signup-tour-flag";
import {
  DEFAULT_TARGET_SCORE,
  LOW_TARGET_SCORE_THRESHOLD,
  SIGNUP_STEP,
  ucatTestDateBounds,
  ucatTestYearOptions,
} from "@/features/signup-onboarding/lib/steps";
import type { SignupOnboardingInitial, SignupOnboardingStep } from "@/features/signup-onboarding/types";
import { SignupCompleteDetailsStep } from "@/features/signup-onboarding/components/steps/details-step";
import { SignupCompletePasswordStep } from "@/features/signup-onboarding/components/steps/password-step";
import { SignupCompletePlanStep } from "@/features/signup-onboarding/components/steps/plan-step";
import { patchStudyPlannerSettings } from "@/features/signup-onboarding/api/study-planner-settings";
import { useUcatAccess } from "@/features/ucat-access/hooks/use-ucat-access";
import { useSections } from "@/features/progress/hooks/use-sections";
import { NoiseOverlay } from "@/features/landing/components/marketing/noise-overlay";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const { typography: typo } = MARKETING_TOKENS;

type SignupOnboardingWizardProps = {
  initial: SignupOnboardingInitial;
};

function stepHeading(step: SignupOnboardingStep): { kicker: string; title: string; desc: string } {
  switch (step) {
    case SIGNUP_STEP.DETAILS:
      return {
        kicker: "Step 1 of 4",
        title: "Your details",
        desc: "Tell us a bit about yourself to personalise your experience.",
      };
    case SIGNUP_STEP.PASSWORD:
      return {
        kicker: "Step 2 of 4",
        title: "Set your password",
        desc: "Choose a strong password to secure your account.",
      };
    case SIGNUP_STEP.PLAN:
      return {
        kicker: "Step 3 of 4",
        title: "Choose your plan",
        desc: "Start free or unlock unlimited access.",
      };
    case SIGNUP_STEP.TEST_DETAILS:
      return {
        kicker: "Step 4 of 4",
        title: "UCAT test details",
        desc: "When are you sitting UCAT? This helps us personalise your study plan.",
      };
    case SIGNUP_STEP.TARGET_SCORES:
      return {
        kicker: "Step 4 of 4",
        title: "Set your target scores",
        desc: "Optional targets for sections 1–3. You can change these later in settings.",
      };
    default:
      return { kicker: "", title: "", desc: "" };
  }
}

export function SignupOnboardingWizard({ initial }: SignupOnboardingWizardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const access = useUcatAccess();
  const sections = useSections();
  const reduceMotion = useReducedMotion();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [step, setStep] = useState<SignupOnboardingStep>(initial.step);
  const [direction, setDirection] = useState(1);
  const [checkoutConfirming, setCheckoutConfirming] = useState(false);
  const [checkoutMessage, setCheckoutMessage] = useState<string | null>(null);

  const [testYear, setTestYear] = useState<number | null>(initial.testYear);
  const [testDate, setTestDate] = useState(initial.testDate ?? "");
  const [dateUnsure, setDateUnsure] = useState(false);

  const [s1, setS1] = useState(String(initial.targetScores.s1 ?? DEFAULT_TARGET_SCORE));
  const [s2, setS2] = useState(String(initial.targetScores.s2 ?? DEFAULT_TARGET_SCORE));
  const [s3, setS3] = useState(String(initial.targetScores.s3 ?? DEFAULT_TARGET_SCORE));
  const [lowScoreDialogOpen, setLowScoreDialogOpen] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const yearOptions = useMemo(() => ucatTestYearOptions(), []);

  const sectionNames = useMemo(() => {
    const byNumber = new Map<number, string>();
    for (const section of sections.data ?? []) {
      if (section.sectionNumber >= 1 && section.sectionNumber <= 3) {
        byNumber.set(section.sectionNumber, section.name);
      }
    }
    return {
      s1: byNumber.get(1) ?? "Section 1",
      s2: byNumber.get(2) ?? "Section 2",
      s3: byNumber.get(3) ?? "Section 3",
    };
  }, [sections.data]);

  const goToStep = (next: SignupOnboardingStep, dir: number) => {
    setDirection(dir);
    setStep(next);
    setError(null);
  };

  const totalTarget = useMemo(() => {
    const vals = [s1, s2, s3].map((v) => (v.trim() ? Number(v) : 0));
    if (vals.some((v) => !Number.isFinite(v))) return null;
    return vals.reduce((a, b) => a + b, 0);
  }, [s1, s2, s3]);

  const showLowScoreWarning =
    totalTarget !== null && totalTarget > 0 && totalTarget < LOW_TARGET_SCORE_THRESHOLD;

  useEffect(() => {
    const checkout = searchParams.get("checkout");
    if (checkout === "canceled") {
      setCheckoutMessage("Checkout cancelled — pick a plan or continue on Free.");
      goToStep(SIGNUP_STEP.PLAN, -1);
      router.replace("/signup/complete");
      return;
    }
    if (checkout !== "success") return;

    setCheckoutConfirming(true);
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      void queryClient.invalidateQueries({ queryKey: ["ucat-access"] });
      if (attempts >= 15) {
        window.clearInterval(timer);
        setCheckoutConfirming(false);
        setCheckoutMessage(
          "We are still confirming your subscription. Please wait a moment and refresh.",
        );
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [searchParams, queryClient, router]);

  useEffect(() => {
    if (!checkoutConfirming || access.isLoading) return;
    const isPaid =
      access.onlineTier === "unlimited" ||
      access.onlineTier === "unlimited_trial" ||
      access.onlineTier === "pro";
    if (!isPaid) return;

    void (async () => {
      try {
        await patchSignupProgress({ planComplete: true });
        await queryClient.invalidateQueries({ queryKey: ["ucat-access"] });
        setCheckoutConfirming(false);
        goToStep(SIGNUP_STEP.TEST_DETAILS, 1);
        router.replace("/signup/complete");
      } catch (e) {
        setCheckoutConfirming(false);
        setError(e instanceof Error ? e.message : "Failed to confirm plan");
      }
    })();
  }, [checkoutConfirming, access.isLoading, access.onlineTier, queryClient, router]);

  const finishOnboarding = async (saveTargets: boolean) => {
    setIsSubmitting(true);
    setError(null);
    try {
      if (saveTargets) {
        const parsed = [s1, s2, s3].map((value) =>
          value.trim() ? Number(value) : null,
        );
        if (parsed.some((value) => value !== null && !Number.isFinite(value))) {
          setError("Target scores must be numbers.");
          return;
        }
        if (
          parsed.some(
            (value) => value !== null && (value < 300 || value > 900),
          )
        ) {
          setError("Target scores must be between 300 and 900.");
          return;
        }
        await patchStudyPlannerSettings({
          targetScores: { s1: parsed[0], s2: parsed[1], s3: parsed[2] },
        });
      }
      await patchSignupProgress({ complete: true });
      markSignupOnboardingTourPending();
      router.push("/dashboard");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkipTestDetails = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await patchSignupProgress({ complete: true });
      markSignupOnboardingTourPending();
      router.push("/dashboard");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTestDetailsNext = async () => {
    if (testYear == null) {
      setError("Please select the year you expect to sit UCAT.");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const dateToSave = dateUnsure || !testDate.trim() ? null : testDate.trim();
      if (dateToSave) {
        const bounds = ucatTestDateBounds(testYear);
        if (dateToSave < bounds.min || dateToSave > bounds.max) {
          setError(`Test date must be between ${bounds.min} and ${bounds.max}.`);
          return;
        }
      }
      await patchSignupProgress({ testYear, step: SIGNUP_STEP.TARGET_SCORES });
      await patchStudyPlannerSettings({
        testYear,
        testDate: dateToSave,
      });
      goToStep(SIGNUP_STEP.TARGET_SCORES, 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save test details.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasswordComplete = async () => {
    await patchSignupProgress({ step: SIGNUP_STEP.PLAN });
    goToStep(SIGNUP_STEP.PLAN, 1);
  };

  const handlePlanComplete = () => {
    goToStep(SIGNUP_STEP.TEST_DETAILS, 1);
  };

  const handleBegin = () => {
    if (showLowScoreWarning) {
      setLowScoreDialogOpen(true);
      return;
    }
    void finishOnboarding(true);
  };

  const heading = stepHeading(step);
  const isWideStep = step === SIGNUP_STEP.PLAN;

  if (checkoutConfirming) {
    return (
      <div className="relative flex min-h-dvh flex-col bg-marketing-charcoal">
        <NoiseOverlay />
        <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-12">
          <p className={`text-marketing-cream/70 ${typo.secondarySans}`}>
            Confirming your plan…
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-dvh flex-col bg-marketing-charcoal">
      <NoiseOverlay />

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-12">
        <motion.div
          layout={!reduceMotion}
          transition={{ duration: reduceMotion ? 0 : 0.3, ease: [0.22, 1, 0.36, 1] }}
          className={cn(
            "w-full transition-[max-width] duration-300",
            isWideStep ? "max-w-5xl" : "max-w-md",
          )}
        >
          <SignupStepIndicator step={step} />

          <AnimatedStepPanel stepKey={step} direction={direction}>
            <div className="space-y-6">
              <div>
                <span
                  className={`text-xs font-bold uppercase tracking-[0.2em] text-marketing-accent ${typo.dataMono}`}
                >
                  {heading.kicker}
                </span>
                <h1
                  className={`mt-2 text-3xl font-bold text-marketing-cream sm:text-4xl ${typo.headingSans}`}
                >
                  {heading.title}
                </h1>
                <p className={`mt-2 text-marketing-cream/60 ${typo.secondarySans}`}>
                  {heading.desc}
                </p>
              </div>

              {checkoutMessage && step === SIGNUP_STEP.PLAN ? (
                <p
                  className={`rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-300 ${typo.secondarySans}`}
                >
                  {checkoutMessage}
                </p>
              ) : null}

              {step === SIGNUP_STEP.DETAILS ? (
                <SignupCompleteDetailsStep
                  email={initial.email}
                  initialFirstName={initial.firstName}
                  initialLastName={initial.lastName}
                  initialPhone={initial.phone}
                  onComplete={() => goToStep(SIGNUP_STEP.PASSWORD, 1)}
                  error={error}
                  setError={setError}
                />
              ) : null}

              {step === SIGNUP_STEP.PASSWORD ? (
                <SignupCompletePasswordStep
                  supabase={supabase}
                  onComplete={() => void handlePasswordComplete()}
                  onBack={() => goToStep(SIGNUP_STEP.DETAILS, -1)}
                  error={error}
                  setError={setError}
                />
              ) : null}

              {step === SIGNUP_STEP.PLAN ? (
                <SignupCompletePlanStep onComplete={handlePlanComplete} />
              ) : null}

              {step === SIGNUP_STEP.TEST_DETAILS ? (
                <div className="space-y-4 rounded-3xl bg-white/5 p-8 ring-1 ring-white/10 backdrop-blur-sm">
                  <fieldset className="space-y-3">
                    <legend
                      className={`text-sm font-medium text-marketing-cream/80 ${typo.secondarySans}`}
                    >
                      Which year will you sit UCAT?
                    </legend>
                    <div className="grid grid-cols-3 gap-2">
                      {yearOptions.map((year) => (
                        <button
                          key={year}
                          type="button"
                          onClick={() => {
                            setTestYear(year);
                            setDateUnsure(false);
                            if (testDate) {
                              const y = testDate.slice(0, 4);
                              if (y !== String(year)) setTestDate("");
                            }
                          }}
                          className={cn(
                            `rounded-xl border px-3 py-3 text-sm font-semibold transition-colors ${typo.secondarySans}`,
                            testYear === year
                              ? "border-marketing-accent/50 bg-marketing-accent/15 text-marketing-cream"
                              : "border-white/10 bg-white/5 text-marketing-cream/70 hover:border-white/20",
                          )}
                        >
                          {year}
                        </button>
                      ))}
                    </div>
                  </fieldset>

                  {testYear != null ? (
                    <div className="space-y-3">
                      <label
                        htmlFor="signup-test-date"
                        className={`block text-sm font-medium text-marketing-cream/80 ${typo.secondarySans}`}
                      >
                        Test date{" "}
                        <span className="text-marketing-cream/40">(optional)</span>
                      </label>
                      <input
                        id="signup-test-date"
                        type="date"
                        min={ucatTestDateBounds(testYear).min}
                        max={ucatTestDateBounds(testYear).max}
                        value={testDate}
                        disabled={dateUnsure || isSubmitting}
                        onChange={(e) => {
                          setTestDate(e.target.value);
                          setDateUnsure(false);
                        }}
                        className={`w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-marketing-cream outline-none focus:border-marketing-accent/50 disabled:opacity-40 ${typo.secondarySans}`}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setDateUnsure((v) => !v);
                          if (!dateUnsure) setTestDate("");
                        }}
                        className={`text-sm text-marketing-cream/50 underline-offset-4 hover:text-marketing-cream/80 hover:underline ${typo.secondarySans}`}
                      >
                        I&apos;m not sure yet
                      </button>
                    </div>
                  ) : null}

                  {error ? (
                    <p className={`rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-400 ${typo.secondarySans}`}>
                      {error}
                    </p>
                  ) : null}

                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => void handleTestDetailsNext()}
                    className={`w-full rounded-full bg-marketing-accent py-3.5 text-base font-semibold text-marketing-charcoal transition-colors hover:bg-marketing-accent/90 disabled:opacity-50 ${typo.headingSans}`}
                  >
                    {isSubmitting ? "Saving…" : "Next"}
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => void handleSkipTestDetails()}
                    className={`w-full text-sm text-marketing-cream/40 transition-colors hover:text-marketing-cream/70 ${typo.secondarySans}`}
                  >
                    Skip for now
                  </button>
                </div>
              ) : null}

              {step === SIGNUP_STEP.TARGET_SCORES ? (
                <div className="space-y-4 rounded-3xl bg-white/5 p-8 ring-1 ring-white/10 backdrop-blur-sm">
                  <div className="grid gap-3 sm:grid-cols-3">
                    {(
                      [
                        ["s1", s1, setS1, sectionNames.s1],
                        ["s2", s2, setS2, sectionNames.s2],
                        ["s3", s3, setS3, sectionNames.s3],
                      ] as const
                    ).map(([key, value, setter, label]) => (
                      <div key={key} className="space-y-1.5">
                        <label
                          htmlFor={`signup-target-${key}`}
                          className={`block text-sm font-medium text-marketing-cream/80 ${typo.secondarySans}`}
                        >
                          {label}
                        </label>
                        <input
                          id={`signup-target-${key}`}
                          type="number"
                          min={300}
                          max={900}
                          value={value}
                          onChange={(e) => setter(e.target.value)}
                          className={`w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-marketing-cream outline-none focus:border-marketing-accent/50 ${typo.secondarySans}`}
                        />
                      </div>
                    ))}
                  </div>

                  {showLowScoreWarning ? (
                    <p
                      className={`rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-200 ${typo.secondarySans}`}
                    >
                      A combined target below 1800 is unlikely to be competitive for
                      medical interviews. You can still save these — consider aiming
                      higher or revisiting in settings.
                    </p>
                  ) : null}

                  {error ? (
                    <p className={`rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-400 ${typo.secondarySans}`}>
                      {error}
                    </p>
                  ) : null}

                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={handleBegin}
                    className={`w-full rounded-full bg-marketing-accent py-3.5 text-base font-semibold text-marketing-charcoal transition-colors hover:bg-marketing-accent/90 disabled:opacity-50 ${typo.headingSans}`}
                  >
                    {isSubmitting ? "Starting…" : "Begin"}
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => void finishOnboarding(false)}
                    className={`w-full text-sm text-marketing-cream/40 transition-colors hover:text-marketing-cream/70 ${typo.secondarySans}`}
                  >
                    Skip targets
                  </button>
                  <button
                    type="button"
                    onClick={() => goToStep(SIGNUP_STEP.TEST_DETAILS, -1)}
                    className={`w-full text-sm text-marketing-cream/40 transition-colors hover:text-marketing-cream/70 ${typo.secondarySans}`}
                  >
                    ← Back
                  </button>
                </div>
              ) : null}
            </div>
          </AnimatedStepPanel>
        </motion.div>
      </main>

      <AlertDialog open={lowScoreDialogOpen} onOpenChange={setLowScoreDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Targets look low</AlertDialogTitle>
            <AlertDialogDescription>
              A combined target below 1800 is unlikely to be competitive for medical
              interviews. Continue anyway or adjust your targets first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Adjust targets</AlertDialogCancel>
            <AlertDialogAction onClick={() => void finishOnboarding(true)}>
              Continue anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
