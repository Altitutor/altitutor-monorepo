"use client";

import { Suspense, type ReactNode } from "react";
import { ActiveExamAttemptProvider } from "@/features/exam-attempts/context/active-exam-attempt-context";
import { ActiveSkillTrainerAttemptProvider } from "@/features/skill-trainer/context/active-skill-trainer-attempt-context";
import { OnboardingGateRedirect } from "@/features/ucat-access/components/onboarding-gate-redirect";
import { InPersonUpsellDialog } from "@/features/ucat-access/components/in-person-upsell-dialog";
import { PlanPickerDialog } from "@/features/ucat-access/components/plan-picker-dialog";
import { QuotaRouteGuard } from "@/features/ucat-access/components/quota-route-guard";
import { UpsellQueryParamSync } from "@/features/ucat-access/components/upsell-query-param-sync";
import { UpsellDialogProvider } from "@/features/ucat-access/context/upsell-dialog-context";

type UcatAccessShellProps = {
  children: ReactNode;
};

export function UcatAccessShell({ children }: UcatAccessShellProps) {
  return (
    <UpsellDialogProvider>
      <ActiveExamAttemptProvider>
        <ActiveSkillTrainerAttemptProvider>
          <OnboardingGateRedirect />
          <Suspense fallback={null}>
            <UpsellQueryParamSync />
          </Suspense>
          <Suspense fallback={null}>
            <QuotaRouteGuard />
          </Suspense>
          {children}
          <PlanPickerDialog />
          <InPersonUpsellDialog />
        </ActiveSkillTrainerAttemptProvider>
      </ActiveExamAttemptProvider>
    </UpsellDialogProvider>
  );
}
