"use client";

import { useEffect, useState } from "react";
import { discardExamAttempt } from "@/features/exam-attempts/api/exam-attempts-api";
import { useActiveExamAttempt } from "@/features/exam-attempts/context/active-exam-attempt-context";
import type {
  ActiveExamAttempt,
  ExamAttemptKind,
} from "@/lib/ucat/exam-attempt/types";

type LaunchGateStatus = "checking" | "allowed" | "blocked";

export function useExamAttemptLaunchGate(
  kind: ExamAttemptKind | null,
  resourceId: string | undefined,
) {
  const { active, isLoading, refresh } = useActiveExamAttempt();
  const [status, setStatus] = useState<LaunchGateStatus>(
    kind && resourceId ? "checking" : "allowed",
  );
  const [conflictActive, setConflictActive] =
    useState<ActiveExamAttempt | null>(null);
  const [isDiscarding, setIsDiscarding] = useState(false);

  useEffect(() => {
    if (!kind || !resourceId) {
      setStatus("allowed");
      setConflictActive(null);
      return;
    }

    if (isLoading) {
      setStatus("checking");
      return;
    }

    if (!active || (active.kind === kind && active.resourceId === resourceId)) {
      setConflictActive(null);
      setStatus("allowed");
      return;
    }

    setConflictActive(active);
    setStatus("blocked");
  }, [kind, resourceId, active, isLoading]);

  async function discardConflictAndContinue() {
    if (!conflictActive) return;
    setIsDiscarding(true);
    try {
      await discardExamAttempt({
        kind: conflictActive.kind,
        attemptId: conflictActive.attemptId,
      });
      await refresh();
      setConflictActive(null);
      setStatus("allowed");
    } finally {
      setIsDiscarding(false);
    }
  }

  return {
    launchAllowed: status === "allowed",
    isCheckingLaunch: status === "checking",
    conflictActive: status === "blocked" ? conflictActive : null,
    isDiscardingConflict: isDiscarding,
    discardConflictAndContinue,
  };
}
