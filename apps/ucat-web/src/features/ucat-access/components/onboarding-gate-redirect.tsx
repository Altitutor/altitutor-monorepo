"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  clearSignupJustCompleted,
  isSignupJustCompleted,
} from "@/features/signup-onboarding/lib/signup-tour-flag";
import { useUcatAccess } from "@/features/ucat-access/hooks/use-ucat-access";

/** Paths reachable before the student completes signup onboarding. */
const ALLOWED_BEFORE_SIGNUP_COMPLETE = ["/signup/complete"];

/**
 * Redirects authenticated students who have not finished signup onboarding
 * to /signup/complete (resumes persisted step server-side).
 */
export function OnboardingGateRedirect() {
  const router = useRouter();
  const pathname = usePathname();
  const access = useUcatAccess();

  useEffect(() => {
    if (access.isLoading) return;

    if (access.signupCompleted) {
      clearSignupJustCompleted();
      return;
    }

    if (isSignupJustCompleted()) return;

    const allowed = ALLOWED_BEFORE_SIGNUP_COMPLETE.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    );
    if (allowed) return;

    router.replace("/signup/complete");
  }, [access.isLoading, access.signupCompleted, pathname, router]);

  return null;
}
