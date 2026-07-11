"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { UCAT_QUESTION_ENGINE_TOUR } from "@/features/onboarding/config/tour-steps";
import { useOnboardingProgress } from "@/features/onboarding/hooks/use-onboarding-progress";

function isQuestionEnginePath(pathname: string): boolean {
  return (
    pathname === "/exam/sets" ||
    pathname === "/exam/mocks" ||
    pathname === "/practice/session" ||
    pathname.startsWith("/practice/stem/") ||
    /^\/sessions\/[^/]+\/(sets|mocks)\/[^/]+$/.test(pathname)
  );
}

export function QuestionEngineTutorialRedirect() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isLoading, isCompleted } = useOnboardingProgress();

  useEffect(() => {
    if (isLoading || !isQuestionEnginePath(pathname)) return;
    if (isCompleted(UCAT_QUESTION_ENGINE_TOUR)) return;
    const query = searchParams.toString();
    const returnTo = `${pathname}${query ? `?${query}` : ""}`;
    router.replace(`/exam/tutorial?returnTo=${encodeURIComponent(returnTo)}`);
  }, [isLoading, isCompleted, pathname, router, searchParams]);

  return null;
}
