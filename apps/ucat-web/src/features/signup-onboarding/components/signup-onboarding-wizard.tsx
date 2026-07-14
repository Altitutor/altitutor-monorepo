"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { MARKETING_TOKENS } from "@altitutor/shared";
import { motion, useReducedMotion } from "motion/react";
import { AnimatedStepPanel } from "@/features/signup-onboarding/components/animated-step-panel";
import { SignupStepIndicator } from "@/features/signup-onboarding/components/signup-step-indicator";
import {
  fetchSignupProgress,
  patchSignupProgress,
} from "@/features/signup-onboarding/api/signup-progress";
import {
  markSignupOnboardingTourPending,
  markSignupJustCompleted,
} from "@/features/signup-onboarding/lib/signup-tour-flag";
import { SIGNUP_STEP } from "@/features/signup-onboarding/lib/steps";
import type {
  SignupOnboardingInitial,
  SignupOnboardingStep,
} from "@/features/signup-onboarding/types";
import { SignupCompleteDetailsStep } from "@/features/signup-onboarding/components/steps/details-step";
import { SignupCompletePasswordStep } from "@/features/signup-onboarding/components/steps/password-step";
import { SignupCompleteStudyPlanStep } from "@/features/signup-onboarding/components/steps/study-plan-step";
import { SignupCompletePlanStep } from "@/features/signup-onboarding/components/steps/plan-step";
import { useUcatAccess } from "@/features/ucat-access/hooks/use-ucat-access";
import { NoiseOverlay } from "@/features/landing/components/marketing/noise-overlay";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { parseSignupPlanIntent } from "@/features/auth/lib/signup-plan-intent";
import {
  SignupSuccessTransition,
  type SignupSuccessJourney,
  type SignupSuccessTransitionPhase,
} from "@/features/signup-onboarding/components/signup-success-transition";

const { typography: typo } = MARKETING_TOKENS;

type SignupOnboardingWizardProps = {
  initial: SignupOnboardingInitial;
};

function stepHeading(step: SignupOnboardingStep): {
  kicker: string;
  title: string;
  desc: string;
} {
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
        kicker: "Step 4 of 4",
        title: "Choose your plan",
        desc: "Start free or unlock unlimited access.",
      };
    case SIGNUP_STEP.STUDY_PLAN:
      return {
        kicker: "Step 3 of 4",
        title: "Build your Study plan",
        desc: "Tell us your goal and availability. We will decide what to do each study day.",
      };
    default:
      return { kicker: "", title: "", desc: "" };
  }
}

export function SignupOnboardingWizard({
  initial,
}: SignupOnboardingWizardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const access = useUcatAccess();
  const reduceMotion = useReducedMotion();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const planIntent = useMemo(
    () => parseSignupPlanIntent(searchParams.get("redirect")),
    [searchParams],
  );
  const checkoutStatus = searchParams.get("checkout");
  const checkoutReturnedSuccessfully = checkoutStatus === "success";

  const [step, setStep] = useState<SignupOnboardingStep>(() =>
    checkoutStatus === "canceled" ? SIGNUP_STEP.PLAN : initial.step,
  );
  const [direction, setDirection] = useState(1);
  const [signupSuccessJourney, setSignupSuccessJourney] =
    useState<SignupSuccessJourney | null>(() =>
      checkoutReturnedSuccessfully ? "paid" : null,
    );
  const [signupSuccessPhase, setSignupSuccessPhase] =
    useState<SignupSuccessTransitionPhase | null>(() =>
      checkoutReturnedSuccessfully ? "confirming" : null,
    );
  const [signupSuccessTakingLonger, setSignupSuccessTakingLonger] =
    useState(false);
  const [signupSuccessError, setSignupSuccessError] = useState<string | null>(
    null,
  );
  const [checkoutConfirmationAttempt, setCheckoutConfirmationAttempt] =
    useState(0);
  const [checkoutMessage, setCheckoutMessage] = useState<string | null>(() =>
    checkoutStatus === "canceled"
      ? "Checkout cancelled. Pick a plan or continue on Free."
      : null,
  );
  const signupSuccessStartedAt = useRef(
    checkoutReturnedSuccessfully ? Date.now() : 0,
  );
  const checkoutConfirmationStarted = useRef(false);
  const [details, setDetails] = useState({
    firstName: initial.firstName,
    lastName: initial.lastName,
    phone: initial.phone,
  });

  const [error, setError] = useState<string | null>(null);

  const goToStep = (next: SignupOnboardingStep, dir: number) => {
    setDirection(dir);
    setStep(next);
    setError(null);
  };

  const navigateAfterSignupComplete = useCallback(async () => {
    markSignupOnboardingTourPending();
    markSignupJustCompleted();
    await queryClient.invalidateQueries({ queryKey: ["ucat-access"] });
    await queryClient.refetchQueries({ queryKey: ["ucat-access"] });
    router.replace("/dashboard");
  }, [queryClient, router]);
  const completeSignupSuccessTransition = useCallback(() => {
    void navigateAfterSignupComplete();
  }, [navigateAfterSignupComplete]);
  const waitForMinimumSignupSuccessAnimation = useCallback(async () => {
    const minimumAnimationMs = reduceMotion ? 350 : 2_800;
    const elapsed = Date.now() - signupSuccessStartedAt.current;
    if (elapsed < minimumAnimationMs) {
      await new Promise((resolve) =>
        window.setTimeout(resolve, minimumAnimationMs - elapsed),
      );
    }
  }, [reduceMotion]);

  const completeFreeSignup = useCallback(async () => {
    try {
      await patchSignupProgress({ complete: true });
      await waitForMinimumSignupSuccessAnimation();
      setSignupSuccessError(null);
      setSignupSuccessPhase("welcome");
    } catch (e) {
      setSignupSuccessError(
        e instanceof Error ? e.message : "Please try again.",
      );
    }
  }, [waitForMinimumSignupSuccessAnimation]);

  // App Router client cache can remount this page with a stale RSC `initial.step`
  // (e.g. password) after the user had already advanced client-side to plan.
  useEffect(() => {
    if (checkoutReturnedSuccessfully || signupSuccessPhase) return;

    let cancelled = false;
    void fetchSignupProgress()
      .then((progress) => {
        if (cancelled) return;
        if (progress.signupCompleted) {
          void navigateAfterSignupComplete();
          return;
        }
        setStep((current) =>
          progress.step > current ? progress.step : current,
        );
      })
      .catch(() => {
        // Keep server-rendered initial step if progress fetch fails.
      });

    return () => {
      cancelled = true;
    };
  }, [
    checkoutReturnedSuccessfully,
    navigateAfterSignupComplete,
    signupSuccessPhase,
  ]);

  useEffect(() => {
    if (checkoutStatus === "canceled") {
      setCheckoutMessage(
        "Checkout cancelled. Pick a plan or continue on Free.",
      );
      goToStep(SIGNUP_STEP.PLAN, -1);
      router.replace("/signup/complete");
      return;
    }
    if (!checkoutReturnedSuccessfully || signupSuccessPhase !== "confirming") {
      return;
    }

    router.prefetch("/dashboard");
    setSignupSuccessJourney("paid");
    setSignupSuccessPhase((current) => current ?? "confirming");
    if (signupSuccessStartedAt.current === 0) {
      signupSuccessStartedAt.current = Date.now();
    }

    let attempts = 0;
    void queryClient.invalidateQueries({ queryKey: ["ucat-access"] });
    const timer = window.setInterval(() => {
      attempts += 1;
      void queryClient.invalidateQueries({ queryKey: ["ucat-access"] });
      if (attempts >= 12) {
        setSignupSuccessTakingLonger(true);
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [
    checkoutReturnedSuccessfully,
    checkoutStatus,
    signupSuccessPhase,
    queryClient,
    router,
  ]);

  useEffect(() => {
    if (
      signupSuccessJourney !== "paid" ||
      signupSuccessPhase !== "confirming" ||
      access.isLoading ||
      checkoutConfirmationStarted.current
    ) {
      return;
    }
    const isPaid =
      access.onlineTier === "unlimited" ||
      access.onlineTier === "unlimited_trial" ||
      access.onlineTier === "pro";
    if (!isPaid) return;

    checkoutConfirmationStarted.current = true;
    void (async () => {
      try {
        await patchSignupProgress({ planComplete: true });
        await patchSignupProgress({ complete: true });

        await waitForMinimumSignupSuccessAnimation();

        setSignupSuccessError(null);
        setSignupSuccessPhase("welcome");
      } catch (e) {
        checkoutConfirmationStarted.current = false;
        setSignupSuccessError(
          e instanceof Error ? e.message : "Please try again.",
        );
      }
    })();
  }, [
    signupSuccessJourney,
    signupSuccessPhase,
    checkoutConfirmationAttempt,
    access.isLoading,
    access.onlineTier,
    waitForMinimumSignupSuccessAnimation,
  ]);

  const finishOnboarding = () => {
    setError(null);
    router.prefetch("/dashboard");
    signupSuccessStartedAt.current = Date.now();
    setSignupSuccessJourney("free");
    setSignupSuccessTakingLonger(false);
    setSignupSuccessError(null);
    setSignupSuccessPhase("confirming");
    void completeFreeSignup();
  };

  const handlePasswordComplete = async () => {
    await patchSignupProgress({ step: SIGNUP_STEP.STUDY_PLAN });
    goToStep(SIGNUP_STEP.STUDY_PLAN, 1);
  };

  const handleStudyPlanComplete = async () => {
    await patchSignupProgress({ step: SIGNUP_STEP.PLAN });
    if (planIntent) {
      router.push(planIntent.checkoutPath);
      return;
    }
    goToStep(SIGNUP_STEP.PLAN, 1);
  };

  const handlePlanComplete = () => {
    finishOnboarding();
  };

  const heading = stepHeading(step);
  const isWideStep = step === SIGNUP_STEP.PLAN || step === SIGNUP_STEP.STUDY_PLAN;

  if (signupSuccessJourney && signupSuccessPhase) {
    return (
      <SignupSuccessTransition
        journey={signupSuccessJourney}
        occasion="signup"
        phase={signupSuccessPhase}
        isTakingLonger={signupSuccessTakingLonger}
        error={signupSuccessError}
        onRetry={() => {
          signupSuccessStartedAt.current = Date.now();
          setSignupSuccessError(null);
          if (signupSuccessJourney === "free") {
            void completeFreeSignup();
            return;
          }
          checkoutConfirmationStarted.current = false;
          setSignupSuccessTakingLonger(false);
          setCheckoutConfirmationAttempt((current) => current + 1);
          void queryClient.invalidateQueries({ queryKey: ["ucat-access"] });
        }}
        onComplete={completeSignupSuccessTransition}
      />
    );
  }

  return (
    <div className="relative flex min-h-dvh flex-col bg-marketing-charcoal">
      <NoiseOverlay />

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-12">
        <motion.div
          layout={!reduceMotion}
          transition={{
            duration: reduceMotion ? 0 : 0.3,
            ease: [0.22, 1, 0.36, 1],
          }}
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
                <p
                  className={`mt-2 text-marketing-cream/60 ${typo.secondarySans}`}
                >
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
                  initialFirstName={details.firstName}
                  initialLastName={details.lastName}
                  initialPhone={details.phone}
                  onComplete={(savedDetails) => {
                    setDetails(savedDetails);
                    goToStep(SIGNUP_STEP.PASSWORD, 1);
                  }}
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

              {step === SIGNUP_STEP.STUDY_PLAN ? (
                <SignupCompleteStudyPlanStep
                  onComplete={() => void handleStudyPlanComplete()}
                />
              ) : null}

              {step === SIGNUP_STEP.PLAN ? (
                <SignupCompletePlanStep onComplete={handlePlanComplete} />
              ) : null}
            </div>
          </AnimatedStepPanel>
        </motion.div>
      </main>
    </div>
  );
}
