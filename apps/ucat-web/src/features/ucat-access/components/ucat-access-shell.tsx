"use client";

import type { ReactNode } from "react";
import { OnboardingGateRedirect } from "@/features/ucat-access/components/onboarding-gate-redirect";
import { QuotaLimitModal } from "@/features/ucat-access/components/quota-limit-modal";
import { QuotaLimitProvider } from "@/features/ucat-access/context/quota-limit-context";

type UcatAccessShellProps = {
  children: ReactNode;
};

export function UcatAccessShell({ children }: UcatAccessShellProps) {
  return (
    <QuotaLimitProvider>
      <OnboardingGateRedirect />
      {children}
      <QuotaLimitModal />
    </QuotaLimitProvider>
  );
}
