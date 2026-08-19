import type {
  QuestionEngineExam,
  QuestionEngineState,
} from "@/features/question-engine/model/types";
import {
  computeSegmentEndsAt,
  getCurrentSegmentTimeLimitSeconds,
  getNextMockSegment,
  getNextSetSegmentFromReview,
} from "@/lib/ucat/exam-attempt/timing";
import { getStemBoundaries } from "@/features/question-engine/lib/practice";
import type { ExamEngineSnapshot } from "@/lib/ucat/exam-attempt/types";

export type CatchUpResult = {
  state: ExamEngineSnapshot;
  currentSegmentEndsAt: string | null;
  isComplete: boolean;
};

function toSnapshot(state: QuestionEngineState): ExamEngineSnapshot {
  return {
    phase: state.phase,
    instructionsIndex: state.instructionsIndex,
    showReadyDialog: state.showReadyDialog,
    showTimeExpiredDialog: false,
    nextSegmentTimerStartedAt: null,
    currentIndex: state.currentIndex,
    visitedQuestionIds: state.visitedQuestionIds,
    flaggedIds: state.flaggedIds,
    selectedAnswers: state.selectedAnswers,
    placementSnapshots: state.placementSnapshots,
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

function advanceOneSegmentExpiry(
  exam: QuestionEngineExam,
  state: ExamEngineSnapshot,
  practice: boolean,
  expiredEndsAt: string,
): CatchUpResult {
  const working = { ...state, showTimeExpiredDialog: false };
  const nextSegmentStartsAt = new Date(expiredEndsAt).getTime();
  working.activeQuestionTiming = null;

  if (exam.sourceType === "questions" || exam.sourceType === "questionStem") {
    if (practice) {
      if ((exam.practiceSessionTimeLimitSeconds ?? 0) > 0) {
        return {
          state: { ...working, phase: "practiceComplete" },
          currentSegmentEndsAt: null,
          isComplete: true,
        };
      }
      const { startIndex, endIndex } = getStemBoundaries(
        exam.questions,
        working.currentIndex,
        exam.sourceType,
      );
      return {
        state: {
          ...working,
          phase: "practiceAnswer",
          practiceAnswerUnitStartIndex: startIndex,
          practiceAnswerUnitEndIndex: endIndex,
          viewingQuestionIndex: startIndex,
        },
        currentSegmentEndsAt: null,
        isComplete: false,
      };
    }
    return {
      state: working,
      currentSegmentEndsAt: null,
      isComplete: true,
    };
  }

  if (exam.sourceType === "set") {
    if (working.phase === "instructions") {
      const next: ExamEngineSnapshot = {
        ...working,
        phase: "question",
        currentIndex: 0,
      };
      const limit = getCurrentSegmentTimeLimitSeconds(
        exam,
        next as QuestionEngineState,
      );
      return {
        state: next,
        currentSegmentEndsAt: computeSegmentEndsAt(limit, nextSegmentStartsAt),
        isComplete: false,
      };
    }
    if (working.phase === "question" || working.phase === "review") {
      return {
        state: { ...working, phase: "marking" },
        currentSegmentEndsAt: null,
        isComplete: true,
      };
    }
    return {
      state: working,
      currentSegmentEndsAt: null,
      isComplete: false,
    };
  }

  if (exam.sourceType === "mock") {
    if (working.phase === "review") {
      const setIndex = working.mockCurrentSetIndex ?? 0;
      const summaries = exam.mockSetSummaries ?? [];
      const isLastSet =
        summaries.length === 0 || setIndex >= summaries.length - 1;
      if (!isLastSet) {
        const nextSeg = getNextSetSegmentFromReview(exam, setIndex);
        if (nextSeg) {
          const next: ExamEngineSnapshot = {
            ...working,
            reviewFilter: null,
            reviewFilterIndex: 0,
            reviewFilterIndicesSnapshot: null,
            mockCurrentSetIndex: setIndex + 1,
          };
          if (nextSeg.type === "instructions") {
            next.phase = "instructions";
            next.instructionsIndex = nextSeg.instructionsIndex;
          } else {
            next.phase = "question";
            next.currentIndex = nextSeg.questionStartIndex;
          }
          const limit = getCurrentSegmentTimeLimitSeconds(
            exam,
            next as QuestionEngineState,
          );
          return {
            state: next,
            currentSegmentEndsAt: computeSegmentEndsAt(
              limit,
              nextSegmentStartsAt,
            ),
            isComplete: false,
          };
        }
      }
      return {
        state: { ...working, phase: "mockScore" },
        currentSegmentEndsAt: null,
        isComplete: false,
      };
    }

    const nextSeg = getNextMockSegment(exam, working as QuestionEngineState);
    if (!nextSeg) {
      return {
        state: { ...working, phase: "mockScore" },
        currentSegmentEndsAt: null,
        isComplete: false,
      };
    }
    const next: ExamEngineSnapshot = { ...working };
    if (nextSeg.type === "instructions") {
      next.phase = "instructions";
      next.instructionsIndex = nextSeg.instructionsIndex;
    } else {
      next.phase = "question";
      next.currentIndex = nextSeg.questionStartIndex;
    }
    const limit = getCurrentSegmentTimeLimitSeconds(
      exam,
      next as QuestionEngineState,
    );
    return {
      state: next,
      currentSegmentEndsAt: computeSegmentEndsAt(limit, nextSegmentStartsAt),
      isComplete: false,
    };
  }

  return {
    state: working,
    currentSegmentEndsAt: null,
    isComplete: true,
  };
}

export function catchUpExpiredSegments(
  exam: QuestionEngineExam,
  state: ExamEngineSnapshot,
  currentSegmentEndsAt: string | null,
  options?: { practice?: boolean },
): CatchUpResult {
  const practice = options?.practice ?? false;
  let workingState = { ...state };
  let endsAt = currentSegmentEndsAt;
  const now = Date.now();

  while (endsAt != null && new Date(endsAt).getTime() <= now) {
    const advanced = advanceOneSegmentExpiry(
      exam,
      workingState,
      practice,
      endsAt,
    );
    workingState = advanced.state;
    endsAt = advanced.currentSegmentEndsAt;
    if (advanced.isComplete) {
      return {
        state: workingState,
        currentSegmentEndsAt: endsAt,
        isComplete: true,
      };
    }
  }

  return {
    state: toSnapshot(workingState as QuestionEngineState),
    currentSegmentEndsAt: endsAt,
    isComplete: false,
  };
}
