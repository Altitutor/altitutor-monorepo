"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { MARKETING_TOKENS } from "@altitutor/shared";
import { motion, useReducedMotion } from "motion/react";
import { AnimatedStepPanel } from "@/features/signup-onboarding/components/animated-step-panel";
import { SignupStepIndicator } from "@/features/signup-onboarding/components/signup-step-indicator";
import { patchSignupProgress } from "@/features/signup-onboarding/api/signup-progress";
import { markSignupOnboardingTourPending, markSignupJustCompleted } from "@/features/signup-onboarding/lib/signup-tour-flag";
import { SIGNUP_STEP } from "@/features/signup-onboarding/lib/steps";
import type { SignupOnboardingInitial, SignupOnboardingStep } from "@/features/signup-onboarding/types";
import { SignupCompleteDetailsStep } from "@/features/signup-onboarding/components/steps/details-step";
import { SignupCompletePasswordStep } from "@/features/signup-onboarding/components/steps/password-step";
import { SignupCompletePlanStep } from "@/features/signup-onboarding/components/steps/plan-step";
import { useUcatAccess } from "@/features/ucat-access/hooks/use-ucat-access";
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
        kicker: "Step 3 of 3",
        title: "Choose your plan",
        desc: "Start free or unlock unlimited access.",
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
  const reduceMotion = useReducedMotion();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [step, setStep] = useState<SignupOnboardingStep>(initial.step);
  const [direction, setDirection] = useState(1);
  const [checkoutConfirming, setCheckoutConfirming] = useState(false);
  const [checkoutMessage, setCheckoutMessage] = useState<string | null>(null);

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
        await patchSignupProgress({ complete: true });
        await navigateAfterSignupComplete();
      } catch (e) {
        setCheckoutConfirming(false);
        setError(e instanceof Error ? e.message : "Failed to confirm plan");
      }
    })();
  }, [checkoutConfirming, access.isLoading, access.onlineTier, queryClient, navigateAfterSignupComplete]);

  const finishOnboarding = async () => {
    setError(null);
    try {
      await patchSignupProgress({ complete: true });
      await navigateAfterSignupComplete();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    }
  };

  const handlePasswordComplete = async () => {
    await patchSignupProgress({ step: SIGNUP_STEP.PLAN });
    goToStep(SIGNUP_STEP.PLAN, 1);
  };

  const handlePlanComplete = () => {
    void finishOnboarding();
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
            </div>
          </AnimatedStepPanel>
        </motion.div>
      </main>
    </div>
  );
}
