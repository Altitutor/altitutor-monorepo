"use client";

import type { ReactNode } from "react";
import { NextStep, NextStepProvider } from "nextstepjs";
import { useTheme } from "next-themes";
import { OnboardingCard } from "@/features/onboarding/components/onboarding-card";
import { OnboardingScrollRepaint } from "@/features/onboarding/components/onboarding-scroll-repaint";
import { TutorialInteractionController } from "@/features/onboarding/components/tutorial-interaction-controller";
import { TutorialLifecycleController } from "@/features/onboarding/components/tutorial-lifecycle-controller";
import { ucatOnboardingTours } from "@/features/onboarding/config/tour-steps";
import { useCompleteOnboardingTour } from "@/features/onboarding/hooks/use-onboarding-progress";
import { clearTutorialResume } from "@/features/onboarding/lib/tutorial-resume";

// Keep both themes neutral: the overlay should dim the page, not tint it.
const LIGHT_SHADOW = { rgb: "0,0,0", opacity: "0.58" } as const;
const DARK_SHADOW = { rgb: "0,0,0", opacity: "0.7" } as const;

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const completeTour = useCompleteOnboardingTour();
  const { resolvedTheme } = useTheme();
  const shadow = resolvedTheme === "dark" ? DARK_SHADOW : LIGHT_SHADOW;

  const handleFinish = (tour: string | null) => {
    if (!tour) return;
    clearTutorialResume(tour);
    // Fire-and-forget; the mutation invalidates the progress query on success
    // so the auto-start hook won't re-trigger this tour on the next mount.
    completeTour.mutate(tour);
  };

  return (
    <NextStepProvider>
      <OnboardingScrollRepaint />
      <TutorialInteractionController />
      <TutorialLifecycleController />
      <NextStep
        steps={ucatOnboardingTours}
        cardComponent={OnboardingCard}
        shadowRgb={shadow.rgb}
        shadowOpacity={shadow.opacity}
        cardTransition={{ duration: 0.25, ease: "easeOut" }}
        onComplete={handleFinish}
        onSkip={(_step, tour) => handleFinish(tour)}
        scrollToTop={false}
        displayArrow={false}
        disableConsoleLogs
      >
        {children}
      </NextStep>
    </NextStepProvider>
  );
}
