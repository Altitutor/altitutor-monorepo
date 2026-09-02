import React, { Suspense } from "react";
import { ActiveExamAttemptProvider } from "@/features/exam-attempts/context/active-exam-attempt-context";
import { OnboardingProvider } from "@/features/onboarding";
import { UcatLagProvider } from "@/features/question-engine/context/ucat-lag-context";
import { StudyPlanCompanionProvider } from "@/features/study-plan/context/study-plan-companion-context";
import { GuidedSamplerPage } from "@/features/signup-onboarding/components/guided-sampler-page";
import { UpsellDialogProvider } from "@/features/ucat-access/context/upsell-dialog-context";

export default function GuidedSamplerRoute() {
  return (
    <UpsellDialogProvider>
      <ActiveExamAttemptProvider>
        <StudyPlanCompanionProvider>
          <OnboardingProvider>
            <UcatLagProvider>
              <Suspense fallback={null}>
                <GuidedSamplerPage />
              </Suspense>
            </UcatLagProvider>
          </OnboardingProvider>
        </StudyPlanCompanionProvider>
      </ActiveExamAttemptProvider>
    </UpsellDialogProvider>
  );
}
