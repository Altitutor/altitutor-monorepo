"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import type {
  QuestionEngineExam,
  QuestionEngineState,
} from "@/features/question-engine/model/types";
import type { ExamAttemptKind } from "@/lib/ucat/exam-attempt/types";
import {
  beginExamAttempt,
  fetchActiveExamAttempt,
  finalizeExamAttempt,
  syncExamAttempt,
  syncExamAttemptKeepalive,
} from "@/features/exam-attempts/api/exam-attempts-api";
import { useActiveExamAttempt } from "@/features/exam-attempts/context/active-exam-attempt-context";
import { getCurrentSegmentTimeLimitSeconds } from "@/features/question-engine/lib/timing";
import { getTimedSegmentKey } from "@/features/question-engine/lib/timed-segment-key";
import { catchUpExpiredSegments } from "@/lib/ucat/exam-attempt/segment-catch-up";
import type { StoredExamSnapshot } from "@/lib/ucat/exam-attempt/service";
import { toStoredExamTiming } from "@/lib/ucat/exam-attempt/load-exam-for-catch-up";
import { isAttemptAtResults } from "@/features/exam-attempts/lib/banner-copy";
import { isExamAttemptAtResults } from "@/lib/ucat/exam-attempt/finalize-attempt";

function toExamEngineSnapshot(
  state: QuestionEngineState,
): StoredExamSnapshot["state"] {
  return {
    phase: state.phase,
    instructionsIndex: state.instructionsIndex,
    showReadyDialog: state.showReadyDialog,
    showTimeExpiredDialog: state.showTimeExpiredDialog,
    nextSegmentTimerStartedAt: state.nextSegmentTimerStartedAt,
    currentIndex: state.currentIndex,
    visitedQuestionIds: state.visitedQuestionIds,
    flaggedIds: state.flaggedIds,
    selectedAnswers: state.selectedAnswers,
    syllogismSnapshots: state.syllogismSnapshots,
    reviewFilter: state.reviewFilter,
    reviewFilterIndex: state.reviewFilterIndex,
    reviewFilterIndicesSnapshot: state.reviewFilterIndicesSnapshot,
    mockCurrentSetIndex: state.mockCurrentSetIndex,
    practiceAnswerUnitStartIndex: state.practiceAnswerUnitStartIndex,
    practiceAnswerUnitEndIndex: state.practiceAnswerUnitEndIndex,
    viewingQuestionIndex: state.viewingQuestionIndex,
    loadingMoreTargetIndex: state.loadingMoreTargetIndex,
    loadingMoreExcludeStemIds: state.loadingMoreExcludeStemIds,
  };
}

function resolveExamAttemptKind(
  exam: QuestionEngineExam,
  practice: boolean,
): ExamAttemptKind | null {
  if (practice) return "practice";
  if (exam.sourceType === "set") return "set";
  if (exam.sourceType === "mock") return "mock";
  return null;
}

async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), ms);
    }),
  ]);
}

export function useExamAttemptLifecycle({
  enabled,
  exam,
  state,
  setState,
  practice,
  practiceSessionId,
  attemptStateRef,
}: {
  enabled: boolean;
  exam: QuestionEngineExam | undefined;
  state: QuestionEngineState;
  setState: Dispatch<SetStateAction<QuestionEngineState>>;
  practice: boolean;
  practiceSessionId?: string | null;
  attemptStateRef: MutableRefObject<{
    mockAttemptId: string | null;
    setAttemptIdsBySetId: Map<string, string>;
  }>;
}) {
  const { active, refresh, setLocal, updateLocal, clearLocal } =
    useActiveExamAttempt();
  const attemptIdRef = useRef<string | null>(null);
  const [serverSegmentEndsAt, setServerSegmentEndsAt] = useState<string | null>(
    null,
  );
  const [hydrationStatus, setHydrationStatus] = useState<
    "idle" | "hydrating" | "hydrated"
  >("idle");
  const beganRef = useRef(false);
  const hydratedRef = useRef(false);
  const hydratingRef = useRef(false);
  const lifecycleKeyRef = useRef<string | null>(null);
  const segmentKeyRef = useRef<string | null>(null);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncBlockedRef = useRef(false);
  const segmentStartPendingRef = useRef(false);
  const latestSyncInputRef = useRef<
    Parameters<typeof syncExamAttempt>[0] | null
  >(null);

  const kind = exam ? resolveExamAttemptKind(exam, practice) : null;
  const resourceId =
    kind === "practice"
      ? (practiceSessionId ?? null)
      : kind != null && exam
        ? exam.sourceId
        : null;
  const lifecycleKey = kind && resourceId ? `${kind}:${resourceId}` : null;

  useEffect(() => {
    if (lifecycleKeyRef.current === lifecycleKey) return;
    lifecycleKeyRef.current = lifecycleKey;
    attemptIdRef.current = null;
    beganRef.current = false;
    hydratedRef.current = false;
    hydratingRef.current = false;
    segmentKeyRef.current = null;
    syncBlockedRef.current = false;
    segmentStartPendingRef.current = false;
    setHydrationStatus("idle");
    setServerSegmentEndsAt(null);
  }, [lifecycleKey]);

  latestSyncInputRef.current =
    enabled && exam && kind && attemptIdRef.current
      ? {
          kind,
          attemptId: attemptIdRef.current,
          engineSnapshot: toExamEngineSnapshot(state),
          currentSegmentEndsAt: serverSegmentEndsAt,
          setAttemptIdsBySetId: Object.fromEntries(
            attemptStateRef.current.setAttemptIdsBySetId.entries(),
          ),
          examMeta: {
            sourceType: exam.sourceType,
            sourceId: exam.sourceId,
            practice,
          },
          examTiming: toStoredExamTiming(exam),
          mockAttemptId: attemptStateRef.current.mockAttemptId,
        }
      : null;

  useEffect(() => {
    if (!enabled || !exam || !kind || !resourceId) return;
    if (hydratedRef.current) return;
    if (!active || active.kind !== kind || active.resourceId !== resourceId) {
      return;
    }
    hydratedRef.current = true;
    hydratingRef.current = true;
    setHydrationStatus("hydrating");
    let cancelled = false;

    void (async () => {
      let attempt = active;
      try {
        const freshAttempt = await withTimeout(fetchActiveExamAttempt(), 1500);
        if (
          freshAttempt?.kind === kind &&
          freshAttempt.resourceId === resourceId
        ) {
          attempt = freshAttempt;
        }
      } catch {
        // The cached attempt is still a usable fallback if refresh fails.
      }
      try {
        if (cancelled) return;

        attemptIdRef.current = attempt.attemptId;
        beganRef.current = true;
        let endsAt = attempt.currentSegmentEndsAt;
        let snapshot = attempt.engineSnapshot;

        if (exam && endsAt) {
          const caught = catchUpExpiredSegments(exam, snapshot, endsAt, {
            practice: kind === "practice",
          });
          if (
            caught.state !== snapshot ||
            caught.currentSegmentEndsAt !== endsAt
          ) {
            snapshot = caught.state;
            endsAt = caught.currentSegmentEndsAt;
            void syncExamAttempt({
              kind,
              attemptId: attempt.attemptId,
              engineSnapshot: snapshot,
              currentSegmentEndsAt: endsAt,
              setAttemptIdsBySetId: attempt.setAttemptIdsBySetId,
              examMeta: {
                sourceType: exam.sourceType,
                sourceId: exam.sourceId,
                practice,
              },
              examTiming: toStoredExamTiming(exam),
              mockAttemptId: attempt.mockAttemptId,
            })
              .then(() => refresh())
              .catch(() => {
                // Resume state is already usable; a retry will occur on next sync.
              });
          }
        }

        setServerSegmentEndsAt(endsAt);
        attemptStateRef.current.mockAttemptId = attempt.mockAttemptId;
        attemptStateRef.current.setAttemptIdsBySetId = new Map(
          Object.entries(attempt.setAttemptIdsBySetId),
        );

        const hydratedAttempt = {
          ...attempt,
          engineSnapshot: snapshot,
        };
        if (isAttemptAtResults(hydratedAttempt)) {
          syncBlockedRef.current = true;
          if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
          try {
            await finalizeExamAttempt({
              kind: attempt.kind,
              attemptId: attempt.attemptId,
            });
          } catch {
            // Finalize may already have run server-side during active fetch.
          }
          clearLocal();
          window.location.assign(attempt.resultsHref);
          return;
        }

        setState((prev) => ({
          ...prev,
          ...snapshot,
          showTimeExpiredDialog: false,
        }));
        segmentKeyRef.current = getTimedSegmentKey(exam, snapshot);
        setLocal({
          ...attempt,
          currentSegmentEndsAt: endsAt,
          engineSnapshot: snapshot,
        });
      } finally {
        if (!cancelled) {
          hydratingRef.current = false;
          setHydrationStatus("hydrated");
        }
      }
    })();

    return () => {
      cancelled = true;
      hydratingRef.current = false;
    };
  }, [
    enabled,
    exam,
    kind,
    resourceId,
    active,
    setState,
    attemptStateRef,
    practice,
    refresh,
    setLocal,
    clearLocal,
  ]);

  const beginIfNeeded = useCallback(async () => {
    if (!enabled || !exam || !kind || !resourceId || beganRef.current) return;
    if (hydratingRef.current) return;

    const segmentLimit = getCurrentSegmentTimeLimitSeconds(exam, state);
    const wasTimed = segmentLimit != null && segmentLimit > 0;

    const examMeta: StoredExamSnapshot["exam"] = {
      sourceType: exam.sourceType,
      sourceId: exam.sourceId,
      practice,
    };

    let questionSetIdForMockSet: string | undefined;
    if (kind === "mock" && exam.mockSetSummaries?.length) {
      const firstStart = exam.mockSetSummaries[0]?.questionStartIndex ?? 0;
      questionSetIdForMockSet = exam.questions[firstStart]?.questionSetId;
    }

    const { attempt } = await beginExamAttempt({
      kind,
      resourceId,
      practiceSessionId: practiceSessionId ?? undefined,
      wasTimed,
      engineSnapshot: toExamEngineSnapshot(state),
      segmentTimeLimitSeconds: segmentLimit,
      questionSetIdForMockSet,
      examMeta,
      examTiming: toStoredExamTiming(exam),
    });

    beganRef.current = true;
    hydratedRef.current = true;
    hydratingRef.current = false;
    attemptIdRef.current = attempt.attemptId;
    setServerSegmentEndsAt(attempt.currentSegmentEndsAt);
    setLocal(attempt);
    attemptStateRef.current.mockAttemptId = attempt.mockAttemptId;
    attemptStateRef.current.setAttemptIdsBySetId = new Map(
      Object.entries(attempt.setAttemptIdsBySetId),
    );
    setState((prev) => ({
      ...prev,
      ...attempt.engineSnapshot,
      showTimeExpiredDialog: false,
    }));
    setHydrationStatus("hydrated");
  }, [
    enabled,
    exam,
    kind,
    resourceId,
    state,
    practice,
    practiceSessionId,
    setState,
    setLocal,
    attemptStateRef,
  ]);

  useEffect(() => {
    if (!enabled || !exam || !kind) return;
    const inExamSegment =
      state.phase === "instructions" ||
      state.phase === "question" ||
      (practice && state.phase === "practiceAnswer");
    if (!inExamSegment) return;
    if (state.showReadyDialog || state.phase === "intro") return;
    void beginIfNeeded();
  }, [
    enabled,
    exam,
    kind,
    state.phase,
    state.showReadyDialog,
    practice,
    beginIfNeeded,
  ]);

  const segmentKey = exam ? getTimedSegmentKey(exam, state) : "";

  useEffect(() => {
    if (
      !enabled ||
      !exam ||
      !kind ||
      !beganRef.current ||
      !attemptIdRef.current ||
      hydratingRef.current
    ) {
      return;
    }
    if (state.showReadyDialog || state.phase === "intro") return;

    const inExamSegment =
      state.phase === "instructions" ||
      state.phase === "question" ||
      state.phase === "review" ||
      (practice && state.phase === "practiceAnswer");
    if (!inExamSegment) return;

    if (segmentKeyRef.current === segmentKey) return;
    const previousSegmentKey = segmentKeyRef.current;
    segmentKeyRef.current = segmentKey;

    if (previousSegmentKey === null) return;
    const limit = getCurrentSegmentTimeLimitSeconds(exam, state);
    segmentStartPendingRef.current = true;
    void syncExamAttempt({
      kind,
      attemptId: attemptIdRef.current,
      engineSnapshot: toExamEngineSnapshot(state),
      currentSegmentEndsAt: null,
      startSegmentTimeLimitSeconds: limit,
      setAttemptIdsBySetId: Object.fromEntries(
        attemptStateRef.current.setAttemptIdsBySetId.entries(),
      ),
      examMeta: {
        sourceType: exam.sourceType,
        sourceId: exam.sourceId,
        practice,
      },
      examTiming: toStoredExamTiming(exam),
      mockAttemptId: attemptStateRef.current.mockAttemptId,
    })
      .then(({ currentSegmentEndsAt }) => {
        setServerSegmentEndsAt(currentSegmentEndsAt);
        updateLocal(attemptIdRef.current!, {
          currentSegmentEndsAt,
          engineSnapshot: toExamEngineSnapshot(state),
        });
      })
      .catch(() => {
        // A failed background sync must not crash the question engine.
      })
      .finally(() => {
        segmentStartPendingRef.current = false;
      });
  }, [
    enabled,
    exam,
    kind,
    practice,
    segmentKey,
    state.phase,
    state.showReadyDialog,
    state,
    updateLocal,
    attemptStateRef,
  ]);

  useEffect(() => {
    if (!enabled || !exam || !kind || !attemptIdRef.current) return;
    if (syncBlockedRef.current) return;
    if (segmentStartPendingRef.current) return;
    if (kind && isExamAttemptAtResults(kind, state.phase)) return;
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => {
      if (syncBlockedRef.current) return;
      if (kind && isExamAttemptAtResults(kind, state.phase)) return;
      void syncExamAttempt({
        kind,
        attemptId: attemptIdRef.current!,
        engineSnapshot: toExamEngineSnapshot(state),
        currentSegmentEndsAt: serverSegmentEndsAt,
        setAttemptIdsBySetId: Object.fromEntries(
          attemptStateRef.current.setAttemptIdsBySetId.entries(),
        ),
        examMeta: {
          sourceType: exam.sourceType,
          sourceId: exam.sourceId,
          practice,
        },
        examTiming: toStoredExamTiming(exam),
        mockAttemptId: attemptStateRef.current.mockAttemptId,
      })
        .then(() => refresh())
        .catch(() => {
          // Keep the local engine usable and retry on the next state change.
        });
    }, 800);
    return () => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
  }, [
    enabled,
    exam,
    kind,
    state,
    practice,
    refresh,
    attemptStateRef,
    serverSegmentEndsAt,
  ]);

  useEffect(() => {
    const flushLatestSnapshot = () => {
      const input = latestSyncInputRef.current;
      if (!input) return;
      if (isExamAttemptAtResults(input.kind, input.engineSnapshot.phase)) return;
      syncExamAttemptKeepalive(input);
    };

    window.addEventListener("pagehide", flushLatestSnapshot);
    return () => {
      window.removeEventListener("pagehide", flushLatestSnapshot);
      flushLatestSnapshot();
      syncBlockedRef.current = true;
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
  }, []);

  return {
    serverSegmentEndsAt,
    attemptId: attemptIdRef.current,
    isHydrating: hydrationStatus === "hydrating",
  };
}
