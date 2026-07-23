"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MARKETING_TOKENS } from "@altitutor/shared";
import { motion, useReducedMotion } from "motion/react";
import { AnimatedStepPanel } from "@/features/signup-onboarding/components/animated-step-panel";
import { SignupStepIndicator } from "@/features/signup-onboarding/components/signup-step-indicator";
import {
  fetchSignupProgress,
  patchSignupProgress,
} from "@/features/signup-onboarding/api/signup-progress";
import { markSignupJustCompleted } from "@/features/signup-onboarding/lib/signup-tour-flag";
import { SIGNUP_STEP } from "@/features/signup-onboarding/lib/steps";
import type {
  SignupOnboardingInitial,
  SignupOnboardingStep,
} from "@/features/signup-onboarding/types";
import { SignupCompleteDetailsStep } from "@/features/signup-onboarding/components/steps/details-step";
import { SignupCompletePasswordStep } from "@/features/signup-onboarding/components/steps/password-step";
import {
  SignupCompleteSamplerStep,
  type UcatFamiliarity,
} from "@/features/signup-onboarding/components/steps/sampler-step";
import { SignupCompletePlanStep } from "@/features/signup-onboarding/components/steps/plan-step";
import { useUcatAccess } from "@/features/ucat-access/hooks/use-ucat-access";
import { NoiseOverlay } from "@/features/landing/components/marketing/noise-overlay";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { parseSignupPlanIntent } from "@/features/auth/lib/signup-plan-intent";
import {
  SignupSuccessTransition,
  type SignupSuccessJourney,
  type SignupSuccessTransitionPhase,
} from "@/features/signup-onboarding/components/signup-success-transition";
import { fetchReferralGifts } from "@/features/subscription/api/referral-gifts";
import { useOnboardingProgress } from "@/features/onboarding/hooks/use-onboarding-progress";
import { UCAT_GUIDED_SAMPLER_DECIDED } from "@/features/onboarding/lib/activation-milestones";
import { captureUcatEvent } from "@/lib/analytics/posthog";

const { typography: typo } = MARKETING_TOKENS;

function PlanChoiceHandoff({
  journey,
  phase,
  takingLonger,
  error,
  onRetry,
  onComplete,
}: {
  journey: SignupSuccessJourney;
  phase: SignupSuccessTransitionPhase;
  takingLonger: boolean;
  error: string | null;
  onRetry: () => void;
  onComplete: () => void;
}) {
  return (
    <SignupSuccessTransition
      journey={journey}
      occasion="signup"
      phase={phase}
      isTakingLonger={takingLonger}
      error={error}
      onRetry={onRetry}
      onComplete={onComplete}
      preloadDashboard
    />
  );
}

const PLAN_HANDOFF_MINIMUM_MS = 2_400;

type SignupOnboardingWizardProps = {
  initial: SignupOnboardingInitial;
};

function stepHeading(
  step: SignupOnboardingStep,
  hasGift: boolean,
): {
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
        title: hasGift ? "Your gift is ready" : "Choose how to continue",
        desc: hasGift
          ? "Accept your gift or continue with UCAT Free."
          : "Start with UCAT Free or unlock unlimited access.",
      };
    case SIGNUP_STEP.SAMPLER:
      return {
        kicker: "Step 3 of 4",
        title: "Let’s get you ready for your first UCAT session",
        desc: "Answer two questions from every section while we show you the exam controls. About 6 minutes.",
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
  const { refetch: refetchOnboardingProgress } = useOnboardingProgress();
  const reduceMotion = useReducedMotion();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const planIntent = useMemo(
    () => parseSignupPlanIntent(searchParams.get("redirect")),
    [searchParams],
  );
  const checkoutStatus = searchParams.get("checkout");
  const checkoutReturnedSuccessfully = checkoutStatus === "success";
  const samplerReturnedComplete = searchParams.get("sampler") === "complete";
  const giftQuery = useQuery({
    queryKey: ["ucat-referral-gifts"],
    queryFn: fetchReferralGifts,
  });

  const [step, setStep] = useState<SignupOnboardingStep>(() =>
    checkoutStatus === "canceled" || samplerReturnedComplete
      ? SIGNUP_STEP.PLAN
      : initial.step,
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
  const checkoutConfirmationStarted = useRef(false);
  const planHandoffStartedAt = useRef<number | null>(
    checkoutReturnedSuccessfully ? Date.now() : null,
  );
  const [details, setDetails] = useState({
    email: initial.pendingEmail || initial.email,
    pendingEmail: initial.pendingEmail,
    firstName: initial.firstName,
    lastName: initial.lastName,
    phone: initial.phone,
  });
  const [familiarity, setFamiliarity] = useState<UcatFamiliarity | null>(null);

  const [error, setError] = useState<string | null>(null);

  const goToStep = (next: SignupOnboardingStep, dir: number) => {
    setDirection(dir);
    setStep(next);
    setError(null);
  };

  const navigateAfterSignupComplete = useCallback(async () => {
    markSignupJustCompleted();
    await queryClient.invalidateQueries({ queryKey: ["ucat-access"] });
    await queryClient.refetchQueries({ queryKey: ["ucat-access"] });
    const refreshedProgress = await refetchOnboardingProgress();
    if (!refreshedProgress.data?.[UCAT_GUIDED_SAMPLER_DECIDED]?.completed_at) {
      router.replace("/signup/complete/sampler?afterPlan=1&activation=1");
      return;
    }
    if (planHandoffStartedAt.current != null) {
      const elapsed = Date.now() - planHandoffStartedAt.current;
      const remaining = Math.max(0, PLAN_HANDOFF_MINIMUM_MS - elapsed);
      if (remaining > 0) {
        await new Promise((resolve) => window.setTimeout(resolve, remaining));
      }
    }
    setSignupSuccessPhase("welcome");
  }, [queryClient, refetchOnboardingProgress, router]);

  const completeFreeSignup = useCallback(async () => {
    try {
      await patchSignupProgress({ complete: true });
      setSignupSuccessError(null);
      await navigateAfterSignupComplete();
    } catch (e) {
      setSignupSuccessError(
        e instanceof Error ? e.message : "Please try again.",
      );
    }
  }, [navigateAfterSignupComplete]);

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
    router.prefetch("/signup/complete/sampler?afterPlan=1");
    setSignupSuccessJourney("paid");
    setSignupSuccessPhase((current) => current ?? "confirming");
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
      access.onlineTier === "unlimited_trial";
    if (!isPaid) return;

    checkoutConfirmationStarted.current = true;
    void (async () => {
      try {
        await patchSignupProgress({ planComplete: true });
        await patchSignupProgress({ complete: true });

        captureUcatEvent("subscription_activated", {
          plan_tier: access.onlineTier,
          activation_type: "new_subscription",
          journey_context: "signup_onboarding",
        });

        setSignupSuccessError(null);
        await navigateAfterSignupComplete();
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
    navigateAfterSignupComplete,
  ]);

  const finishOnboarding = () => {
    setError(null);
    router.prefetch("/dashboard");
    setSignupSuccessJourney("free");
    planHandoffStartedAt.current = Date.now();
    setSignupSuccessTakingLonger(false);
    setSignupSuccessError(null);
    setSignupSuccessPhase("confirming");
    void completeFreeSignup();
  };

  const handlePasswordComplete = async () => {
    if (planIntent && giftQuery.isSuccess && !giftQuery.data.pendingGift) {
      await patchSignupProgress({ step: SIGNUP_STEP.PLAN });
      router.push(planIntent.checkoutPath);
      return;
    }
    await patchSignupProgress({ step: SIGNUP_STEP.SAMPLER });
    goToStep(SIGNUP_STEP.SAMPLER, 1);
  };

  const handlePlanComplete = () => {
    finishOnboarding();
  };

  const pendingGift = giftQuery.data?.pendingGift ?? null;
  const heading = stepHeading(step, Boolean(pendingGift));
  const isWideStep = step === SIGNUP_STEP.PLAN || step === SIGNUP_STEP.SAMPLER;

  if (signupSuccessJourney && signupSuccessPhase) {
    return (
      <PlanChoiceHandoff
        journey={signupSuccessJourney}
        phase={signupSuccessPhase}
        takingLonger={signupSuccessTakingLonger}
        error={signupSuccessError}
        onRetry={() => {
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
        onComplete={() => router.replace("/dashboard")}
      />
    );
  }

  return (
    <div className="relative flex min-h-dvh flex-col bg-background text-foreground transition-colors">
      <NoiseOverlay />
      <div className="fixed right-4 top-4 z-50 sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>

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
                  className={`text-xs font-bold uppercase tracking-[0.2em] text-primary dark:text-accent ${typo.dataMono}`}
                >
                  {heading.kicker}
                </span>
                <h1
                  className={`mt-2 text-3xl font-bold text-foreground sm:text-4xl ${typo.headingSans}`}
                >
                  {heading.title}
                </h1>
                <p
                  className={`mt-2 text-muted-foreground ${typo.secondarySans}`}
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
                  supabase={supabase}
                  confirmedEmail={initial.email}
                  initialEmail={details.email}
                  pendingEmail={details.pendingEmail}
                  initialFirstName={details.firstName}
                  initialLastName={details.lastName}
                  initialPhone={details.phone}
                  newsletterOptIn={initial.newsletterOptIn}
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

              {step === SIGNUP_STEP.SAMPLER ? (
                <SignupCompleteSamplerStep
                  familiarity={familiarity}
                  onFamiliarityChange={setFamiliarity}
                  gift={pendingGift}
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
