"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  clearSignupJustCompleted,
  isSignupJustCompleted,
} from "@/features/signup-onboarding/lib/signup-tour-flag";
import { isAllowedBeforeSignupComplete } from "@/features/signup-onboarding/lib/signup-complete-paths";
import { useUcatAccess } from "@/features/ucat-access/hooks/use-ucat-access";

/**
 * Redirects authenticated students who have not finished signup onboarding
 * to /signup/complete (resumes persisted step server-side).
 */
export function OnboardingGateRedirect() {
  const router = useRouter();
  const pathname = usePathname();
  const access = useUcatAccess();
  const redirectingRef = useRef(false);

  useEffect(() => {
    if (access.isLoading) return;

    // An access lookup failure is not evidence that signup is incomplete.
    // Fail open so a transient Supabase/network error cannot create a
    // /dashboard ↔ /signup/complete redirect loop.
    if (access.accessLoadFailed) return;

    if (access.signupCompleted) {
      clearSignupJustCompleted();
      redirectingRef.current = false;
      return;
    }

    if (isSignupJustCompleted()) return;

    if (isAllowedBeforeSignupComplete(pathname)) {
      redirectingRef.current = false;
      return;
    }

    // Avoid spamming history.replaceState while the soft navigation is in
    // flight (Safari throws after ~100 replaceState calls / 10s).
    if (redirectingRef.current) return;
    redirectingRef.current = true;
    router.replace("/signup/complete");
  }, [
    access.accessLoadFailed,
    access.isLoading,
    access.signupCompleted,
    pathname,
    router,
  ]);

  return null;
}
