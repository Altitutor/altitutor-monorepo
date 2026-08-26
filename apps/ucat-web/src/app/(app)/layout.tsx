import type React from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { HydrationBoundary, QueryClient, dehydrate } from "@tanstack/react-query";
import {
  isUcatOnlineTier,
  VERIFIED_USER_ID_HEADER,
} from "@altitutor/shared";
import { AppShell } from "@/features/layout";
import { UcatAccessShell } from "@/features/ucat-access/components/ucat-access-shell";
import { PortalAccessUnavailable } from "@/features/auth/components/portal-access-unavailable";
import { loadUcatPortalAccess } from "@/features/auth/server/portal-access";

type AuthenticatedLayoutProps = {
  children?: React.ReactNode;
};

export default async function AuthenticatedLayout({
  children,
}: AuthenticatedLayoutProps) {
  const verifiedUserId = (await headers()).get(VERIFIED_USER_ID_HEADER);
  const result = await loadUcatPortalAccess(verifiedUserId);
  if (result.status === "unauthenticated") redirect("/login");
  if (result.status === "unavailable") return <PortalAccessUnavailable />;

  const { access, userId } = result;
  if (access.activeStaffRole) redirect("/auth/staff-account");
  if (access.signupCompleted !== true) redirect("/signup/complete");

  const queryClient = new QueryClient();
  queryClient.setQueryData(["ucat-access", userId], {
    hasOnlineAccess: access.hasOnlineAccess,
    hasInPersonAccess: access.hasInPersonAccess,
    hasUcatAccess: access.hasUcatAccess,
    onlineTier: isUcatOnlineTier(access.onlineTier) ? access.onlineTier : null,
    isQuotaExempt: access.isQuotaExempt,
    onboardingCompleted: access.onboardingCompleted,
    signupCompleted: true,
    signupStep: access.signupStep,
    unlimitedTrialEligible: access.unlimitedTrialEligible,
    analyticsAccountClass: access.analyticsAccountClass,
    testYear: access.testYear,
    testDate: access.testDate,
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <UcatAccessShell>
        <AppShell>{children}</AppShell>
      </UcatAccessShell>
    </HydrationBoundary>
  );
}
