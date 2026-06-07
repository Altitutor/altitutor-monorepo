"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useUcatAccess } from "@/features/ucat-access/hooks/use-ucat-access";

/** Paths reachable before the student completes UCAT plan onboarding on /subscribe. */
const ALLOWED_BEFORE_ONBOARDING = ["/subscribe"];

/**
 * Redirects authenticated students who have not chosen Free vs Pro to /subscribe.
 * Replaces the former onboarding modal — /subscribe is the single plan-picker surface.
 */
export function OnboardingGateRedirect() {
  const router = useRouter();
  const pathname = usePathname();
  const access = useUcatAccess();

  useEffect(() => {
    if (access.isLoading) return;
    if (access.onboardingCompleted) return;

    const allowed = ALLOWED_BEFORE_ONBOARDING.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    );
    if (allowed) return;

    router.replace("/subscribe");
  }, [
    access.isLoading,
    access.onboardingCompleted,
    pathname,
    router,
  ]);

  return null;
}
