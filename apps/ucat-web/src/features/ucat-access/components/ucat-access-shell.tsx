"use client";

import { Suspense, type ReactNode } from "react";
import { OnboardingGateRedirect } from "@/features/ucat-access/components/onboarding-gate-redirect";
import { InPersonUpsellDialog } from "@/features/ucat-access/components/in-person-upsell-dialog";
import { PlanPickerDialog } from "@/features/ucat-access/components/plan-picker-dialog";
import { QuotaLimitModal } from "@/features/ucat-access/components/quota-limit-modal";
import { UpsellQueryParamSync } from "@/features/ucat-access/components/upsell-query-param-sync";
import { QuotaLimitProvider } from "@/features/ucat-access/context/quota-limit-context";
import { UpsellDialogProvider } from "@/features/ucat-access/context/upsell-dialog-context";

type UcatAccessShellProps = {
  children: ReactNode;
};

export function UcatAccessShell({ children }: UcatAccessShellProps) {
  return (
    <QuotaLimitProvider>
      <UpsellDialogProvider>
        <OnboardingGateRedirect />
        <Suspense fallback={null}>
          <UpsellQueryParamSync />
        </Suspense>
        {children}
        <QuotaLimitModal />
        <PlanPickerDialog />
        <InPersonUpsellDialog />
      </UpsellDialogProvider>
    </QuotaLimitProvider>
  );
}
