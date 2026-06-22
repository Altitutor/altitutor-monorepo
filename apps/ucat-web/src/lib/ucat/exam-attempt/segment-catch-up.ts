import type {
  QuestionEngineExam,
  QuestionEngineState,
} from "@/features/question-engine/model/types";
import {
  computeSegmentEndsAt,
  getCurrentSegmentTimeLimitSeconds,
  getNextMockSegment,
} from "@/lib/ucat/exam-attempt/timing";
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

function advanceOneSegmentExpiry(
  exam: QuestionEngineExam,
  state: ExamEngineSnapshot,
  practice: boolean,
): CatchUpResult {
  const working = { ...state, showTimeExpiredDialog: false };

  if (exam.sourceType === "questions" || exam.sourceType === "questionStem") {
    if (practice) {
      return {
        state: { ...working, phase: "practiceComplete" },
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
      const limit = getCurrentSegmentTimeLimitSeconds(exam, next as QuestionEngineState);
      return {
        state: next,
        currentSegmentEndsAt: computeSegmentEndsAt(limit),
        isComplete: false,
      };
    }
    return {
      state: working,
      currentSegmentEndsAt: null,
      isComplete: true,
    };
  }

  if (exam.sourceType === "mock") {
    const nextSeg = getNextMockSegment(exam, working as QuestionEngineState);
    if (!nextSeg) {
      return {
        state: { ...working, phase: "mockScore" },
        currentSegmentEndsAt: null,
        isComplete: true,
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
    const limit = getCurrentSegmentTimeLimitSeconds(exam, next as QuestionEngineState);
    return {
      state: next,
      currentSegmentEndsAt: computeSegmentEndsAt(limit),
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
    const advanced = advanceOneSegmentExpiry(exam, workingState, practice);
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
