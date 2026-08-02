"use client";

import { useRef, useState } from "react";
import { discardExamAttempt } from "@/features/exam-attempts/api/exam-attempts-api";
import { useActiveExamAttempt } from "@/features/exam-attempts/context/active-exam-attempt-context";
import type {
  ActiveExamAttempt,
  ExamAttemptKind,
} from "@/lib/ucat/exam-attempt/types";

export function useExamAttemptLaunchPreflight({
  kind,
  resourceId,
  onLaunch,
}: {
  kind: ExamAttemptKind;
  resourceId: string;
  onLaunch: () => void | Promise<void>;
}) {
  const { active, refresh, clearLocal } = useActiveExamAttempt();
  const [conflictActive, setConflictActive] =
    useState<ActiveExamAttempt | null>(null);
  const [isDiscarding, setIsDiscarding] = useState(false);
  const discardPromiseRef = useRef<Promise<void> | null>(null);

  function requestLaunch() {
    if (active && (active.kind !== kind || active.resourceId !== resourceId)) {
      setConflictActive(active);
      return;
    }
    void onLaunch();
  }

  async function discardConflictAndLaunch() {
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
      await onLaunch();
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
    conflictActive,
    isDiscarding,
    requestLaunch,
    discardConflictAndLaunch,
    cancelConflict: () => setConflictActive(null),
  };
}
