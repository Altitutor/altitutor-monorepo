"use client";

import type { ReactNode } from "react";
import { OnboardingModal } from "@/features/ucat-access/components/onboarding-modal";
import { QuotaLimitModal } from "@/features/ucat-access/components/quota-limit-modal";
import { QuotaLimitProvider } from "@/features/ucat-access/context/quota-limit-context";

type UcatAccessShellProps = {
  children: ReactNode;
};

export function UcatAccessShell({ children }: UcatAccessShellProps) {
  return (
    <QuotaLimitProvider>
      {children}
      <OnboardingModal />
      <QuotaLimitModal />
    </QuotaLimitProvider>
  );
}
