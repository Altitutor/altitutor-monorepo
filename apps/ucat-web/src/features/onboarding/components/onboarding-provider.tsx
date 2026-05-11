"use client";

import type { ReactNode } from "react";
import { NextStep, NextStepProvider } from "nextstepjs";
import { OnboardingCard } from "@/features/onboarding/components/onboarding-card";
import { OnboardingScrollRepaint } from "@/features/onboarding/components/onboarding-scroll-repaint";
import { ucatOnboardingTours } from "@/features/onboarding/config/tour-steps";
import { onboardingStorage } from "@/features/onboarding/lib/storage";

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const handleFinish = (tour: string | null) => {
    if (!tour) return;
    onboardingStorage.markCompleted(tour);
  };

  return (
    <NextStepProvider>
      <OnboardingScrollRepaint />
      <NextStep
        steps={ucatOnboardingTours}
        cardComponent={OnboardingCard}
        // marketing.primary #0a2941 → rgb(10,41,65)
        shadowRgb="10,41,65"
        shadowOpacity="0.55"
        cardTransition={{ duration: 0.25, ease: "easeOut" }}
        onComplete={handleFinish}
        onSkip={(_step, tour) => handleFinish(tour)}
        scrollToTop={false}
        disableConsoleLogs
      >
        {children}
      </NextStep>
    </NextStepProvider>
  );
}
