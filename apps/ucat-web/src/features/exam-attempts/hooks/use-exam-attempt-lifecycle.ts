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
  syncExamAttempt,
} from "@/features/exam-attempts/api/exam-attempts-api";
import { useActiveExamAttempt } from "@/features/exam-attempts/context/active-exam-attempt-context";
import {
  getCurrentMockSegment,
  getCurrentSegmentTimeLimitSeconds,
} from "@/features/question-engine/lib/timing";
import { computeSegmentEndsAt } from "@/lib/ucat/exam-attempt/timing";
import { catchUpExpiredSegments } from "@/lib/ucat/exam-attempt/segment-catch-up";
import type { StoredExamSnapshot } from "@/lib/ucat/exam-attempt/service";

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
  const { refresh, active } = useActiveExamAttempt();
  const attemptIdRef = useRef<string | null>(null);
  const [serverSegmentEndsAt, setServerSegmentEndsAt] = useState<string | null>(
    null,
  );
  const beganRef = useRef(false);
  const hydratedRef = useRef(false);
  const segmentKeyRef = useRef<string | null>(null);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const kind = exam ? resolveExamAttemptKind(exam, practice) : null;
  const resourceId =
    kind === "practice"
      ? (practiceSessionId ?? null)
      : kind != null && exam
        ? exam.sourceId
        : null;

  useEffect(() => {
    if (!enabled || !exam || !kind || !resourceId) return;
    if (hydratedRef.current) return;
    if (!active || active.kind !== kind || active.resourceId !== resourceId) {
      return;
    }
    hydratedRef.current = true;
    beganRef.current = true;
    attemptIdRef.current = active.attemptId;
    let endsAt = active.currentSegmentEndsAt;
    let snapshot = active.engineSnapshot;

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
          attemptId: active.attemptId,
          engineSnapshot: snapshot,
          currentSegmentEndsAt: endsAt,
          setAttemptIdsBySetId: active.setAttemptIdsBySetId,
          examMeta: {
            sourceType: exam.sourceType,
            sourceId: exam.sourceId,
            practice,
          },
          mockAttemptId: active.mockAttemptId,
        }).then(() => refresh());
      }
    }

    setServerSegmentEndsAt(endsAt);
    attemptStateRef.current.mockAttemptId = active.mockAttemptId;
    attemptStateRef.current.setAttemptIdsBySetId = new Map(
      Object.entries(active.setAttemptIdsBySetId),
    );
    setState((prev) => ({
      ...prev,
      ...snapshot,
      showTimeExpiredDialog: false,
    }));
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
  ]);

  const beginIfNeeded = useCallback(async () => {
    if (!enabled || !exam || !kind || !resourceId || beganRef.current) return;

    const segmentLimit = getCurrentSegmentTimeLimitSeconds(exam, state);
    const endsAt = computeSegmentEndsAt(segmentLimit);
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
    });

    beganRef.current = true;
    attemptIdRef.current = attempt.attemptId;
    setServerSegmentEndsAt(attempt.currentSegmentEndsAt ?? endsAt);
    attemptStateRef.current.mockAttemptId = attempt.mockAttemptId;
    attemptStateRef.current.setAttemptIdsBySetId = new Map(
      Object.entries(attempt.setAttemptIdsBySetId),
    );
    setState((prev) => ({
      ...prev,
      ...attempt.engineSnapshot,
      showTimeExpiredDialog: false,
    }));
    await refresh();
  }, [
    enabled,
    exam,
    kind,
    resourceId,
    state,
    practice,
    practiceSessionId,
    setState,
    refresh,
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

  const segmentKey =
    exam?.sourceType === "mock"
      ? String(
          getCurrentMockSegment(exam, state)?.segmentIndex ??
            `${state.phase}-${state.instructionsIndex}-${state.currentIndex}`,
        )
      : `${state.phase}-${state.instructionsIndex}-${state.currentIndex}`;

  useEffect(() => {
    if (!enabled || !exam || !kind || !beganRef.current) return;
    if (state.showReadyDialog || state.phase === "intro") return;

    const inExamSegment =
      state.phase === "instructions" ||
      state.phase === "question" ||
      (practice && state.phase === "practiceAnswer");
    if (!inExamSegment) return;

    if (segmentKeyRef.current === segmentKey) return;
    const previousSegmentKey = segmentKeyRef.current;
    segmentKeyRef.current = segmentKey;

    const limit = getCurrentSegmentTimeLimitSeconds(exam, state);
    if (limit == null || limit <= 0) {
      if (previousSegmentKey !== null) {
        setServerSegmentEndsAt(null);
      }
      return;
    }
    if (previousSegmentKey === null) return;

    setServerSegmentEndsAt(computeSegmentEndsAt(limit));
  }, [
    enabled,
    exam,
    kind,
    practice,
    segmentKey,
    state.phase,
    state.showReadyDialog,
    state,
  ]);

  useEffect(() => {
    if (!enabled || !exam || !kind || !attemptIdRef.current) return;
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => {
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
        mockAttemptId: attemptStateRef.current.mockAttemptId,
      }).then(() => refresh());
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

  const updateSegmentEndsAt = useCallback((endsAt: string | null) => {
    setServerSegmentEndsAt(endsAt);
  }, []);

  return {
    serverSegmentEndsAt,
    updateSegmentEndsAt,
    attemptId: attemptIdRef.current,
  };
}
