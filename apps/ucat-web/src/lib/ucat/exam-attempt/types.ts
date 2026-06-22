import type { QuestionEngineState } from "@/features/question-engine/model/types";

export type ExamAttemptKind = "set" | "mock" | "practice";

/** Serializable question-engine state persisted for resume. */
export type ExamEngineSnapshot = Pick<
  QuestionEngineState,
  | "phase"
  | "instructionsIndex"
  | "showReadyDialog"
  | "showTimeExpiredDialog"
  | "nextSegmentTimerStartedAt"
  | "currentIndex"
  | "visitedQuestionIds"
  | "flaggedIds"
  | "selectedAnswers"
  | "syllogismSnapshots"
  | "reviewFilter"
  | "reviewFilterIndex"
  | "reviewFilterIndicesSnapshot"
  | "mockCurrentSetIndex"
  | "practiceAnswerUnitStartIndex"
  | "practiceAnswerUnitEndIndex"
  | "viewingQuestionIndex"
  | "loadingMoreTargetIndex"
  | "loadingMoreExcludeStemIds"
>;

export type ActiveExamAttempt = {
  kind: ExamAttemptKind;
  attemptId: string;
  resourceId: string;
  label: string;
  resumeHref: string;
  currentSegmentEndsAt: string | null;
  engineSnapshot: ExamEngineSnapshot;
  mockAttemptId: string | null;
  setAttemptIdsBySetId: Record<string, string>;
  practiceSessionId: string | null;
  wasTimed: boolean;
};

export type BeginExamAttemptInput = {
  kind: ExamAttemptKind;
  resourceId: string;
  practiceSessionId?: string;
  wasTimed: boolean;
  engineSnapshot: ExamEngineSnapshot;
  segmentTimeLimitSeconds: number | null;
  questionSetIdForMockSet?: string;
};

export type SyncExamAttemptInput = {
  kind: ExamAttemptKind;
  attemptId: string;
  engineSnapshot: ExamEngineSnapshot;
  currentSegmentEndsAt: string | null;
  setAttemptIdsBySetId?: Record<string, string>;
};

export type FinalizeExamAttemptInput = {
  kind: ExamAttemptKind;
  attemptId: string;
};

export type ExamAttemptConflict = {
  error: "EXAM_ATTEMPT_IN_PROGRESS";
  active: ActiveExamAttempt;
};
