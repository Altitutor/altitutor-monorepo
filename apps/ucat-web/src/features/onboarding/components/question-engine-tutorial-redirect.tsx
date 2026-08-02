"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  buildQuestionEngineTutorialHref,
  isQuestionEnginePath,
  useQuestionEngineTutorialGate,
} from "@/features/onboarding/hooks/use-question-engine-tutorial-gate";
import { useActiveExamAttempt } from "@/features/exam-attempts/context/active-exam-attempt-context";
import {
  clearPracticeSession,
  getPracticeSession,
} from "@/features/practice/lib/session-storage";

/**
 * Real engine routes redirect here until the question-engine tutorial is done.
 * Practice sessions used to be created before this redirect, which left an
 * "in progress" banner whose Resume link bounced back to the tutorial.
 */
export function QuestionEngineTutorialRedirect() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isLoading, isBlocked } = useQuestionEngineTutorialGate();
  const { active, isLoading: activeLoading } = useActiveExamAttempt();
  const abandonedSessionRef = useRef<string | null>(null);

  useEffect(() => {
    if (isLoading || !isQuestionEnginePath(pathname) || !isBlocked) return;

    const query = searchParams.toString();
    const returnTo = `${pathname}${query ? `?${query}` : ""}`;

    // Never-begun practice rows (no engine_snapshot → not "active") are orphans
    // from Start → redirect. Drop local session state; the DB row is harmless
    // to the banner (active attempts require an engine_snapshot).
    if (
      pathname === "/exam" &&
      !activeLoading &&
      active == null
    ) {
      const local = getPracticeSession();
      if (
        local?.sessionId &&
        abandonedSessionRef.current !== local.sessionId
      ) {
        abandonedSessionRef.current = local.sessionId;
        clearPracticeSession();
      }
    }

    router.replace(buildQuestionEngineTutorialHref(returnTo));
  }, [
    active,
    activeLoading,
    isBlocked,
    isLoading,
    pathname,
    router,
    searchParams,
  ]);

  return null;
}
