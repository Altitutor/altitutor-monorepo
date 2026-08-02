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
import { useRouter } from "next/navigation";
import type {
  QuestionEngineExam,
  QuestionEngineState,
} from "@/features/question-engine/model/types";
import type {
  ActiveExamAttempt,
  ExamAttemptKind,
  QuestionActiveTimingContext,
} from "@/lib/ucat/exam-attempt/types";
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
import { useQuotaLimitDialog } from "@/features/ucat-access/context/upsell-dialog-context";
import { quotaRouteFallback } from "@/features/ucat-access/lib/quota-route-fallback";
import { QuotaExceededError } from "@/lib/ucat/quota/parse-quota-error";

function toExamEngineSnapshot(
  state: QuestionEngineState,
): StoredExamSnapshot["state"] {
  return {
    phase: state.phase,
    instructionsIndex: state.instructionsIndex,
    showReadyDialog: state.showReadyDialog,
    showTimeExpiredDialog: state.showTimeExpiredDialog,
    timeExpiredFromInstructions: state.timeExpiredFromInstructions,
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
    activeQuestionTiming: state.activeQuestionTiming,
  };
}

export function sanitizeEngineSnapshotForExam(
  exam: QuestionEngineExam,
  snapshot: StoredExamSnapshot["state"],
): StoredExamSnapshot["state"] {
  const questionIds = new Set(exam.questions.map((question) => question.id));
  const filterQuestionIds = (ids: string[] | undefined) =>
    (ids ?? []).filter((id) => questionIds.has(id));
  const filterQuestionRecord = <T>(record: Record<string, T> | undefined) =>
    Object.fromEntries(
      Object.entries(record ?? {}).filter(([id]) => questionIds.has(id)),
    );
  const lastQuestionIndex = Math.max(exam.questions.length - 1, 0);
  const restoreReadyDialogOverInstructions =
    snapshot.phase === "intro" &&
    "instructionsScreens" in exam &&
    exam.instructionsScreens.length > 0;

  return {
    ...snapshot,
    phase: restoreReadyDialogOverInstructions ? "instructions" : snapshot.phase,
    instructionsIndex: restoreReadyDialogOverInstructions
      ? 0
      : snapshot.instructionsIndex,
    showReadyDialog: restoreReadyDialogOverInstructions
      ? false
      : snapshot.showReadyDialog,
    currentIndex: Math.min(
      Math.max(snapshot.currentIndex ?? 0, 0),
      lastQuestionIndex,
    ),
    viewingQuestionIndex:
      snapshot.viewingQuestionIndex == null
        ? null
        : Math.min(
            Math.max(snapshot.viewingQuestionIndex, 0),
            lastQuestionIndex,
          ),
    visitedQuestionIds: filterQuestionIds(snapshot.visitedQuestionIds),
    flaggedIds: filterQuestionIds(snapshot.flaggedIds),
    selectedAnswers: filterQuestionRecord(snapshot.selectedAnswers),
    syllogismSnapshots: filterQuestionRecord(snapshot.syllogismSnapshots),
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

function getActiveAttemptFromConflict(
  error: unknown,
): ActiveExamAttempt | null {
  if (!(error instanceof Error)) return null;
  if (error.message !== "EXAM_ATTEMPT_IN_PROGRESS") return null;
  const active = (error as Error & { active?: ActiveExamAttempt | null })
    .active;
  return active ?? null;
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

export function getExamSnapshotSyncDelay(
  pendingSinceMs: number,
  nowMs: number,
  debounceMs = 800,
  maxWaitMs = 2_000,
): number {
  return Math.max(
    0,
    Math.min(debounceMs, maxWaitMs - Math.max(0, nowMs - pendingSinceMs)),
  );
}

export function isCurrentSegmentSyncResponse(
  requestedSegmentKey: string,
  currentSegmentKey: string | null,
): boolean {
  return requestedSegmentKey === currentSegmentKey;
}

export function useExamAttemptLifecycle({
  enabled,
  exam,
  state,
  setState,
  practice,
  practiceSessionId,
  attemptStateRef,
  suppressQuestionTimingSyncRef,
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
  suppressQuestionTimingSyncRef?: MutableRefObject<boolean>;
}) {
  const { active, refresh, setLocal, updateLocal, clearLocal } =
    useActiveExamAttempt();
  const router = useRouter();
  const { openQuotaLimit } = useQuotaLimitDialog();
  const attemptIdRef = useRef<string | null>(null);
  const [serverSegmentEndsAt, setServerSegmentEndsAt] = useState<string | null>(
    null,
  );
  const [documentVisible, setDocumentVisible] = useState(
    () =>
      typeof document === "undefined" || document.visibilityState === "visible",
  );
  const [hydrationStatus, setHydrationStatus] = useState<
    "idle" | "hydrating" | "hydrated"
  >("idle");
  const beganRef = useRef(false);
  const beginningRef = useRef(false);
  const beginCompletionRef = useRef<Promise<void> | null>(null);
  const hydratedRef = useRef(false);
  const hydratingRef = useRef(false);
  const latestStateRef = useRef(state);
  const lifecycleKeyRef = useRef<string | null>(null);
  const segmentKeyRef = useRef<string | null>(null);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncPendingSinceRef = useRef<number | null>(null);
  const syncBlockedRef = useRef(false);
  const beginBlockedRef = useRef(false);
  const segmentStartPendingRef = useRef(false);
  const latestSyncInputRef = useRef<
    Parameters<typeof syncExamAttempt>[0] | null
  >(null);
  const latestQuestionTimingRef = useRef<QuestionActiveTimingContext | null>(
    null,
  );
  const syncQueueRef = useRef<Promise<void>>(Promise.resolve());

  const enqueueSync = useCallback(
    <T>(operation: () => Promise<T>): Promise<T> => {
      const result = syncQueueRef.current.then(operation, operation);
      syncQueueRef.current = result.then(
        () => undefined,
        () => undefined,
      );
      return result;
    },
    [],
  );

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
    beginningRef.current = false;
    beginCompletionRef.current = null;
    hydratedRef.current = false;
    hydratingRef.current = false;
    segmentKeyRef.current = null;
    syncPendingSinceRef.current = null;
    syncBlockedRef.current = false;
    beginBlockedRef.current = false;
    segmentStartPendingRef.current = false;
    setHydrationStatus("idle");
    setServerSegmentEndsAt(null);
  }, [lifecycleKey]);

  latestStateRef.current = state;

  latestQuestionTimingRef.current =
    enabled && documentVisible && exam && state.phase === "question"
      ? (() => {
          const question = exam.questions[state.currentIndex];
          if (!question) return null;
          const limit = getCurrentSegmentTimeLimitSeconds(exam, state);
          return {
            questionId: question.id,
            questionSetId: question.questionSetId,
            mode: exam.sourceType,
            wasTimed: limit != null && limit > 0,
          };
        })()
      : null;

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
          questionActiveTiming: latestQuestionTimingRef.current,
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
        let snapshot = sanitizeEngineSnapshotForExam(
          exam,
          attempt.engineSnapshot,
        );

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
            void enqueueSync(() =>
              syncExamAttempt({
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
                questionActiveTiming: null,
              }),
            )
              .then(() => refresh())
              .catch(() => {
                // Resume state is already usable; a retry will occur on next sync.
              });
          }
        }

        const serverSegmentKey = getTimedSegmentKey(exam, snapshot);
        // Resuming is server-authoritative. The engine performs automatic
        // intro/visited-state updates while the fresh attempt is loading; an
        // identity check here previously mistook those for user edits and
        // discarded the saved answers and current index.
        const nextLocalState: QuestionEngineState = {
          ...latestStateRef.current,
          ...snapshot,
          showTimeExpiredDialog: false,
        };
        const localSegmentKey = getTimedSegmentKey(exam, nextLocalState);

        segmentKeyRef.current = serverSegmentKey;
        setServerSegmentEndsAt(
          localSegmentKey === serverSegmentKey ? endsAt : null,
        );
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
        setLocal({
          ...attempt,
          currentSegmentEndsAt:
            localSegmentKey === serverSegmentKey ? endsAt : null,
          engineSnapshot: toExamEngineSnapshot(nextLocalState),
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
    enqueueSync,
  ]);

  const beginIfNeeded = useCallback(async () => {
    if (!enabled || !exam || !kind || !resourceId || beganRef.current) return;
    if (beginningRef.current) {
      await beginCompletionRef.current;
      return;
    }
    if (hydratingRef.current) return;
    if (beginBlockedRef.current) return;

    beginningRef.current = true;
    let resolveBeginCompletion: () => void = () => {};
    const beginCompletion = new Promise<void>((resolve) => {
      resolveBeginCompletion = resolve;
    });
    beginCompletionRef.current = beginCompletion;
    const stateAtBegin = state;

    const segmentLimit = getCurrentSegmentTimeLimitSeconds(exam, state);
    const wasTimed = segmentLimit != null && segmentLimit > 0;

    const examMeta: StoredExamSnapshot["exam"] = {
      sourceType: exam.sourceType,
      sourceId: exam.sourceId,
      practice,
      label: exam.title,
    };

    let questionSetIdForMockSet: string | undefined;
    if (kind === "mock" && exam.mockSetSummaries?.length) {
      const firstStart = exam.mockSetSummaries[0]?.questionStartIndex ?? 0;
      questionSetIdForMockSet = exam.questions[firstStart]?.questionSetId;
    }

    let attempt: Awaited<ReturnType<typeof beginExamAttempt>>["attempt"];
    let resumed = false;
    try {
      const initialQuestionTiming = latestQuestionTimingRef.current;
      const engineSnapshot = toExamEngineSnapshot(state);
      if (initialQuestionTiming) {
        engineSnapshot.activeQuestionTiming = {
          ...initialQuestionTiming,
          startedAt: new Date().toISOString(),
          segmentEndsAt: null,
        };
      }
      const result = await beginExamAttempt({
        kind,
        resourceId,
        practiceSessionId: practiceSessionId ?? undefined,
        wasTimed,
        engineSnapshot,
        segmentTimeLimitSeconds: segmentLimit,
        questionSetIdForMockSet,
        examMeta,
        examTiming: toStoredExamTiming(exam),
      });
      if (lifecycleKeyRef.current !== lifecycleKey) return;
      attempt = result.attempt;
      resumed = result.resumed;
    } catch (error) {
      if (lifecycleKeyRef.current !== lifecycleKey) return;
      if (error instanceof QuotaExceededError) {
        beginBlockedRef.current = true;
        syncBlockedRef.current = true;
        openQuotaLimit(error.payload, {
          dismissAction: quotaRouteFallback(error.payload.area),
        });
        return;
      }
      const activeConflict = getActiveAttemptFromConflict(error);
      if (activeConflict) {
        beginBlockedRef.current = true;
        syncBlockedRef.current = true;
        setLocal(activeConflict);
        router.replace(activeConflict.resumeHref);
        return;
      }
      throw error;
    } finally {
      if (lifecycleKeyRef.current === lifecycleKey) {
        beginningRef.current = false;
      }
      resolveBeginCompletion();
      if (beginCompletionRef.current === beginCompletion) {
        beginCompletionRef.current = null;
      }
    }

    const attemptSnapshot = sanitizeEngineSnapshotForExam(
      exam,
      attempt.engineSnapshot,
    );
    const resumedAttempt = {
      ...attempt,
      engineSnapshot: attemptSnapshot,
    };
    // Server catch-up may finalize a resumed attempt while the begin request
    // is running. Never hydrate that completion sentinel into the old
    // in-engine results phase.
    if (isAttemptAtResults(resumedAttempt)) {
      clearLocal();
      window.location.assign(attempt.resultsHref);
      return;
    }
    const serverSegmentKey = getTimedSegmentKey(exam, attemptSnapshot);
    const latestState = latestStateRef.current;
    // A resumed attempt is server-authoritative. Mount-time engine effects
    // (notably marking the first question visited) change the local state
    // identity while the begin request is in flight; treating that automatic
    // change as a user edit previously discarded the saved current index and
    // answers, then autosaved the empty mount state over the good snapshot.
    const shouldApplySnapshot = resumed || latestState === stateAtBegin;
    const nextLocalState = shouldApplySnapshot
      ? {
          ...latestState,
          ...attemptSnapshot,
          showTimeExpiredDialog: false,
        }
      : latestState;
    const localSegmentKey = getTimedSegmentKey(exam, nextLocalState);

    beganRef.current = true;
    hydratedRef.current = true;
    hydratingRef.current = false;
    attemptIdRef.current = attempt.attemptId;
    segmentKeyRef.current = serverSegmentKey;
    setServerSegmentEndsAt(
      localSegmentKey === serverSegmentKey
        ? attempt.currentSegmentEndsAt
        : null,
    );
    setLocal({
      ...attempt,
      currentSegmentEndsAt:
        localSegmentKey === serverSegmentKey
          ? attempt.currentSegmentEndsAt
          : null,
      engineSnapshot: toExamEngineSnapshot(nextLocalState),
    });
    attemptStateRef.current.mockAttemptId = attempt.mockAttemptId;
    attemptStateRef.current.setAttemptIdsBySetId = new Map(
      Object.entries(attempt.setAttemptIdsBySetId),
    );
    if (shouldApplySnapshot) {
      setState((prev) =>
        resumed
          ? {
              ...prev,
              ...attemptSnapshot,
              showTimeExpiredDialog: false,
            }
          : prev === stateAtBegin
            ? nextLocalState
            : prev,
      );
    }
    setHydrationStatus("hydrated");
  }, [
    enabled,
    exam,
    kind,
    resourceId,
    lifecycleKey,
    state,
    practice,
    practiceSessionId,
    setState,
    setLocal,
    clearLocal,
    attemptStateRef,
    openQuotaLimit,
    router,
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
    const localSegmentEndsAt =
      limit != null && limit > 0 && state.timerStartedAt != null
        ? new Date(state.timerStartedAt + limit * 1000).toISOString()
        : null;
    const shouldPreserveLocalElapsed =
      localSegmentEndsAt != null && Date.now() - state.timerStartedAt! > 1000;
    const attemptId = attemptIdRef.current;
    const requestedSegmentKey = segmentKey;
    segmentStartPendingRef.current = true;
    setServerSegmentEndsAt(null);
    void enqueueSync(() =>
      syncExamAttempt({
        kind,
        attemptId,
        engineSnapshot: toExamEngineSnapshot(state),
        currentSegmentEndsAt: shouldPreserveLocalElapsed
          ? localSegmentEndsAt
          : null,
        startSegmentTimeLimitSeconds: shouldPreserveLocalElapsed
          ? undefined
          : limit,
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
        questionActiveTiming: latestQuestionTimingRef.current,
      }),
    )
      .then(({ currentSegmentEndsAt, setAttemptIdsBySetId }) => {
        if (setAttemptIdsBySetId) {
          attemptStateRef.current.setAttemptIdsBySetId = new Map(
            Object.entries(setAttemptIdsBySetId),
          );
        }
        if (
          !isCurrentSegmentSyncResponse(
            requestedSegmentKey,
            segmentKeyRef.current,
          )
        ) {
          if (setAttemptIdsBySetId) {
            updateLocal(attemptId, { setAttemptIdsBySetId });
          }
          return;
        }
        setServerSegmentEndsAt(currentSegmentEndsAt);
        updateLocal(attemptId, {
          currentSegmentEndsAt,
          engineSnapshot: toExamEngineSnapshot(state),
          ...(setAttemptIdsBySetId ? { setAttemptIdsBySetId } : {}),
        });
      })
      .catch(() => {
        // A failed background sync must not crash the question engine.
      })
      .finally(() => {
        if (segmentKeyRef.current === requestedSegmentKey) {
          segmentStartPendingRef.current = false;
        }
      });
  }, [
    enabled,
    exam,
    kind,
    hydrationStatus,
    practice,
    segmentKey,
    state.phase,
    state.showReadyDialog,
    state,
    updateLocal,
    attemptStateRef,
    enqueueSync,
  ]);

  useEffect(() => {
    if (!enabled || !exam || !kind || !attemptIdRef.current) return;
    if (syncBlockedRef.current) return;
    if (segmentStartPendingRef.current) return;
    if (suppressQuestionTimingSyncRef?.current) return;
    if (kind && isExamAttemptAtResults(kind, state.phase)) return;
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    const now = Date.now();
    const pendingSince = syncPendingSinceRef.current ?? now;
    syncPendingSinceRef.current = pendingSince;
    const delay = getExamSnapshotSyncDelay(pendingSince, now);
    syncTimerRef.current = setTimeout(() => {
      syncPendingSinceRef.current = null;
      if (syncBlockedRef.current) return;
      if (suppressQuestionTimingSyncRef?.current) return;
      if (kind && isExamAttemptAtResults(kind, state.phase)) return;
      const engineSnapshot = toExamEngineSnapshot(state);
      const attemptId = attemptIdRef.current!;
      const requestedSegmentKey = getTimedSegmentKey(exam, state);
      void enqueueSync(() =>
        syncExamAttempt({
          kind,
          attemptId,
          engineSnapshot,
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
          questionActiveTiming: latestQuestionTimingRef.current,
        }),
      )
        .then(({ currentSegmentEndsAt, setAttemptIdsBySetId }) => {
          if (setAttemptIdsBySetId) {
            attemptStateRef.current.setAttemptIdsBySetId = new Map(
              Object.entries(setAttemptIdsBySetId),
            );
          }
          if (
            !isCurrentSegmentSyncResponse(
              requestedSegmentKey,
              segmentKeyRef.current,
            )
          ) {
            if (setAttemptIdsBySetId) {
              updateLocal(attemptId, { setAttemptIdsBySetId });
            }
            return;
          }
          setServerSegmentEndsAt(currentSegmentEndsAt);
          updateLocal(attemptId, {
            currentSegmentEndsAt,
            engineSnapshot,
            ...(setAttemptIdsBySetId ? { setAttemptIdsBySetId } : {}),
          });
        })
        .catch(() => {
          // Keep the local engine usable and retry on the next state change.
        });
    }, delay);
    return () => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
  }, [
    enabled,
    exam,
    kind,
    state,
    practice,
    attemptStateRef,
    serverSegmentEndsAt,
    updateLocal,
    suppressQuestionTimingSyncRef,
    enqueueSync,
  ]);

  const activeQuestionTimingKey = latestQuestionTimingRef.current
    ? `${latestQuestionTimingRef.current.questionId}:${latestQuestionTimingRef.current.questionSetId}:${latestQuestionTimingRef.current.wasTimed ? "timed" : "untimed"}`
    : "none";

  useEffect(() => {
    const onVisibilityChange = () => {
      setDocumentVisible(document.visibilityState === "visible");
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  const syncQuestionTiming = useCallback(async () => {
    if (!enabled || !exam || !kind || !attemptIdRef.current) return false;
    if (syncBlockedRef.current) return false;
    if (segmentStartPendingRef.current) return false;
    if (kind && isExamAttemptAtResults(kind, state.phase)) return false;
    const input = {
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
      questionActiveTiming: latestQuestionTimingRef.current,
    };
    const requestedSegmentKey = getTimedSegmentKey(exam, state);
    try {
      const { currentSegmentEndsAt, setAttemptIdsBySetId } = await enqueueSync(
        () => syncExamAttempt(input),
      );
      if (setAttemptIdsBySetId) {
        attemptStateRef.current.setAttemptIdsBySetId = new Map(
          Object.entries(setAttemptIdsBySetId),
        );
      }
      if (
        !isCurrentSegmentSyncResponse(
          requestedSegmentKey,
          segmentKeyRef.current,
        )
      ) {
        if (setAttemptIdsBySetId) {
          updateLocal(attemptIdRef.current!, { setAttemptIdsBySetId });
        }
        return true;
      }
      setServerSegmentEndsAt(currentSegmentEndsAt);
      updateLocal(attemptIdRef.current!, {
        currentSegmentEndsAt,
        engineSnapshot: toExamEngineSnapshot(state),
        ...(setAttemptIdsBySetId ? { setAttemptIdsBySetId } : {}),
      });
      return true;
    } catch {
      // Question timing retries on the next heartbeat or transition.
      return false;
    }
  }, [
    enabled,
    exam,
    kind,
    state,
    serverSegmentEndsAt,
    attemptStateRef,
    practice,
    updateLocal,
    enqueueSync,
  ]);

  useEffect(() => {
    if (!enabled || !exam || !kind || !attemptIdRef.current) return;
    if (suppressQuestionTimingSyncRef?.current) return;
    void syncQuestionTiming();
  }, [
    enabled,
    exam,
    kind,
    hydrationStatus,
    activeQuestionTimingKey,
    syncQuestionTiming,
    suppressQuestionTimingSyncRef,
  ]);

  useEffect(() => {
    if (!enabled || activeQuestionTimingKey === "none") return;
    const id = setInterval(syncQuestionTiming, 15000);
    return () => clearInterval(id);
  }, [enabled, activeQuestionTimingKey, syncQuestionTiming]);

  const flushQuestionTiming = useCallback(
    async (engineStateOverride?: QuestionEngineState) => {
      const engineState = engineStateOverride ?? state;
      if (!enabled || !exam || !kind) return false;
      if (!attemptIdRef.current) {
        if (beginningRef.current && beginCompletionRef.current) {
          await beginCompletionRef.current;
        } else {
          await beginIfNeeded();
        }
      }
      if (!attemptIdRef.current) return false;
      const attemptId = attemptIdRef.current;
      const requestedSegmentKey = getTimedSegmentKey(exam, engineState);
      if (syncBlockedRef.current) return false;
      if (kind && isExamAttemptAtResults(kind, engineState.phase)) return false;

      try {
        const { currentSegmentEndsAt, setAttemptIdsBySetId } =
          await enqueueSync(() =>
            syncExamAttempt({
              kind,
              attemptId,
              engineSnapshot: toExamEngineSnapshot(engineState),
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
              questionActiveTiming: null,
            }),
          );
        if (setAttemptIdsBySetId) {
          attemptStateRef.current.setAttemptIdsBySetId = new Map(
            Object.entries(setAttemptIdsBySetId),
          );
        }
        if (
          !isCurrentSegmentSyncResponse(
            requestedSegmentKey,
            segmentKeyRef.current,
          )
        ) {
          if (setAttemptIdsBySetId) {
            updateLocal(attemptId, { setAttemptIdsBySetId });
          }
          return true;
        }
        setServerSegmentEndsAt(currentSegmentEndsAt);
        updateLocal(attemptId, {
          currentSegmentEndsAt,
          engineSnapshot: {
            ...toExamEngineSnapshot(engineState),
            activeQuestionTiming: null,
          },
          ...(setAttemptIdsBySetId ? { setAttemptIdsBySetId } : {}),
        });
        return true;
      } catch {
        return false;
      }
    },
    [
      enabled,
      exam,
      kind,
      state,
      serverSegmentEndsAt,
      attemptStateRef,
      practice,
      updateLocal,
      beginIfNeeded,
      enqueueSync,
    ],
  );

  useEffect(() => {
    const flushLatestSnapshot = () => {
      const input = latestSyncInputRef.current;
      if (!input) return;
      if (isExamAttemptAtResults(input.kind, input.engineSnapshot.phase))
        return;
      syncExamAttemptKeepalive({ ...input, questionActiveTiming: null });
    };

    window.addEventListener("pagehide", flushLatestSnapshot);
    return () => {
      window.removeEventListener("pagehide", flushLatestSnapshot);
      flushLatestSnapshot();
      syncPendingSinceRef.current = null;
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
  }, []);

  return {
    serverSegmentEndsAt,
    serverSegmentKey: segmentKeyRef.current,
    attemptId: attemptIdRef.current,
    isHydrating: hydrationStatus === "hydrating",
    flushQuestionTiming,
  };
}
