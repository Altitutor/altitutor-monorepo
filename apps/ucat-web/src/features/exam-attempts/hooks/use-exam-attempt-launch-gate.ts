"use client";

import { useEffect, useRef, useState } from "react";
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
  const { active, isLoading, refresh, clearLocal } = useActiveExamAttempt();
  const [status, setStatus] = useState<LaunchGateStatus>(
    kind && resourceId ? "checking" : "allowed",
  );
  const [conflictActive, setConflictActive] =
    useState<ActiveExamAttempt | null>(null);
  const [isDiscarding, setIsDiscarding] = useState(false);
  const discardPromiseRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    if (!kind || !resourceId) {
      setStatus("allowed");
      setConflictActive(null);
      return;
    }

    if (isDiscarding) {
      setStatus("checking");
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
  }, [kind, resourceId, active, isLoading, isDiscarding]);

  async function discardConflictAndContinue() {
    if (discardPromiseRef.current) return discardPromiseRef.current;
    const attemptToDiscard = conflictActive;
    if (!attemptToDiscard) return;

    setIsDiscarding(true);
    const request = (async () => {
      await discardExamAttempt({
        kind: attemptToDiscard.kind,
        attemptId: attemptToDiscard.attemptId,
      });
      clearLocal();
      await refresh();
      setConflictActive(null);
      setStatus("allowed");
    })();
    discardPromiseRef.current = request;

    try {
      await request;
    } finally {
      if (discardPromiseRef.current === request) {
        discardPromiseRef.current = null;
        setIsDiscarding(false);
      }
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
