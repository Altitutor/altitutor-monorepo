"use client";

import { useEffect, useState } from "react";
import {
  fetchActiveExamAttempt,
  finalizeExamAttempt,
} from "@/features/exam-attempts/api/exam-attempts-api";
import { useActiveExamAttempt } from "@/features/exam-attempts/context/active-exam-attempt-context";
import type {
  ActiveExamAttempt,
  ExamAttemptKind,
} from "@/lib/ucat/exam-attempt/types";

type LaunchGateStatus = "checking" | "allowed" | "blocked";

export function useExamAttemptLaunchGate(
  input: { kind: ExamAttemptKind; resourceId: string } | null,
) {
  const kind = input?.kind;
  const resourceId = input?.resourceId;
  const { refresh } = useActiveExamAttempt();
  const [status, setStatus] = useState<LaunchGateStatus>(
    input?.resourceId ? "checking" : "allowed",
  );
  const [conflictActive, setConflictActive] =
    useState<ActiveExamAttempt | null>(null);
  const [isFinalizing, setIsFinalizing] = useState(false);

  useEffect(() => {
    if (!input || !resourceId || !kind) {
      setStatus("allowed");
      setConflictActive(null);
      return;
    }

    let cancelled = false;
    setStatus("checking");
    void (async () => {
      const active = await fetchActiveExamAttempt();
      if (cancelled) return;
      if (!active || (active.kind === kind && active.resourceId === resourceId)) {
        setConflictActive(null);
        setStatus("allowed");
        return;
      }
      setConflictActive(active);
      setStatus("blocked");
    })();

    return () => {
      cancelled = true;
    };
  }, [input, kind, resourceId]);

  async function finalizeConflictAndContinue() {
    if (!conflictActive) return;
    setIsFinalizing(true);
    try {
      await finalizeExamAttempt({
        kind: conflictActive.kind,
        attemptId: conflictActive.attemptId,
      });
      await refresh();
      setConflictActive(null);
      setStatus("allowed");
    } finally {
      setIsFinalizing(false);
    }
  }

  function cancelConflict() {
    setConflictActive(null);
  }

  return {
    launchAllowed: status === "allowed",
    isCheckingLaunch: status === "checking",
    conflictActive: status === "blocked" ? conflictActive : null,
    isFinalizingConflict: isFinalizing,
    finalizeConflictAndContinue,
    cancelConflict,
  };
}
