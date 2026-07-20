/**
 * Tests for timing utilities
 */

import {
  advanceMockAfterTimeExpired,
  beginQuestionsFromReadyDialog,
  getCurrentSegmentTimeLimitSeconds,
  formatTimeRemaining,
  getNextMockSegmentAfterExpiry,
} from "../timing";
import type {
  QuestionEngineExam,
  QuestionEngineState,
} from "@/features/question-engine/model/types";

function createBaseState(
  overrides: Partial<QuestionEngineState> = {},
): QuestionEngineState {
  return {
    phase: "question",
    instructionsIndex: 0,
    showReadyDialog: false,
    timerStartedAt: null,
    showTimeExpiredDialog: false,
    nextSegmentTimerStartedAt: null,
    currentIndex: 0,
    visitedQuestionIds: [],
    flaggedIds: [],
    selectedAnswers: {},
    showNavigator: false,
    showCalculator: false,
    showEndExamDialog: false,
    reviewFilter: null,
    reviewFilterIndex: 0,
    reviewFilterIndicesSnapshot: null,
    showNoFlaggedDialog: false,
    showReviewInstructionsDialog: false,
    showEndReviewDialog: false,
    viewingQuestionIndex: null,
    showExitResultsDialog: false,
    ...overrides,
  };
}

describe("getCurrentSegmentTimeLimitSeconds", () => {
  it("returns null for set mode when untimed", () => {
    const exam: QuestionEngineExam = {
      sourceType: "set",
      sourceId: "s1",
      title: "Set",
      questions: [],
      instructionsScreens: [],
      setModeTiming: {
        setTimeLimitSeconds: null,
        instructionsTimeLimitSeconds: null,
      },
    };
    expect(
      getCurrentSegmentTimeLimitSeconds(exam, createBaseState()),
    ).toBeNull();
  });

  it("returns set time limit for question phase in set mode", () => {
    const exam: QuestionEngineExam = {
      sourceType: "set",
      sourceId: "s1",
      title: "Set",
      questions: [],
      instructionsScreens: [],
      setModeTiming: {
        setTimeLimitSeconds: 600,
        instructionsTimeLimitSeconds: 120,
      },
    };
    expect(
      getCurrentSegmentTimeLimitSeconds(
        exam,
        createBaseState({ phase: "question" }),
      ),
    ).toBe(600);
  });

  it("returns instructions time limit for instructions phase in set mode", () => {
    const exam: QuestionEngineExam = {
      sourceType: "set",
      sourceId: "s1",
      title: "Set",
      questions: [],
      instructionsScreens: [],
      setModeTiming: {
        setTimeLimitSeconds: 600,
        instructionsTimeLimitSeconds: 120,
      },
    };
    expect(
      getCurrentSegmentTimeLimitSeconds(
        exam,
        createBaseState({ phase: "instructions" }),
      ),
    ).toBe(120);
  });
});

describe("formatTimeRemaining", () => {
  it("formats seconds as MM:SS", () => {
    expect(formatTimeRemaining(90)).toBe("1:30");
    expect(formatTimeRemaining(0)).toBe("0:00");
    expect(formatTimeRemaining(125)).toBe("2:05");
  });
});

describe("getNextMockSegmentAfterExpiry", () => {
  const mockExam: QuestionEngineExam = {
    sourceType: "mock",
    sourceId: "mock-1",
    title: "Mock 1",
    questions: [],
    instructionsScreens: [
      { instructionsJson: null },
      { instructionsJson: null },
      { instructionsJson: null },
    ],
    mockTimingSegments: [
      { type: "instructions", instructionsIndex: 0, timeLimitSeconds: 90 },
      {
        type: "questions",
        setIndex: 0,
        questionStartIndex: 0,
        questionEndIndex: 44,
        timeLimitSeconds: 1320,
      },
      { type: "instructions", instructionsIndex: 1, timeLimitSeconds: 90 },
      {
        type: "questions",
        setIndex: 1,
        questionStartIndex: 44,
        questionEndIndex: 79,
        timeLimitSeconds: 761,
      },
      { type: "instructions", instructionsIndex: 2, timeLimitSeconds: 120 },
      {
        type: "questions",
        setIndex: 2,
        questionStartIndex: 79,
        questionEndIndex: 115,
        timeLimitSeconds: 823,
      },
    ],
    mockSetSummaries: [
      {
        setIndex: 0,
        name: "VR",
        questionStartIndex: 0,
        questionEndIndex: 44,
      },
      {
        setIndex: 1,
        name: "DM",
        questionStartIndex: 44,
        questionEndIndex: 79,
      },
      {
        setIndex: 2,
        name: "QR",
        questionStartIndex: 79,
        questionEndIndex: 115,
      },
    ],
  };

  it("advances DM review expiry to QR instructions", () => {
    expect(
      getNextMockSegmentAfterExpiry(
        mockExam,
        createBaseState({ phase: "review", mockCurrentSetIndex: 1 }),
      ),
    ).toMatchObject({
      type: "instructions",
      instructionsIndex: 2,
      timeLimitSeconds: 120,
      segmentIndex: 4,
    });
  });

  it("starts the second section after its ready dialog", () => {
    const startedAt = 1_500_000;
    const next = beginQuestionsFromReadyDialog(
      mockExam,
      createBaseState({
        phase: "instructions",
        instructionsIndex: 1,
        showReadyDialog: true,
        mockCurrentSetIndex: 1,
        // Reviewing the first question in VR must not make the mock restart.
        currentIndex: 0,
      }),
      startedAt,
    );

    expect(next).toMatchObject({
      phase: "question",
      showReadyDialog: false,
      currentIndex: 44,
      mockCurrentSetIndex: 1,
      timerStartedAt: startedAt,
    });
  });

  it("falls back to the current mock set when instructions cannot be matched", () => {
    const next = beginQuestionsFromReadyDialog(
      mockExam,
      createBaseState({
        phase: "instructions",
        instructionsIndex: 999,
        showReadyDialog: true,
        mockCurrentSetIndex: 1,
        currentIndex: 0,
      }),
      2_000_000,
    );

    expect(next).toMatchObject({
      phase: "question",
      currentIndex: 44,
      mockCurrentSetIndex: 1,
    });
  });

  it("does not restart the mock when no question segment can be resolved", () => {
    const unresolved = createBaseState({
      phase: "instructions",
      instructionsIndex: 999,
      showReadyDialog: true,
      currentIndex: 43,
    });

    expect(beginQuestionsFromReadyDialog(mockExam, unresolved)).toBe(
      unresolved,
    );
  });

  it("only returns null when the final set expires", () => {
    expect(
      getNextMockSegmentAfterExpiry(
        mockExam,
        createBaseState({ phase: "review", mockCurrentSetIndex: 2 }),
      ),
    ).toBeNull();
  });

  it("enters QR instructions four seconds into their existing clock", () => {
    const expiredAt = 1_000_000;
    const qrInstructions = getNextMockSegmentAfterExpiry(
      mockExam,
      createBaseState({ phase: "review", mockCurrentSetIndex: 1 }),
    );
    expect(qrInstructions).not.toBeNull();

    const next = advanceMockAfterTimeExpired(
      mockExam,
      createBaseState({
        phase: "review",
        mockCurrentSetIndex: 1,
        showTimeExpiredDialog: true,
        nextSegmentTimerStartedAt: expiredAt,
      }),
      qrInstructions!,
      expiredAt,
      expiredAt + 4_000,
    );

    expect(next).toMatchObject({
      phase: "instructions",
      instructionsIndex: 2,
      mockCurrentSetIndex: 2,
      timerStartedAt: expiredAt,
      showTimeExpiredDialog: false,
      nextSegmentTimerStartedAt: null,
    });
    expect(
      getCurrentSegmentTimeLimitSeconds(mockExam, next)! -
        (expiredAt + 4_000 - next.timerStartedAt!) / 1000,
    ).toBe(116);
  });
});
