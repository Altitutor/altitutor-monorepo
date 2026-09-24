import type {
  AnswerScheme,
  ResponseSnapshotV1,
  ResponseType,
  PlacementValue,
} from "@altitutor/ucat-response-contract";

export type PlacementSnapshot = Record<string, PlacementValue>;

export type QuestionEngineMode = "set" | "mock" | "questionStem" | "questions";

export type AnswerOption = {
  id: string;
  index: number;
  text: string;
  /** Rich JSON for option text (Tiptap). When present, use for rendering images/formatting. */
  textJson?: Record<string, unknown> | null;
  /** Canonical answer-key role used by the shared response contract. */
  answerKeyValue?: "correct" | "yes" | "no" | "most" | "least" | null;
  /** Option-level answer explanation (shown in results review). */
  answerExplanation?: string;
  /** Rich JSON for option answer explanation (Tiptap). */
  answerExplanationJson?: Record<string, unknown> | null;
  /** Number of students who selected this option. From DB aggregation. */
  selectionCount?: number;
  /** Total students who answered this question. From DB aggregation. */
  totalAnswered?: number;
  /** Percentage (0–100) of students who selected this option. */
  percentage?: number;
};

export type QuestionItem = {
  id: string;
  index: number;
  questionSetId: string;
  stemId: string;
  sectionName: string;
  sectionDisplayColumns: 1 | 2;
  stemText: string;
  questionText: string;
  /** Rich JSON for stem (Tiptap). When present, use for rendering images/formatting. */
  stemJson?: Record<string, unknown> | null;
  /** Rich JSON for question text (Tiptap). When present, use for rendering images/formatting. */
  questionJson?: Record<string, unknown> | null;
  /** Candidate interaction, independent of the authored category. */
  responseType: ResponseType;
  /** Validation, scoring, persistence, and review behavior. */
  answerScheme: AnswerScheme["kind"];
  options: AnswerOption[];
  /** ID of the correct answer option. Used for marking. */
  correctOptionId?: string;
  /** Question-level answer explanation (shown below options in results review). */
  answerExplanation?: string;
  /** Rich JSON for question answer explanation (Tiptap). */
  answerExplanationJson?: Record<string, unknown> | null;
};

/** One screen of instructions (tiptap/prosemirror JSON). Shown before questions when applicable. */
export type InstructionsScreen = {
  instructionsJson: Record<string, unknown> | null;
};

/** Time limit for current segment. If set is untimed (questions time null), instructions are also untimed. */
export type SetModeTiming = {
  /** Question set time limit. Null = untimed (no timer in instructions or questions). */
  setTimeLimitSeconds: number | null;
  /** Section instructions time limit. Only shown when set is timed. */
  instructionsTimeLimitSeconds: number | null;
};

/** One segment in mock (instructions screen or block of questions). Used for timer and time-expired flow. */
export type MockTimingSegment =
  | {
      type: "instructions";
      instructionsIndex: number;
      timeLimitSeconds: number | null;
    }
  | {
      type: "questions";
      setIndex: number;
      questionStartIndex: number;
      questionEndIndex: number;
      timeLimitSeconds: number | null;
    };

export type QuestionEngineExam = {
  sourceType: QuestionEngineMode;
  sourceId: string;
  title: string;
  questions: QuestionItem[];
  /** Ordered list of instruction screens. Set/mock mode only. Empty = no instructions phase. */
  instructionsScreens: InstructionsScreen[];
  /** Set mode only. When null, exam is untimed. */
  setModeTiming?: SetModeTiming | null;
  /** Mock mode only. Ordered segments for timer and expiry. */
  mockTimingSegments?: MockTimingSegment[];
  /** Mock mode only. Per-set summaries for mock score display. */
  mockSetSummaries?: Array<{
    setIndex: number;
    name: string;
    questionStartIndex: number;
    questionEndIndex: number;
  }>;
  /** Questions/questionStem mode only. Seconds per question for timing. Null = untimed. */
  timePerQuestionSeconds?: number | null;
  /** Fixed practice review-at-end only. One deadline shared by every question. */
  practiceSessionTimeLimitSeconds?: number | null;
};

export type QuestionStemWithQuestions = {
  id: string;
  questionSetId: string;
  sectionName: string;
  sectionDisplayColumns: 1 | 2;
  stemText: string;
  /** Rich JSON for stem (Tiptap). Required for image rendering in practice mode. */
  stemJson?: Record<string, unknown> | null;
  questions: {
    id: string;
    index: number;
    questionText: string;
    /** Rich JSON for question text (Tiptap). */
    questionJson?: Record<string, unknown> | null;
    responseType: ResponseType;
    answerScheme: QuestionItem["answerScheme"];
    options: AnswerOption[];
    /** Question-level explanation (shown in review when present). */
    answerExplanation?: string;
    answerExplanationJson?: Record<string, unknown> | null;
  }[];
};

// Practice sessions keep immutable question snapshots, so a session created
// before the response-contract rollout can be resumed after a deployment.
// Remove this adapter only when production retention guarantees that no
// pre-contract practice snapshot can still be active or resumed.
type LegacyPracticeQuestion = Omit<
  QuestionStemWithQuestions["questions"][number],
  "answerScheme" | "options" | "responseType"
> & {
  questionType?: "multiple_choice" | "syllogism";
  responseType?: ResponseType;
  answerScheme?: AnswerScheme["kind"];
  options: Array<AnswerOption & { isAnswer?: boolean }>;
};

function normalizePracticeQuestion(
  question: QuestionStemWithQuestions["questions"][number],
): Pick<QuestionItem, "answerScheme" | "options" | "responseType"> {
  const legacyQuestion = question as LegacyPracticeQuestion;
  const answerScheme =
    question.answerScheme ??
    (legacyQuestion.questionType === "syllogism"
      ? "decision_making_binary_placement"
      : legacyQuestion.questionType === "multiple_choice"
        ? "single_choice"
        : undefined);
  const responseType =
    question.responseType ??
    (legacyQuestion.questionType === "syllogism"
      ? "drag_and_drop"
      : legacyQuestion.questionType === "multiple_choice"
        ? "multiple_choice"
        : undefined);

  if (!answerScheme || !responseType) {
    throw new Error(
      "Practice question snapshot is missing its response contract",
    );
  }

  const options = legacyQuestion.options.map((option) => {
    if (option.answerKeyValue != null || typeof option.isAnswer !== "boolean") {
      return option;
    }

    if (answerScheme === "decision_making_binary_placement") {
      return {
        ...option,
        answerKeyValue: option.isAnswer ? ("yes" as const) : ("no" as const),
      };
    }
    if (
      answerScheme === "single_choice" ||
      answerScheme === "situational_judgement_rating"
    ) {
      return {
        ...option,
        answerKeyValue: option.isAnswer ? ("correct" as const) : null,
      };
    }
    return option;
  });

  return { answerScheme, options, responseType };
}

export function mapQuestionStemsToItems(
  stems: QuestionStemWithQuestions[],
): QuestionItem[] {
  const items: QuestionItem[] = [];
  let runningIndex = 0;

  for (const stem of stems) {
    const sortedQuestions = [...stem.questions].sort(
      (a, b) => a.index - b.index,
    );

    for (const question of sortedQuestions) {
      const normalized = normalizePracticeQuestion(question);
      const sortedOptions = [...normalized.options].sort(
        (a, b) => a.index - b.index,
      );
      const correctOption = sortedOptions.find(
        (option) => option.answerKeyValue === "correct",
      );

      items.push({
        id: question.id,
        index: runningIndex++,
        questionSetId: stem.questionSetId,
        stemId: stem.id,
        sectionName: stem.sectionName,
        sectionDisplayColumns: stem.sectionDisplayColumns,
        stemText: stem.stemText,
        stemJson: stem.stemJson,
        questionText: question.questionText,
        questionJson: question.questionJson,
        responseType: normalized.responseType,
        answerScheme: normalized.answerScheme,
        options: sortedOptions,
        correctOptionId: correctOption?.id,
        answerExplanation: question.answerExplanation,
        answerExplanationJson: question.answerExplanationJson,
      });
    }
  }

  return items;
}

export type QuestionEngineQuestion = {
  id: string;
  stemId: string;
  sectionName: string;
  sectionDisplayColumns: 1 | 2;
  stemText: string;
  questionText: string;
  responseType: ResponseType;
  answerScheme: QuestionItem["answerScheme"];
  options: AnswerOption[];
  /** Question-level explanation (shown in review when present). */
  answerExplanation?: string;
  answerExplanationJson?: Record<string, unknown> | null;
};

export function mapQuestionsToItems(
  questions: QuestionEngineQuestion[],
): QuestionItem[] {
  return questions.map((question, index) => {
    const sortedOptions = [...question.options].sort(
      (a, b) => a.index - b.index,
    );
    const correctOption = sortedOptions.find(
      (option) => option.answerKeyValue === "correct",
    );
    return {
      id: question.id,
      index,
      questionSetId: "questions-mode",
      stemId: question.stemId,
      sectionName: question.sectionName,
      sectionDisplayColumns: question.sectionDisplayColumns,
      stemText: question.stemText,
      questionText: question.questionText,
      responseType: question.responseType,
      answerScheme: question.answerScheme,
      options: sortedOptions,
      correctOptionId: correctOption?.id,
      answerExplanation: question.answerExplanation,
      answerExplanationJson: question.answerExplanationJson,
    };
  });
}

/** Filter for review mode: which subset of questions to step through. */
export type ReviewFilter = "all" | "incomplete" | "flagged";

export type QuestionEngineState = {
  /** `marking` and `mockScore` are completion sentinels; the engine redirects instead of rendering them. */
  phase:
    | "instructions"
    | "intro"
    | "question"
    | "review"
    | "marking"
    | "mockScore"
    | "practiceAnswer"
    | "practiceComplete"
    | "loadingMore";
  /** Mock only: which set we're in (0-based). Used when in review to scope to current set. */
  mockCurrentSetIndex?: number;
  /** Which instructions screen (0-based). Only relevant when phase === 'instructions'. */
  instructionsIndex: number;
  /** When true, Ready to Begin dialog is shown on top of current screen (e.g. instructions). No = dismiss only. */
  showReadyDialog: boolean;
  /** When the current segment's timer started (ms). Null when untimed or timer not started. */
  timerStartedAt: number | null;
  /** When true, show "Time Expired" dialog. On OK: set mode = end set; mock mode = advance to next segment. */
  showTimeExpiredDialog: boolean;
  /** The expiry notice belongs to instructions; acknowledging it reveals the already-started question segment. */
  timeExpiredFromInstructions?: boolean;
  /** Mock only: when we showed time expired, the next segment's timer was started at this time (ms). */
  nextSegmentTimerStartedAt: number | null;
  currentIndex: number;
  /** Question ids the user has visited (for Unseen vs Incomplete status in review). */
  visitedQuestionIds: string[];
  flaggedIds: string[];
  selectedAnswers: Record<string, string>;
  /** Placement response state, keyed by question then option. */
  placementSnapshots?: Record<string, PlacementSnapshot>;
  /** Canonical durable responses. */
  responseSnapshots?: Record<string, ResponseSnapshotV1>;
  showNavigator: boolean;
  showCalculator: boolean;
  showEndExamDialog: boolean;
  /** When phase === 'review': null = review screen (list); non-null = review mode (stepping through filtered list). */
  reviewFilter: ReviewFilter | null;
  /** Index into the filtered list when in review mode. Only relevant when reviewFilter !== null. */
  reviewFilterIndex: number;
  /** Snapshot of indices when entering review filter mode. List stays fixed until returning to review screen. */
  reviewFilterIndicesSnapshot: number[] | null;
  /** When true, show "There are no flagged questions" dialog. */
  showNoFlaggedDialog: boolean;
  showReviewInstructionsDialog: boolean;
  showEndReviewDialog: boolean;
  /** Current question in practice answer/review flows, or null when none is open. */
  viewingQuestionIndex: number | null;
  /** Practice mode only: unit being reviewed. viewingQuestionIndex is the current question in this range. */
  practiceAnswerUnitStartIndex?: number;
  practiceAnswerUnitEndIndex?: number;
  /** Unlimited mode: when phase === 'loadingMore', the index we're waiting for. */
  loadingMoreTargetIndex?: number;
  /** Unlimited mode: stem IDs to exclude when fetching next. */
  loadingMoreExcludeStemIds?: string[];
  /** Server-owned open interval for question active-time accumulation. */
  activeQuestionTiming?: {
    questionId: string;
    questionSetId: string;
    mode: QuestionEngineMode;
    wasTimed: boolean;
    startedAt: string;
    segmentEndsAt: string | null;
  } | null;
};
