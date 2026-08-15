import type { QuestionEngineExam } from "@/features/question-engine/model/types";
import { catchUpExpiredSegments } from "@/lib/ucat/exam-attempt/segment-catch-up";
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

function snapshot(phase: ExamEngineSnapshot["phase"]): ExamEngineSnapshot {
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
    placementSnapshots: {},
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
