import type { QuestionEngineExam } from "@/features/question-engine/model/types";
import { catchUpExpiredSegments } from "@/lib/ucat/exam-attempt/segment-catch-up";
import { mergeQuestionAttemptRowsIntoState } from "@/lib/ucat/exam-attempt/resume-state";
import type { ExamEngineSnapshot } from "@/lib/ucat/exam-attempt/types";

const setExam = {
  sourceType: "set",
  sourceId: "set-1",
  questions: [],
  setModeTiming: {
    instructionsTimeLimitSeconds: 30,
    setTimeLimitSeconds: 60,
  },
} as unknown as QuestionEngineExam;

function snapshot(
  phase: ExamEngineSnapshot["phase"],
): ExamEngineSnapshot {
  return {
    phase,
    instructionsIndex: 0,
    showReadyDialog: false,
    showTimeExpiredDialog: false,
    nextSegmentTimerStartedAt: null,
    currentIndex: 0,
    visitedQuestionIds: [],
    flaggedIds: [],
    selectedAnswers: {},
    syllogismSnapshots: {},
    reviewFilter: null,
    reviewFilterIndex: 0,
    reviewFilterIndicesSnapshot: null,
    mockCurrentSetIndex: undefined,
    viewingQuestionIndex: null,
  };
}

describe("catchUpExpiredSegments", () => {
  it("finalizes a set when its question deadline expires", () => {
    const result = catchUpExpiredSegments(
      setExam,
      snapshot("question"),
      new Date(Date.now() - 1_000).toISOString(),
    );

    expect(result.isComplete).toBe(true);
    expect(result.state.phase).toBe("marking");
    expect(result.currentSegmentEndsAt).toBeNull();
  });

  it("anchors later segments to the expired deadline while catching up", () => {
    const result = catchUpExpiredSegments(
      setExam,
      snapshot("instructions"),
      new Date(Date.now() - 90_000).toISOString(),
    );

    expect(result.isComplete).toBe(true);
    expect(result.state.phase).toBe("marking");
    expect(result.currentSegmentEndsAt).toBeNull();
  });

  it("keeps review on the original question deadline", () => {
    const result = catchUpExpiredSegments(
      setExam,
      snapshot("review"),
      new Date(Date.now() - 1_000).toISOString(),
    );

    expect(result.isComplete).toBe(true);
    expect(result.state.phase).toBe("marking");
  });
});

describe("mergeQuestionAttemptRowsIntoState", () => {
  it("restores saved answers and flag state for resume", () => {
    const state: ExamEngineSnapshot = {
      ...snapshot("question"),
      flaggedIds: ["question-2"],
    };

    const merged = mergeQuestionAttemptRowsIntoState(state, [
      {
        question_id: "question-1",
        question_answer_option_id: "option-a",
        answer_snapshot: null,
        is_flagged: true,
      },
      {
        question_id: "question-2",
        question_answer_option_id: null,
        answer_snapshot: null,
        is_flagged: false,
      },
    ]);

    expect(merged.selectedAnswers).toEqual({
      "question-1": "option-a",
    });
    expect(merged.flaggedIds).toEqual(["question-1"]);
    expect(merged.visitedQuestionIds).toEqual([
      "question-1",
      "question-2",
    ]);
  });

  it("recovers stale instructions state to the furthest saved question", () => {
    const merged = mergeQuestionAttemptRowsIntoState(
      {
        ...snapshot("instructions"),
        currentIndex: 0,
      },
      [
        {
          question_id: "question-2",
          question_answer_option_id: "option-b",
          answer_snapshot: null,
          is_flagged: false,
        },
      ],
      ["question-1", "question-2", "question-3"],
    );

    expect(merged.phase).toBe("question");
    expect(merged.currentIndex).toBe(1);
    expect(merged.selectedAnswers["question-2"]).toBe("option-b");
  });
});
