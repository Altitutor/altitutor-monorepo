import type {
  QuestionEngineMode,
  QuestionEngineState,
} from "@/features/question-engine/model/types";

export type ExamAttemptKind = "set" | "mock" | "practice";

/** Serializable question-engine state persisted for resume. */
export type QuestionActiveTimingContext = {
  questionId: string;
  questionSetId: string;
  mode: QuestionEngineMode;
  wasTimed: boolean;
};

export type QuestionActiveTimingState = QuestionActiveTimingContext & {
  startedAt: string;
  segmentEndsAt: string | null;
};

export type ExamEngineSnapshot = Pick<
  QuestionEngineState,
  | "phase"
  | "instructionsIndex"
  | "showReadyDialog"
  | "showTimeExpiredDialog"
  | "timeExpiredFromInstructions"
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
> & {
  activeQuestionTiming?: QuestionActiveTimingState | null;
};

export type ActiveExamAttempt = {
  kind: ExamAttemptKind;
  attemptId: string;
  resourceId: string;
  label: string;
  resumeHref: string;
  exitHref?: string;
  resultsHref: string;
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
  /** When present, the server starts a new segment using its own clock. */
  startSegmentTimeLimitSeconds?: number | null;
  setAttemptIdsBySetId?: Record<string, string>;
  /** Current question for server-owned question active time. Null closes any open interval. */
  questionActiveTiming?: QuestionActiveTimingContext | null;
};

export type FinalizeExamAttemptInput = {
  kind: ExamAttemptKind;
  attemptId: string;
};

export type ExamAttemptConflict = {
  error: "EXAM_ATTEMPT_IN_PROGRESS";
  active: ActiveExamAttempt;
};
